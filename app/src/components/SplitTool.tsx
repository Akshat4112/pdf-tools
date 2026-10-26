import { useLocale } from '../i18n'
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { VerifiedOutput } from '../outputs/verify'

const MODES: Array<{ id: SplitMode; label: string; hint: string }> = [
  { id: 'ranges', label: 'Custom ranges', hint: 'e.g. 1-5, 8, 12-30 — one PDF per range' },
  { id: 'every', label: 'Every N pages', hint: 'fixed-size chunks covering the whole document' },
  { id: 'single', label: 'One file per page', hint: 'every page becomes its own PDF' },
]

export function SplitTool({ onExit }: { onExit?: () => void }) {
  const { t } = useLocale()
  const tool = getTool('split')
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [mode, setMode] = useState<SplitMode>('ranges')
  const [rangesExpr, setRangesExpr] = useState('')
  const [everyN, setEveryN] = useState(1)
  const job = useRef<Job<never, VerifiedOutput> | null>(null)
  const active = useRef(true)
  const [state, setState] = useState<JobState | null>(null)
  const [progress, setProgress] = useState<JobProgress>({ fraction: 0 })
  const [result, setResult] = useState<VerifiedOutput[] | null>(null)
  const [error, setError] = useState<ToolError | null>(null)

  const session = useMemo(() => new FileSession(), [])
  useEffect(() => {
    active.current = true
    return () => { active.current = false; job.current = null; session.resetSession() }
  }, [session])

  const selected = files.find((f) => !f.error)
  const phase = phaseFromJobState(state)

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
  const [planState, setPlan] = useState<{ source: typeof preview; value: SplitPlan } | null>(null)
  const plan = planState?.source === preview ? planState?.value : null

  // resolve the live preview through the same pure layer the flow runs
  useEffect(() => {
    let cancelled = false
    void preview?.then((p) => {
      if (!cancelled) setPlan({ source: preview, value: p })
    })
    return () => { cancelled = true }
  }, [preview])

  const run = useCallback(() => {
    if (!selected || !plan || plan.error || plan.warning || !plan.groups?.length) return
    const old = job.current
    job.current = null
    old?.cancel()
    session.resetSession()
    setError(null)
    setResult(null)
    setProgress({ fraction: 0 })
    const j = startSplit(
      {
        file: { displayName: selected.displayName, bytes: selected.bytes },
        mode,
        rangesExpr: mode === 'ranges' ? rangesExpr : undefined,
        everyN: mode === 'every' ? everyN : undefined,
      },
      {
        onProgress: value => { if (active.current && job.current === j) setProgress(value) },
        onState: () => { if (active.current && job.current === j) setState(j.state) },
      },
    )
    session.jobs.track(j)
    void j.completion.then(() => {
      if (!active.current || job.current !== j) return
      if (j.state === 'done' && j.result) setResult([j.result])
      if (j.state === 'failed' && j.error) setError(j.error)
    })
    job.current = j as unknown as Job<never, VerifiedOutput>
    setState(j.state)
  }, [selected, mode, rangesExpr, everyN, session, plan])

  const download = useCallback(
    (out: VerifiedOutput) => {
      const stored = session.listOutputs().find(item => item.name === out.name) ?? session.addOutput(out.name, out.mimeType, out.bytes)
      const url = session.objectUrlFor(stored.id)
      const a = document.createElement('a')
      a.href = url
      a.download = stored.name
      a.click()
    },
    [session],
  )

  const adjust = useCallback(() => {
    const old = job.current
    job.current = null
    old?.cancel()
    session.resetSession()
    setState(null)
    setResult(null)
    setError(null)
    setProgress({ fraction: 0 })
  }, [session])

  const reset = useCallback(() => {
    adjust()
    setFiles([])
    setPlan(null)
  }, [adjust])

  const canRun =
    Boolean(selected && plan && !plan.error && !plan.warning && (plan.groups?.length ?? 0) > 0)

  const modeFieldInvalid = plan?.error !== undefined

  return (
    <div className="tool-screen">
      <header className="tool-header">
        <h1 className="tool-heading">{t(tool.title)}</h1>
        <p className="tool-subtitle">{t(tool.description)}</p>
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
              <h2 className="panel-title">{t("How should it be split?")}</h2>
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
                    <span>{t(m.label)}</span>
                    <small>{t(m.hint)}</small>
                  </label>
                ))}
              </div>

              {mode === 'ranges' ? (
                <div className="split-field">
                  <label htmlFor="split-ranges">{t("Ranges (comma separated)")}</label>
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
                  <label htmlFor="split-every">{t("Pages per file")}</label>
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
            title={t("Split preview")}
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

      {phase === 'processing' ? (
        <ProcessingPanel label="Splitting your PDF" progress={progress} onCancel={() => job.current?.cancel()} />
      ) : null}

      {phase === 'result' && result ? (
        <ResultPanel outputs={result} onDownload={download} onRetry={adjust} retryLabel="Adjust settings" onContinue={onExit} onReset={reset} />
      ) : null}

      {phase === 'failed' && error ? (
        <FailurePanel error={error} onRetry={adjust} onReset={reset} />
      ) : null}

      {phase === 'cancelled' ? <CancelledPanel onReset={reset} onAdjust={adjust} /> : null}
    </div>
  )
}
