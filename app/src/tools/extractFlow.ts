/**
 * Extract Pages tool flow — PT-CORE-006 (extract side).
 *
 * Full journey (PT-PD-002 §4 PT-FT-005): parse the page selection (shared
 * range module) -> extract into a fresh document IN THE CHOSEN ORDER via
 * the cancellable job -> verify (structure + independent page-count
 * readback) -> deterministic output name.
 *
 * The original file is never mutated (PT-PD-002 §3) — a new copy is written.
 */

import { extractPages } from '../engines/pdflib'
import { parsePageRanges } from '../lib/pageRanges'
import { runJob, CancelledError } from '../jobs/orchestrator'
import type { Job, JobProgress } from '../jobs/orchestrator'
import { verifyOutput, verifyPdfPageCount, type VerifiedOutput } from '../outputs/verify'
import { openDocument } from '../engines/pdfjs'
import { toolError } from '../registry'

export interface ExtractInput {
  file: { displayName: string; bytes: Uint8Array }
  /** comma expression like '3, 1, 12-15' — order IS the output order */
  pagesExpr: string
}

export function startExtract(
  input: ExtractInput,
  events: {
    onProgress?: (p: JobProgress) => void
    onState?: (s: string) => void
  } = {},
): Job<ExtractInput, VerifiedOutput> {
  return runJob(
    'extract-pages',
    input,
    async (inp, ctx) => {
      const doc = await openDocument(inp.file.bytes)
      const pageCount = doc.numPages
      await doc.destroy()
      if (pageCount < 1) {
        throw toolError('E-INPUT-03', 'This PDF has no pages.', 'retry-file')
      }

      const { pages } = parsePageRanges(inp.pagesExpr, pageCount)
      if (ctx.isCancelled()) throw new CancelledError()

      const extracted = await extractPages(inp.file.bytes, pages)
      ctx.reportProgress(0.6, 'verifying output…')

      const stem = (inp.file.displayName ?? 'document')
        .replace(/\.[^.]*$/, '')
        .replace(/[^\w.-]+/g, '_')
        .slice(0, 50) || 'document'

      const out = await verifyOutput({
        name: `${stem}-extracted.pdf`,
        mimeType: 'application/pdf',
        bytes: extracted,
      })
      await verifyPdfPageCount(extracted, pages.length)
      return out
    },
    { onProgress: events.onProgress, onState: events.onState },
  )
}
