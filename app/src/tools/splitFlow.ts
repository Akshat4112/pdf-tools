/**
 * Split PDF tool flow — PT-CORE-004.
 *
 * Full journey (PT-PD-002 §4 PT-FT-002) as a typed, testable flow:
 *   parse the split mode -> resolve page groups (shared range module,
 *   PT-CORE-003) -> run splits in a cancellable job with a BOUND output
 *   count -> verify EVERY output (structure + independent page-count
 *   readback against its own group) -> deterministic ZIP packaging.
 *
 * Modes (PT-FT-002): 'ranges' | 'every' | 'single'
 * - ranges: explicit groups from a comma expression, order preserved
 * - every:  fixed chunk size covering the whole document (short tail allowed)
 * - single: one PDF per page
 *
 * The UI layer (PT-CORE-005) composes this flow with the shared screens;
 * this module owns flow logic so unit tests and the UI share one truth.
 */

import { splitPdf } from '../engines/pdflib'
import { parseRangeGroups, splitEveryN, splitOnePerPage } from '../lib/pageRanges'
import { runJob, CancelledError } from '../jobs/orchestrator'
import type { Job, JobProgress } from '../jobs/orchestrator'
import { buildZip, verifyOutput, verifyPdfPageCount, zipEntryName, type VerifiedOutput } from '../outputs/verify'
import { openDocument } from '../engines/pdfjs'
import { QUOTAS, toolError } from '../registry'

export type SplitMode = 'ranges' | 'every' | 'single'

export interface SplitInput {
  /** original PDF bytes (never mutated — a copy is written) */
  file: { displayName: string; bytes: Uint8Array }
  mode: SplitMode
  /** mode 'ranges': comma expression like '1-5, 8, 12-30'; ignored otherwise */
  rangesExpr?: string
  /** mode 'every': chunk size; ignored otherwise */
  everyN?: number
}

/** Resolved 1-based page groups for a split request (pure — unit tested). */
export function resolveSplitGroups(input: SplitInput, pageCount: number): number[][] {
  switch (input.mode) {
    case 'ranges':
      return parseRangeGroups(input.rangesExpr ?? '', pageCount)
    case 'every':
      return splitEveryN(pageCount, input.everyN ?? 0)
    case 'single':
      return splitOnePerPage(pageCount)
    default:
      throw toolError('E-CONFIG-01', 'Unknown split mode.', 'fix-field')
  }
}

export interface SplitOutcome extends VerifiedOutput {
  /** the ZIP with all split parts; parts were each verified before packing */
}

/**
 * Deterministic ZIP + entry names derived from the input file name
 * (collision-safe within the archive — PT-FND-007 naming).
 */
function namesFor(input: SplitInput, total: number) {
  const stem = (input.file.displayName ?? 'document')
    .replace(/\.[^.]*$/, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 50) || 'document'
  return {
    zipName: `${stem}-split.zip`,
    entryName: (i: number) => zipEntryName(stem, i + 1, total, 'pdf'),
  }
}

/**
 * Start the split flow. Progress is per output part. Output count is bounded
 * by QUOTAS.maxPages (PT-SP-002 quota mirrored for split parts).
 */
export function startSplit(
  input: SplitInput,
  events: {
    onProgress?: (p: JobProgress) => void
    onState?: (s: string) => void
  } = {},
): Job<SplitInput, VerifiedOutput> {
  return runJob(
    'split',
    input,
    async (inp, ctx) => {
      // page count probe (independent reader) — also validates the PDF early
      const doc = await openDocument(inp.file.bytes)
      const pageCount = doc.numPages
      await doc.destroy()
      if (pageCount < 1) {
        throw toolError('E-INPUT-03', 'This PDF has no pages.', 'retry-file')
      }

      // resolve groups from the shared range module (single source of truth)
      const groups = resolveSplitGroups(inp, pageCount)
      if (groups.length === 0) {
        throw toolError('E-INPUT-05', 'Select at least one range to continue.', 'focus-picker')
      }
      if (groups.length > QUOTAS.maxPages) {
        throw toolError(
          'E-INPUT-04',
          `This split would create ${groups.length} files; the current limit is ${QUOTAS.maxPages}.`,
          'show-limits',
        )
      }
      // a single group is a plain extract, not a split — point the user at it
      if (groups.length === 1 && inp.mode === 'ranges') {
        throw toolError(
          'E-CONFIG-01',
          'One range produces a single file. Add another range, or use Extract pages for one document.',
          'fix-field',
        )
      }

      const { zipName, entryName } = namesFor(inp, groups.length)

      // engine pass — one output per group, order preserved
      const parts = await splitPdf(inp.file.bytes, groups)
      if (ctx.isCancelled()) throw new CancelledError()

      // verify EVERY part before success: structure + page count == group size
      const verifiedParts: Array<{ name: string; bytes: Uint8Array }> = []
      for (let i = 0; i < parts.length; i++) {
        const v = await verifyOutput({
          name: entryName(i),
          mimeType: 'application/pdf',
          bytes: parts[i],
        })
        await verifyPdfPageCount(parts[i], groups[i].length)
        verifiedParts.push({ name: v.name, bytes: v.bytes })
        ctx.reportProgress((i + 1) / (parts.length + 1), `verifying part ${i + 1} of ${parts.length}…`)
      }

      // deterministic ZIP packaging of verified parts
      const zipBytes = await buildZip(
        verifiedParts.map((p) => ({ name: p.name, bytes: p.bytes, mimeType: 'application/pdf' })),
      )
      const out = await verifyOutput({
        name: zipName,
        mimeType: 'application/zip',
        bytes: zipBytes,
      })
      return out
    },
    { onProgress: events.onProgress, onState: events.onState },
  )
}
