import { useLocale } from '../i18n'
/**
 * Merge PDF tool screen — PT-CORE-002.
 *
 * First live tool: composes FileSelection (S1/S2), PreviewPanel (S4),
 * ProcessingPanel (S5), ResultPanel (S6), FailurePanel (S7), CancelledPanel.
 * Session lifecycle per PT-PD-003: outputs live in memory; Start over drops
 * everything (session.clearFiles) — audit zeros are asserted in tests.
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
import { startMerge, type VerifiedOutput } from '../tools/mergeFlow'
import { FileSession } from '../session/fileSession'
import { getTool } from '../registry'
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { ToolError } from '../registry'

export function MergeTool({ onExit }: { onExit?: () => void }) {
  const { t } = useLocale()
  const tool = getTool('merge')
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const job = useRef<Job<never, VerifiedOutput> | null>(null)
  const active = useRef(true)
  const [state, setState] = useState<JobState | null>(null)
  const [progress, setProgress] = useState<JobProgress>({ fraction: 0 })
  const [result, setResult] = useState<VerifiedOutput[] | null>(null)
  const [error, setError] = useState<ToolError | null>(null)

  // one session per screen mount; dropped on unmount (memory-only)
  const session = useMemo(() => new FileSession(), [])
  useEffect(() => {
    active.current = true
    return () => { active.current = false; job.current = null; session.resetSession() }
  }, [session])

  const valid = files.filter((f) => !f.error)
  const phase = phaseFromJobState(state)

  const run = useCallback(() => {
    const old = job.current
    job.current = null
    old?.cancel()
    session.resetSession()
    setError(null)
    setResult(null)
    setProgress({ fraction: 0 })
    const j = startMerge(
      { files: valid.map((f) => ({ displayName: f.displayName, bytes: f.bytes })) },
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
  }, [valid, session])

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
  }, [adjust])

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
            multiple
            files={files}
            onChange={setFiles}
          />
          <PreviewPanel
            title="Merge order"
            summary={
              valid.length >= 2
                ? `${valid.length} PDFs will be merged top to bottom, producing one document with their combined pages.`
                : 'Select at least two PDFs to merge. Files merge in the order shown — use the arrows to reorder.'
            }
            details={
              valid.length >= 2
                ? [
                    `Order: ${valid.map((f) => f.displayName).join(' → ')}`,
                    'A new file is created; your originals are untouched.',
                  ]
                : undefined
            }
            actionLabel="Merge PDFs"
            onConfirm={run}
            disabled={valid.length < 2}
            disabledReason={
              valid.length === 0
                ? 'No files selected yet.'
                : 'Add at least one more PDF to merge.'
            }
            onCancel={onExit}
          />
        </>
      ) : null}

      {phase === 'processing' ? (
        <ProcessingPanel label="Merging your PDFs" progress={progress} onCancel={() => job.current?.cancel()} />
      ) : null}

      {phase === 'result' && result ? (
        <ResultPanel
          outputs={result}
          onDownload={download}
          onRetry={adjust} retryLabel="Adjust settings" onContinue={onExit}
          onReset={reset}
        />
      ) : null}

      {phase === 'failed' && error ? (
        <FailurePanel error={error} onRetry={adjust} onReset={reset} />
      ) : null}

      {phase === 'cancelled' ? <CancelledPanel onReset={reset} onAdjust={adjust} /> : null}
    </div>
  )
}
