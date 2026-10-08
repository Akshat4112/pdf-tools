/**
 * pdf-lib engine adapter — PT-FND-005 (writer side).
 *
 * Wraps pdf-lib with project contracts:
 * - offset-0 normalization on EVERY input (PT-SP-001 §2.2 — mechanical rule)
 * - taxonomy errors only (registry toolError)
 * - merge/split/rotate/delete/extract/organize primitives for PT-CORE tasks
 *
 * All primitives return fresh documents; the original input is never mutated
 * (PT-PD-002 §3: "Preserve the original input and create a separately named output").
 */

import { PDFDocument, degrees } from 'pdf-lib'
import { QUOTAS, toOffsetZeroU8, toolError } from '../registry'

export async function loadWritable(data: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  const bytes = toOffsetZeroU8(data instanceof Uint8Array ? data : new Uint8Array(data))
  if (bytes.byteLength === 0) {
    throw toolError('E-INPUT-03', 'The file is empty.', 'retry-file')
  }
  if (bytes.byteLength > QUOTAS.maxInputBytes) {
    throw toolError(
      'E-INPUT-04',
      `This file exceeds the current limit of ${Math.round(QUOTAS.maxInputBytes / 1048576)} MB.`,
      'show-limits',
    )
  }
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false })
  } catch (err) {
    const msg = String((err as Error).message ?? err)
    if (/encrypt/i.test(msg)) {
      throw toolError(
        'E-INPUT-02',
        'This PDF is password-protected. Unlocking is not available in this release.',
        'explain-encryption',
      )
    }
    throw toolError('E-INPUT-03', 'This file could not be read as a PDF.', 'retry-file')
  }
}

/** Merge documents in the given order. Output page count = sum (PT-FT-001). */
export async function mergePdfs(sources: Array<Uint8Array | ArrayBuffer>): Promise<Uint8Array> {
  if (sources.length === 0) {
    throw toolError('E-INPUT-05', 'Select at least one file to continue.', 'focus-picker')
  }
  const out = await PDFDocument.create()
  for (const src of sources) {
    const doc = await loadWritable(src)
    const copied = await out.copyPages(doc, doc.getPageIndices())
    copied.forEach((p) => out.addPage(p))
  }
  const total = out.getPageCount()
  if (total > QUOTAS.maxPages) {
    throw toolError(
      'E-INPUT-04',
      `The merged result would have ${total} pages; the current limit is ${QUOTAS.maxPages}.`,
      'show-limits',
    )
  }
  return out.save()
}

/** Split source into groups of 1-based page numbers. Empty group list -> E-INPUT-05. */
export async function splitPdf(
  source: Uint8Array | ArrayBuffer,
  groups: number[][],
): Promise<Uint8Array[]> {
  if (groups.length === 0) {
    throw toolError('E-INPUT-05', 'Select at least one range to continue.', 'focus-picker')
  }
  const src = await loadWritable(source)
  const outputs: Uint8Array[] = []
  for (const group of groups) {
    if (group.length === 0) {
      throw toolError('E-INPUT-05', 'Select at least one page to continue.', 'focus-picker')
    }
    const out = await PDFDocument.create()
    const indices = group.map((n) => n - 1)
    for (const n of group) {
      if (n < 1 || n > src.getPageCount()) {
        throw toolError(
          'E-CONFIG-01',
          `Page ${n} is not valid for a ${src.getPageCount()}-page document.`,
          'fix-field',
        )
      }
    }
    const copied = await out.copyPages(src, indices)
    copied.forEach((p) => out.addPage(p))
    outputs.push(await out.save())
  }
  return outputs
}

/**
 * Rotate pages by a multiple of 90°, composing with existing /Rotate
 * (PT-FT-003: "composed with existing rotation").
 */
export async function rotatePdf(
  source: Uint8Array | ArrayBuffer,
  pages: number[],
  deltaDeg: 90 | 180 | 270,
): Promise<Uint8Array> {
  const doc = await loadWritable(source)
  if (pages.length === 0) {
    throw toolError('E-INPUT-05', 'Select at least one page to continue.', 'focus-picker')
  }
  const all = doc.getPages()
  for (const n of pages) {
    if (n < 1 || n > all.length) {
      throw toolError('E-CONFIG-01', `Page ${n} is not valid for a ${all.length}-page document.`, 'fix-field')
    }
  }
  for (const n of pages) {
    const page = all[n - 1]
    const current = page.getRotation().angle
    page.setRotation(degrees((current + deltaDeg) % 360))
  }
  return doc.save()
}

/**
 * Delete pages (1-based). Rejects deleting every page (PT-FT-004:
 * "Reject an empty result").
 */
export async function deletePages(
  source: Uint8Array | ArrayBuffer,
  pages: number[],
): Promise<Uint8Array> {
  const doc = await loadWritable(source)
  if (pages.length === 0) {
    throw toolError('E-INPUT-05', 'Select at least one page to continue.', 'focus-picker')
  }
  const total = doc.getPageCount()
  const unique = [...new Set(pages)]
  if (unique.length >= total) {
    throw toolError(
      'E-CONFIG-01',
      'Deleting every page would leave an empty document. Keep at least one page.',
      'fix-field',
    )
  }
  for (const n of unique) {
    if (n < 1 || n > total) {
      throw toolError('E-CONFIG-01', `Page ${n} is not valid for a ${total}-page document.`, 'fix-field')
    }
  }
  // remove from highest index down so indices stay valid
  for (const n of unique.sort((a, b) => b - a)) {
    doc.removePage(n - 1)
  }
  return doc.save()
}

/**
 * Extract pages into a fresh document in the given (possibly custom) order
 * (PT-FT-005: "in the chosen order").
 */
export async function extractPages(
  source: Uint8Array | ArrayBuffer,
  pages: number[],
): Promise<Uint8Array> {
  const src = await loadWritable(source)
  if (pages.length === 0) {
    throw toolError('E-INPUT-05', 'Select at least one page to continue.', 'focus-picker')
  }
  const total = src.getPageCount()
  for (const n of pages) {
    if (n < 1 || n > total) {
      throw toolError('E-CONFIG-01', `Page ${n} is not valid for a ${total}-page document.`, 'fix-field')
    }
  }
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, pages.map((n) => n - 1))
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

/**
 * Organize: apply a full page plan (order, rotations, duplicates, deletions)
 * as one atomic transform (PT-FT-006). Plan is validated before any mutation.
 */
export interface OrganizePlanEntry {
  sourcePage: number // 1-based in the source
  rotation?: number // absolute final rotation in degrees (multiple of 90)
}

export async function organizePdf(
  source: Uint8Array | ArrayBuffer,
  plan: OrganizePlanEntry[],
): Promise<Uint8Array> {
  const src = await loadWritable(source)
  if (plan.length === 0) {
    throw toolError('E-CONFIG-01', 'The resulting document would have no pages. Keep at least one page.', 'fix-field')
  }
  const total = src.getPageCount()
  for (const entry of plan) {
    if (entry.sourcePage < 1 || entry.sourcePage > total) {
      throw toolError('E-CONFIG-01', `Page ${entry.sourcePage} is not valid for a ${total}-page document.`, 'fix-field')
    }
    if (entry.rotation !== undefined && ((entry.rotation % 90) !== 0 || entry.rotation < 0 || entry.rotation > 270)) {
      throw toolError('E-CONFIG-01', `Rotation must be 0, 90, 180 or 270 degrees.`, 'fix-field')
    }
  }
  if (plan.length > QUOTAS.maxPages) {
    throw toolError(
      'E-INPUT-04',
      `The result would have ${plan.length} pages; the current limit is ${QUOTAS.maxPages}.`,
      'show-limits',
    )
  }
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, plan.map((e) => e.sourcePage - 1))
  copied.forEach((page, i) => {
    const rot = plan[i].rotation
    if (rot !== undefined) page.setRotation(degrees(rot))
    out.addPage(page)
  })
  return out.save()
}

/**
 * Embed JPEG/PNG images as pages (PT-FT-007). Inputs must be validated
 * elsewhere for format; this enforces size quotas.
 */
export interface ImagePageSpec {
  bytes: Uint8Array
  kind: 'jpeg' | 'png'
  widthPt: number
  heightPt: number
  marginPt?: number
}

export async function imagesToPdf(images: ImagePageSpec[]): Promise<Uint8Array> {
  if (images.length === 0) {
    throw toolError('E-INPUT-05', 'Select at least one image to continue.', 'focus-picker')
  }
  const out = await PDFDocument.create()
  for (const spec of images) {
    if (spec.bytes.byteLength > QUOTAS.maxInputBytes) {
      throw toolError('E-INPUT-04', `An image exceeds the current limit of ${Math.round(QUOTAS.maxInputBytes / 1048576)} MB.`, 'show-limits')
    }
    const embedded =
      spec.kind === 'jpeg' ? await out.embedJpg(spec.bytes) : await out.embedPng(spec.bytes)
    const page = out.addPage([spec.widthPt, spec.heightPt])
    const margin = spec.marginPt ?? 0
    const availW = spec.widthPt - 2 * margin
    const availH = spec.heightPt - 2 * margin
    // contain-fit, preserve aspect (PT-FT-007: honor aspect ratio)
    const scale = Math.min(availW / embedded.width, availH / embedded.height)
    const w = embedded.width * scale
    const h = embedded.height * scale
    page.drawImage(embedded, {
      x: (spec.widthPt - w) / 2,
      y: (spec.heightPt - h) / 2,
      width: w,
      height: h,
    })
  }
  return out.save()
}
