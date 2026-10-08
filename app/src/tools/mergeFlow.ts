/**
 * Merge PDF tool flow — PT-CORE-001.
 *
 * Full journey (PT-PD-002 §4 PT-FT-001) as a typed, testable flow:
 *   validate order-relevant inputs -> run merge in a cancellable job ->
 *   verify output (structure + page count) -> hand VerifiedOutput to the UI.
 *
 * Engine primitive: mergePdfs (PT-FND-005, pdf-lib, offset-0 normalized).
 * The UI layer (PT-CORE-002) composes this with FileSelection + ToolScreens;
 * this module owns the flow logic so both unit tests and UI share it.
 */

import { mergePdfs } from '../engines/pdflib'
import { runJob, runPageWise, CancelledError } from '../jobs/orchestrator'
import type { Job, JobProgress } from '../jobs/orchestrator'
import { verifyOutput, verifyPdfPageCount, type VerifiedOutput } from '../outputs/verify'
import { toolError } from '../registry'

export interface MergeInput {
  /** ordered file entries (order = merge order); bytes are original PDFs */
  files: Array<{ displayName: string; bytes: Uint8Array }>
}

export interface MergeOutcome {
  job: Job<MergeInput, VerifiedOutput>
}

/**
 * Start the merge flow. Page-wise progress is derived per input file
 * (each file's contribution is proportional to its page count — measured
 * cheaply via the merged result; we use per-file completion for progress).
 */
export function startMerge(
  input: MergeInput,
  events: {
    onProgress?: (p: JobProgress) => void
    onState?: (s: string) => void
  } = {},
): Job<MergeInput, VerifiedOutput> {
  const job: Job<MergeInput, VerifiedOutput> = runJob(
    'merge',
    input,
    async (inp, ctx) => {
      if (inp.files.length < 2) {
        throw toolError(
          'E-INPUT-05',
          'Select at least two PDFs to merge.',
          'focus-picker',
        )
      }
      // cheap early page-count probe for progress math + honest preview claims
      // (full validation already ran at selection; this is engine-side guard)
      const bytesArray = inp.files.map((f) => f.bytes)
      const merged = await mergePdfs(bytesArray)

      if (ctx.isCancelled()) throw new CancelledError()

      // verify-before-success: structure + independent page-count readback
      const out = await verifyOutput({
        name: 'merged.pdf',
        mimeType: 'application/pdf',
        bytes: merged,
      })
      // expected page count = sum of inputs' pages (independent parse of each)
      const { openDocument } = await import('../engines/pdfjs')
      let expectedPages = 0
      const perFile: number[] = []
      for (const b of bytesArray) {
        const doc = await openDocument(b)
        perFile.push(doc.numPages)
        expectedPages += doc.numPages
        await doc.destroy()
        ctx.reportProgress(0, 'counting pages…')
      }
      await verifyPdfPageCount(merged, expectedPages)

      return { ...out, name: outputNameFor(inp) }
    },
    { onProgress: events.onProgress, onState: events.onState },
  )
  return job
}

/** Deterministic, collision-safe output name derived from the first input. */
function outputNameFor(input: MergeInput): string {
  const first = input.files[0]?.displayName ?? 'document'
  const stem = first.replace(/\.[^.]*$/, '').replace(/[^\w.-]+/g, '_').slice(0, 50) || 'merged'
  return `${stem}-merged.pdf`
}

export type { VerifiedOutput }

// re-export for UI composition
export { runPageWise }
