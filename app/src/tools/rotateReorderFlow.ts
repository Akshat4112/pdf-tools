/**
 * Rotate + Reorder tool flow — PT-CORE-008.
 *
 * Two modes over one plan engine (PT-FT-003 / PT-FT-006 via organizePdf):
 *   rotate:  delta-rotate a page selection in 90° steps, composing with the
 *            pages' EXISTING /Rotate values (90 + existing 90 = 180)
 *   reorder: apply a full page permutation (order only; duplicates allowed
 *            deliberately per PT-FT-006 "duplicates and deletions")
 *
 * Validation: permutation is total (exactly pageCount source references —
 * no accidental silent page loss; deliberate duplicates allowed via the
 * organize plan), rotation bounds checked, page-count quota enforced.
 * Output verified: structure + independent page-count readback + rotation
 * readback through the independent reader.
 */

import { organizePdf, type OrganizePlanEntry } from '../engines/pdflib'
import { parsePageRanges } from '../lib/pageRanges'
import { runJob, CancelledError } from '../jobs/orchestrator'
import type { Job, JobProgress } from '../jobs/orchestrator'
import { verifyOutput, verifyPdfPageCount, type VerifiedOutput } from '../outputs/verify'
import { openDocument } from '../engines/pdfjs'
import { toolError } from '../registry'

export type RotateDelta = 90 | 180 | 270

export interface RotateInput {
  file: { displayName: string; bytes: Uint8Array }
  /** comma expression of pages to rotate; empty means ALL pages */
  pagesExpr?: string
  delta: RotateDelta
}

export interface ReorderInput {
  file: { displayName: string; bytes: Uint8Array }
  /** full permutation as 1-based pages, e.g. [3, 1, 2] for a 3-page doc */
  order: number[]
}

/**
 * Build the organize plan for a rotation: rotate ONLY the selected pages by
 * the delta composed with their CURRENT rotation; others pass through with
 * their existing rotation preserved. Pure — unit tested.
 */
export function rotationPlan(
  currentRotations: readonly number[],
  selected: readonly number[],
  delta: RotateDelta,
): OrganizePlanEntry[] {
  const sel = new Set(selected)
  return currentRotations.map((angle, i) => {
    const page = i + 1
    if (!sel.has(page)) return { sourcePage: page }
    return { sourcePage: page, rotation: (angle + delta) % 360 }
  })
}

/**
 * Validate a permutation: must reference exactly the document's page set —
 * every page exactly once (a true permutation; duplicates/deletions are the
 * organize tool's domain, not reorder's). Pure — unit tested.
 */
export function validatePermutation(order: readonly number[], pageCount: number): void {
  if (order.length !== pageCount) {
    throw toolError(
      'E-CONFIG-01',
      `The new order must list all ${pageCount} pages exactly once — it has ${order.length}.`,
      'fix-field',
    )
  }
  const seen = new Set<number>()
  for (const n of order) {
    if (n < 1 || n > pageCount) {
      throw toolError('E-CONFIG-01', `Page ${n} is not valid for a ${pageCount}-page document.`, 'fix-field')
    }
    if (seen.has(n)) {
      throw toolError(
        'E-CONFIG-01',
        `Page ${n} appears twice in the new order. Reordering moves pages; it never duplicates or drops them.`,
        'fix-field',
      )
    }
    seen.add(n)
  }
}

/** Read the current /Rotate of every page through the independent reader. */
async function currentPageRotations(bytes: Uint8Array): Promise<number[]> {
  const doc = await openDocument(bytes)
  try {
    const rotations: number[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      rotations.push(page.rotate ?? 0)
      page.cleanup()
    }
    return rotations
  } finally {
    await doc.destroy()
  }
}

export function startRotate(
  input: RotateInput,
  events: {
    onProgress?: (p: JobProgress) => void
    onState?: (s: string) => void
  } = {},
): Job<RotateInput, VerifiedOutput> {
  return runJob(
    'rotate',
    input,
    async (inp, ctx) => {
      const doc = await openDocument(inp.file.bytes)
      const pageCount = doc.numPages
      await doc.destroy()
      if (pageCount < 1) {
        throw toolError('E-INPUT-03', 'This PDF has no pages.', 'retry-file')
      }

      // empty expression = all pages; otherwise parse the selection
      const selected = inp.pagesExpr?.trim()
        ? parsePageRanges(inp.pagesExpr, pageCount).pages
        : Array.from({ length: pageCount }, (_, i) => i + 1)

      // compose with EXISTING rotations read through the independent reader
      const rotations = await currentPageRotations(inp.file.bytes)
      const plan = rotationPlan(rotations, selected, inp.delta)
      if (ctx.isCancelled()) throw new CancelledError()

      const result = await organizePdf(inp.file.bytes, plan)
      ctx.reportProgress(0.7, 'verifying output…')

      const stem = (inp.file.displayName ?? 'document')
        .replace(/\.[^.]*$/, '')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 50) || 'document'

      const out = await verifyOutput({
        name: `${stem}-rotated.pdf`,
        mimeType: 'application/pdf',
        bytes: result,
      })
      await verifyPdfPageCount(result, pageCount)

      // rotation readback: selected pages advanced by delta (mod 360)
      const after = await currentPageRotations(result)
      for (const n of selected) {
        const expected = (rotations[n - 1] + inp.delta) % 360
        if (after[n - 1] !== expected) {
          throw toolError(
            'E-OUT-01',
            `Page ${n} rotated to ${after[n - 1]}° instead of ${expected}° — verification failed.`,
            'retry-job',
          )
        }
      }
      return out
    },
    { onProgress: events.onProgress, onState: events.onState },
  )
}

export function startReorder(
  input: ReorderInput,
  events: {
    onProgress?: (p: JobProgress) => void
    onState?: (s: string) => void
  } = {},
): Job<ReorderInput, VerifiedOutput> {
  return runJob(
    'reorder',
    input,
    async (inp, ctx) => {
      const doc = await openDocument(inp.file.bytes)
      const pageCount = doc.numPages
      await doc.destroy()
      if (pageCount < 2) {
        throw toolError(
          'E-CONFIG-01',
          'This document has a single page — there is nothing to reorder.',
          'fix-field',
        )
      }

      validatePermutation(inp.order, pageCount)

      // preserve existing rotations through the permutation
      const rotations = await currentPageRotations(inp.file.bytes)
      const plan: OrganizePlanEntry[] = inp.order.map((n) => ({
        sourcePage: n,
        rotation: rotations[n - 1],
      }))
      if (ctx.isCancelled()) throw new CancelledError()

      const result = await organizePdf(inp.file.bytes, plan)
      ctx.reportProgress(0.7, 'verifying output…')

      const stem = (inp.file.displayName ?? 'document')
        .replace(/\.[^.]*$/, '')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 50) || 'document'

      const out = await verifyOutput({
        name: `${stem}-reordered.pdf`,
        mimeType: 'application/pdf',
        bytes: result,
      })
      await verifyPdfPageCount(result, pageCount)

      // content readback: page order must match the permutation exactly.
      // Anchors are the SOURCE page texts (any fixture's markers work —
      // PACKING-BOX, ROTATE-FIXTURE-PAGE, or arbitrary text): each output
      // position must carry its expected source page's text.
      const srcTexts: string[] = []
      const sdoc = await openDocument(inp.file.bytes)
      try {
        for (let i = 1; i <= sdoc.numPages; i++) {
          const page = await sdoc.getPage(i)
          const tc = await page.getTextContent()
          srcTexts.push(tc.items.map((it: { str: string }) => it.str).join(' ').trim())
          page.cleanup()
        }
      } finally {
        await sdoc.destroy()
      }
      const texts: string[] = []
      const rdoc = await openDocument(result)
      try {
        for (let i = 1; i <= rdoc.numPages; i++) {
          const page = await rdoc.getPage(i)
          const tc = await page.getTextContent()
          texts.push(tc.items.map((it: { str: string }) => it.str).join(' ').trim())
          page.cleanup()
        }
      } finally {
        await rdoc.destroy()
      }
      for (let i = 0; i < inp.order.length; i++) {
        const expected = srcTexts[inp.order[i] - 1]
        if (expected && !texts[i].includes(expected)) {
          throw toolError(
            'E-OUT-01',
            `Position ${i + 1} does not hold the expected page — verification failed.`,
            'retry-job',
          )
        }
      }
      return out
    },
    { onProgress: events.onProgress, onState: events.onState },
  )
}
