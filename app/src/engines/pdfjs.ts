/**
 * PDF.js engine adapter — PT-FND-005.
 *
 * Wraps pdfjs-dist with the project's contracts:
 * - loadingTask lifecycle (PT-SP-001 §2.1: destroy via loadingTask.destroy())
 * - self-hosted standardFontDataUrl under /pdf-tools/ (no CDN)
 * - taxonomy errors only (PT-PD-002 §5 via registry toolError)
 * - quota enforcement hooks (QUOTAS from registry, PT-SP-002 §3)
 * - offset-0 byte normalization (PT-SP-001 §2.2)
 *
 * Platform note: pdfjs runs in the main thread in Node tests; in the browser
 * PT-FND-003's worker orchestration feeds it through a dedicated worker.
 * The adapter API is identical in both.
 */

import type { ToolError } from '../registry'
import { QUOTAS, toolError } from '../registry'

export interface PdfjsDocument {
  numPages: number
  getPage(i: number): Promise<PdfjsPage>
  /** PT-SP-001 §2.1: forwards to loadingTask.destroy() */
  destroy(): Promise<void>
}

export interface PdfjsPage {
  getViewport(opts: { scale: number }): { width: number; height: number }
  render(opts: Record<string, unknown>): { promise: Promise<void> }
  getTextContent(): Promise<{ items: Array<{ str: string }> }>
  cleanup(): void
  rotate: number
}

export interface RenderResult {
  width: number
  height: number
  /** byte length of the encoded image (verification evidence, PT-PD-002 S6) */
  bytes: number
  mimeType: 'image/png' | 'image/jpeg'
  quality?: number
}

/** Options for rendering a page to a raster image. */
export interface RenderOptions {
  dpi: number
  format: 'png' | 'jpeg'
  /** jpeg quality 0-1 (ignored for png); default 0.8 */
  quality?: number
  /** explicit background policy (PT-FT-009): 'white' paints #fff behind transparency */
  background?: 'transparent' | 'white'
}

// lazily imported so the pdfjs chunk never loads for non-rendering tools
type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
let pdfjsModule: PdfjsModule | null = null

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsModule) {
    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs')
    // browser only: point worker at the self-hosted file under /pdf-tools/
    if (typeof globalThis.window !== 'undefined' && 'GlobalWorkerOptions' in mod) {
      ;(mod as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
        `${import.meta.env.BASE_URL}assets/pdf.worker.min.mjs`
    }
    pdfjsModule = mod as PdfjsModule
  }
  return pdfjsModule
}

/** Preload the engine (called by PT-FND-003 orchestration before a job). */
export async function preloadPdfjs(): Promise<void> {
  await getPdfjs()
}

const FONT_URL = `${import.meta.env.BASE_URL}assets/standard_fonts/`

/** Validate DPI against the measured quota before any allocation. */
export function assertDpi(dpi: number): void {
  if (!(QUOTAS.renderDpis as readonly number[]).includes(dpi)) {
    throw toolError(
      'E-CONFIG-01',
      `DPI ${dpi} is not one of the supported values (${QUOTAS.renderDpis.join(', ')}).`,
      'fix-field',
    )
  }
}

/** Pixel-budget check: refuses renders that would exceed the held-bitmap ceiling. */
export function assertPixelBudget(widthPx: number, heightPx: number, heldBitmaps: number): void {
  const bytes = widthPx * heightPx * 4 * Math.max(1, heldBitmaps)
  const cap = QUOTAS.maxHeldBitmaps * 1600 * 1600 * 4 // 10 × ~A4@200dpi RGBA
  if (bytes > cap) {
    throw toolError(
      'E-PROC-02',
      `Rendering ${heldBitmaps} page(s) at this size exceeds the memory budget. Reduce DPI or render fewer pages.`,
      'reduce-scope',
    )
  }
}

export async function openDocument(
  data: Uint8Array | ArrayBuffer,
  opts: { maxPages?: number; maxBytes?: number } = {},
): Promise<PdfjsDocument> {
  const { getDocument } = await getPdfjs()
  const input = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (input.byteLength === 0) {
    throw toolError('E-INPUT-03', 'The file is empty.', 'retry-file')
  }
  const maxBytes = opts.maxBytes ?? QUOTAS.maxInputBytes
  if (input.byteLength > maxBytes) {
    throw toolError(
      'E-INPUT-04',
      `This file exceeds the current limit of ${Math.round(maxBytes / 1048576)} MB.`,
      'show-limits',
    )
  }
  // pdf.js DETACHES (transfers ownership of) the buffer it receives — hand it a
  // private copy so the caller's original stays valid for reuse/verification.
  const bytes = new Uint8Array(input.byteLength)
  bytes.set(input)
  let task: { promise: Promise<PdfjsDocument>; destroy(): Promise<void> }
  try {
    task = getDocument({
      data: bytes, // private copy — pdf.js detaches what it receives
      standardFontDataUrl: FONT_URL,
      isEvalSupported: false,
      // Node test path has no network fonts; browser self-hosts under BASE_URL
    } as never) as never
    const doc = await task.promise
    const maxPages = opts.maxPages ?? QUOTAS.maxPages
    if (doc.numPages > maxPages) {
      await task.destroy()
      throw toolError(
        'E-INPUT-04',
        `This document has ${doc.numPages} pages; the current limit is ${maxPages}.`,
        'show-limits',
      )
    }
    // pdf.js 6.x: teardown lives on the loadingTask — expose it on the doc handle
    return Object.assign(doc, { destroy: () => task.destroy() }) as PdfjsDocument
  } catch (err) {
    const e = err as ToolError & { name?: string }
    // taxonomy errors only: pdf.js PasswordException carries a NUMERIC code (1),
    // so check for our string codes explicitly — never re-throw raw exceptions.
    if (typeof e.code === 'string' && e.code.startsWith('E-')) throw e
    const name = e.name ?? ''
    if (/password/i.test(name + String(e.message))) {
      throw toolError(
        'E-INPUT-02',
        'This PDF is password-protected. Unlocking is not available in this release.',
        'explain-encryption',
      )
    }
    throw toolError('E-INPUT-03', 'This file could not be read as a PDF.', 'retry-file')
  }
}

/** PT-FT-010/013: page text joined with separators; empty pages reported. */
export async function extractPageText(doc: PdfjsDocument, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber)
  try {
    const tc = await page.getTextContent()
    return tc.items.map((it) => it.str).join(' ')
  } finally {
    page.cleanup()
  }
}

export interface TextExport {
  text: string
  pagesWithText: number
  pagesWithoutText: number[]
}

/** PT-FT-013: export available text with \f page separators + honesty report. */
export async function exportText(doc: PdfjsDocument): Promise<TextExport> {
  const parts: string[] = []
  const without: number[] = []
  let withText = 0
  for (let i = 1; i <= doc.numPages; i++) {
    const text = (await extractPageText(doc, i)).trim()
    if (text.length === 0) without.push(i)
    else withText++
    parts.push(text)
  }
  return { text: parts.join('\f'), pagesWithText: withText, pagesWithoutText: without }
}

// ---------------------------------------------------------------- coordinates

export interface Point {
  x: number
  y: number
}
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * PDF user space: origin bottom-left, units = points (1/72 inch).
 * Screen space: origin top-left, units = pixels at the given scale.
 * Conversion honors page rotation exactly as pdf.js viewports do.
 */
export function pdfPointToScreen(p: Point, viewport: { width: number; height: number }, pageRect: Rect, rotationDeg: number): Point {
  const { width: pw, height: ph } = pageRect
  const norm = ((rotationDeg % 360) + 360) % 360
  switch (norm) {
    case 0:
      return { x: (p.x / pw) * viewport.width, y: viewport.height - (p.y / ph) * viewport.height }
    case 90:
      return { x: (p.y / ph) * viewport.width, y: (p.x / pw) * viewport.height }
    case 180:
      return { x: viewport.width - (p.x / pw) * viewport.width, y: (p.y / ph) * viewport.height }
    case 270:
      return { x: viewport.width - (p.y / ph) * viewport.width, y: viewport.height - (p.x / pw) * viewport.height }
    default:
      throw toolError('E-CONFIG-01', `Unsupported rotation ${rotationDeg}.`, 'fix-field')
  }
}

/** Inverse of pdfPointToScreen: screen px back to PDF points (bottom-left origin). */
export function screenToPdfPoint(p: Point, viewport: { width: number; height: number }, pageRect: Rect, rotationDeg: number): Point {
  const { width: pw, height: ph } = pageRect
  const norm = ((rotationDeg % 360) + 360) % 360
  switch (norm) {
    case 0:
      return { x: (p.x / viewport.width) * pw, y: ph - (p.y / viewport.height) * ph }
    case 90:
      return { x: (p.y / viewport.height) * pw, y: (p.x / viewport.width) * ph }
    case 180:
      return { x: pw - (p.x / viewport.width) * pw, y: (p.y / viewport.height) * ph }
    case 270:
      return { x: pw - (p.y / viewport.height) * pw, y: ph - (p.x / viewport.width) * ph }
    default:
      throw toolError('E-CONFIG-01', `Unsupported rotation ${rotationDeg}.`, 'fix-field')
  }
}

/** DPI -> pdf.js scale (72 units/inch basis). */
export function dpiToScale(dpi: number): number {
  assertDpi(dpi)
  return dpi / 72
}

/** Expected output pixel size for a page at DPI, honoring rotation. */
export function renderedPageSize(pageWidthPt: number, pageHeightPt: number, dpi: number, rotationDeg: number): { width: number; height: number } {
  const scale = dpiToScale(dpi)
  const norm = ((rotationDeg % 360) + 360) % 360
  const swapped = norm === 90 || norm === 270
  const w = swapped ? pageHeightPt : pageWidthPt
  const h = swapped ? pageWidthPt : pageHeightPt
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

// Page ranges moved to lib/pageRanges.ts (PT-CORE-003); re-exported for compatibility.
export { parsePageRanges, type ParsedRange } from '../lib/pageRanges'
