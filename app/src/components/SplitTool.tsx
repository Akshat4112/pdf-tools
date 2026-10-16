/**
 * Split PDF tool screen — PT-CORE-005.
 *
 * Composes the PT-CORE-004 flow with the shared screens:
 * - S1/S2: single-PDF FileSelection (PT-UX-002)
 * - configure: split mode (ranges / every N / one per page) with live
 *   preview of the resulting parts (PT-PD-002 §4: understand before run)
 * - S4: PreviewPanel states the part count and coverage before confirming
 * - S5/S6/S7: shared processing/result/failure panels; result is the ZIP
 * Session lifecycle per PT-PD-003: memory-only; Start over clears everything.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import {
  CancelledPanel,
  FailurePanel,
  ProcessingPanel,
  PreviewPanel,
  ResultPanel,
} from './ToolScreens'
import { phaseFromJobState } from './screenPhase'
import { startSplit, resolveSplitGroups, type SplitMode } from '../tools/splitFlow'
import { FileSession } from '../session/fileSession'
import { getTool, type ToolError } from '../registry'
import type { Job, JobProgress } from '../jobs/orchestrator'
import type { VerifiedOutput } from '../outputs/verify'

const MODES: Array<{ id: SplitMode; label: string; hint: string }> = [
  { id: 'ranges', label: 'Custom ranges', hint: 'e.g. 1-5, 8, 12-30 — one PDF per range' },
  { id: 'every', label: 'Every N pages', hint: 'fixed-size chunks covering the whole document' },
  { id: 'single', label: 'One file per page', hint: 'every page becomes its own PDF' },
]

export function SplitTool({ onExit }: { onExit?: () => void }) {
  const tool = getTool('split')
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [mode, setMode] = useState<SplitMode>('ranges')
  const [rangesExpr, setRangesExpr] = useState('')
  const [everyN, setEveryN] = useState(1)
  const [job, setJob] = useState<Job<never, VerifiedOutput> | null>(null)
  const [progress, setProgress] = useState<JobProgress>({ fraction: 0 })
  const [result, setResult] = useState<VerifiedOutput[] | null>(null)
  const [error, setError] = useState<ToolError | null>(null)

  const session = useMemo(() => new FileSession(), [])

  const selected = files.find((f) => !f.error)
  const phase = phaseFromJobState(job?.state ?? null)

  /** Live plan preview from the pure layer — same code the flow runs. */
  const preview = useMemo(() => {
    if (!selected) return null
    return (async () => {
      try {
        const { openDocument } = await import('../engines/pdfjs')
        const doc = await openDocument(selected.bytes)
        const pageCount = doc.numPages
        await doc.destroy()
        const groups = resolveSplitGroups(
          {
            file: { displayName: selected.displayName, bytes: selected.bytes },
            mode,
            rangesExpr,
            everyN,
          },
          pageCount,
        )
        if (mode === 'ranges' && groups.length === 1) {
          return { pageCount, groups, warning: 'One range produces a single file — add another range or use Extract pages.' }
        }
        return { pageCount, groups, warning: undefined as string | undefined }
      } catch (e) {
        return { error: e as ToolError }
      }
    })()
  }, [selected, mode, rangesExpr, everyN])

  interface SplitPlan {
    pageCount?: number
    groups?: number[][]
    warning?: string
    error?: ToolError
  }
  const [plan, setPlan] = useState<SplitPlan | null>(null)

  // resolve the live preview through the same pure layer the flow runs
  useEffect(() => {
    let cancelled = false
    void preview?.then((p) => {
      if (!cancelled) setPlan(p ?? null)
    })
    return () => { cancelled = true }
  }, [preview])

  const run = useCallback(() => {
    if (!selected) return
    setError(null)
    setResult(null)
    const j = startSplit(
      {
        file: { displayName: selected.displayName, bytes: selected.bytes },
        mode,
        rangesExpr: mode === 'ranges' ? rangesExpr : undefined,
        everyN: mode === 'every' ? everyN : undefined,
      },
      { onProgress: setProgress },
    )
    void j.completion.then(() => {
      if (j.state === 'done' && j.result) setResult([j.result])
      if (j.state === 'failed' && j.error) setError(j.error)
    })
    setJob(j as unknown as Job<never, VerifiedOutput>)
  }, [selected, mode, rangesExpr, everyN])

  const download = useCallback(
    (out: VerifiedOutput) => {
      const stored = session.addOutput(out.name, out.mimeType, out.bytes)
      const url = session.objectUrlFor(stored.id)
      const a = document.createElement('a')
      a.href = url
      a.download = stored.name
      a.click()
    },
    [session],
  )

  const reset = useCallback(() => {
    session.resetSession()
    setFiles([])
    setJob(null)
    setResult(null)
    setError(null)
    setProgress({ fraction: 0 })
    setPlan(null)
  }, [session])

  const canRun =
    Boolean(selected && plan && !plan.error && !plan.warning && (plan.groups?.length ?? 0) > 0)

  const modeFieldInvalid = plan?.error !== undefined

  return (
    <div className="tool-screen">
      <header className="tool-header">
        <h1 className="tool-heading">{tool.title}</h1>
        <p className="tool-subtitle">{tool.description}</p>
      </header>

      {phase === 'configure' || phase === 'preview' ? (
        <>
          <FileSelection
            expected="pdf"
            multiple={false}
            files={files}
            onChange={setFiles}
          />

          {selected ? (
            <section className="panel" aria-label="Split configuration">
              <h2 className="panel-title">How should it be split?</h2>
              <div className="split-modes" role="radiogroup" aria-label="Split mode">
                {MODES.map((m) => (
                  <label key={m.id} className={`split-mode${mode === m.id ? ' is-active' : ''}`}>
                    <input
                      type="radio"
                      name="split-mode"
                      value={m.id}
                      checked={mode === m.id}
                      onChange={() => setMode(m.id)}
                    />
                    <span>{m.label}</span>
                    <small>{m.hint}</small>
                  </label>
                ))}
              </div>

              {mode === 'ranges' ? (
                <div className="split-field">
                  <label htmlFor="split-ranges">Ranges (comma separated)</label>
                  <input
                    id="split-ranges"
                    type="text"
                    inputMode="numeric"
                    placeholder="1-5, 8, 12-30"
                    value={rangesExpr}
                    onChange={(e) => setRangesExpr(e.target.value)}
                    aria-invalid={modeFieldInvalid}
                  />
                </div>
              ) : null}

              {mode === 'every' ? (
                <div className="split-field">
                  <label htmlFor="split-every">Pages per file</label>
                  <input
                    id="split-every"
                    type="number"
                    min={1}
                    max={plan?.pageCount ?? 300}
                    value={everyN}
                    onChange={(e) => setEveryN(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
              ) : null}
            </section>
          ) : null}

          <PreviewPanel
            title="Split preview"
            summary={
              !selected
                ? 'Select a PDF to split. It is processed entirely on your device.'
                : plan?.error
                  ? plan.error.message
                  : plan?.warning
                    ? plan.warning
                    : plan
                      ? `${plan.groups?.length ?? 0} file${(plan.groups?.length ?? 0) === 1 ? '' : 's'} from a ${plan.pageCount}-page document, zipped into one download.`
                      : 'Reading the document…'
                    }
                    details={
                    plan && !plan.error && !plan.warning && plan.groups
                    ? [
                        `Parts: ${plan.groups.map((g: number[]) => (g.length === 1 ? `${g[0]}` : `${g[0]}–${g[g.length - 1]}`)).join(', ')}`,
                        'A new ZIP is created; your original stays untouched.',
                      ]
                    : undefined
                    }
            actionLabel="Split PDF"
            onConfirm={run}
            disabled={!canRun}
            disabledReason={
              !selected
                ? 'No file selected yet.'
                : plan?.error
                  ? 'Fix the split configuration above.'
                  : plan?.warning
                    ? 'This configuration would not split anything.'
                    : 'Reading the document…'
            }
            onCancel={onExit}
          />
        </>
      ) : null}

      {phase === 'processing' && job ? (
        <ProcessingPanel label="Splitting your PDF" progress={progress} onCancel={() => job.cancel()} />
      ) : null}

      {phase === 'result' && result ? (
        <ResultPanel outputs={result} onDownload={download} onRetry={reset} onReset={reset} />
      ) : null}

      {phase === 'failed' && error ? (
        <FailurePanel error={error} onRetry={run} onReset={reset} />
      ) : null}

      {phase === 'cancelled' && job ? <CancelledPanel onReset={reset} /> : null}
    </div>
  )
}
