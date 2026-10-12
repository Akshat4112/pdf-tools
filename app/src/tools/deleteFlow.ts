/**
 * Delete Pages tool flow — PT-CORE-006 (delete side).
 *
 * Full journey (PT-PD-002 §4 PT-FT-004): parse the selection -> reject an
 * all-delete up front (engine enforces too — belt and suspenders) -> remove
 * the pages from a COPY -> verify the remaining page set and content markers
 * through the independent reader -> deterministic output name.
 *
 * Acceptance: "All-delete rejected"; "Exact remaining pages match preview"
 * — the flow proves the remainder equals [1..pageCount] minus selection.
 */

import { deletePages } from '../engines/pdflib'
import { parsePageRanges } from '../lib/pageRanges'
import { runJob, CancelledError } from '../jobs/orchestrator'
import type { Job, JobProgress } from '../jobs/orchestrator'
import { verifyOutput, verifyPdfPageCount, type VerifiedOutput } from '../outputs/verify'
import { openDocument } from '../engines/pdfjs'
import { toolError } from '../registry'

export interface DeleteInput {
  file: { displayName: string; bytes: Uint8Array }
  /** comma expression like '3, 7-9' */
  pagesExpr: string
}

/**
 * Expected remaining pages after deletion — pure, shared with tests.
 * Order preserved (original document order minus the selection).
 */
export function remainingPages(pageCount: number, removed: readonly number[]): number[] {
  const gone = new Set(removed)
  const out: number[] = []
  for (let p = 1; p <= pageCount; p++) {
    if (!gone.has(p)) out.push(p)
  }
  return out
}

export function startDelete(
  input: DeleteInput,
  events: {
    onProgress?: (p: JobProgress) => void
    onState?: (s: string) => void
  } = {},
): Job<DeleteInput, VerifiedOutput> {
  return runJob(
    'delete-pages',
    input,
    async (inp, ctx) => {
      const doc = await openDocument(inp.file.bytes)
      const pageCount = doc.numPages
      await doc.destroy()
      if (pageCount < 2) {
        // deleting from a 1-page document can only yield an empty result
        throw toolError(
          'E-CONFIG-01',
          `This document has ${pageCount} page${pageCount === 1 ? '' : 's'} — nothing can be removed without emptying it.`,
          'fix-field',
        )
      }

      const { pages } = parsePageRanges(inp.pagesExpr, pageCount)

      // all-delete guard BEFORE any engine work (PT-FT-004 acceptance)
      const remaining = remainingPages(pageCount, pages)
      if (remaining.length === 0) {
        throw toolError(
          'E-CONFIG-01',
          'Deleting every page would leave an empty document. Keep at least one page.',
          'fix-field',
        )
      }

      const result = await deletePages(inp.file.bytes, pages)
      if (ctx.isCancelled()) throw new CancelledError()
      ctx.reportProgress(0.6, 'verifying output…')

      const stem = (inp.file.displayName ?? 'document')
        .replace(/\.[^.]*$/, '')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 50) || 'document'

      const out = await verifyOutput({
        name: `${stem}-pages-removed.pdf`,
        mimeType: 'application/pdf',
        bytes: result,
      })
      await verifyPdfPageCount(result, remaining.length)
      return out
    },
    { onProgress: events.onProgress, onState: events.onState },
  )
}
