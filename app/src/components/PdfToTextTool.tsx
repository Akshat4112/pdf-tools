import { useLocale } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import { CancelledPanel, FailurePanel, PreviewPanel, ProcessingPanel, ResultPanel } from './ToolScreens'
import { phaseFromJobState } from './screenPhase'
import { FileSession } from '../session/fileSession'
import { startPdfToText, type PdfToTextInput, type PdfToTextOutcome } from '../tools/pdfToTextFlow'
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { ToolError } from '../registry'
import type { VerifiedOutput } from '../outputs/verify'

export function PdfToTextTool({ onExit }: { onExit(): void }) {
  const { t } = useLocale()
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [state, setState] = useState<JobState | null>(null), [progress, setProgress] = useState<JobProgress>({ fraction: 0 })
  const [result, setResult] = useState<PdfToTextOutcome | null>(null), [error, setError] = useState<ToolError | null>(null)
  const [session] = useState(() => new FileSession())
  const job = useRef<Job<PdfToTextInput, PdfToTextOutcome> | null>(null), active = useRef(true)
  const selected = files.find(file => !file.error), phase = phaseFromJobState(state)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; job.current?.cancel(); job.current = null; session.resetSession() }
  }, [session])
  const adjust = useCallback(() => {
    const previous = job.current; job.current = null; previous?.cancel(); session.resetSession()
    setState(null); setResult(null); setError(null); setProgress({ fraction: 0 })
  }, [session])
  const changeFiles = (next: WorkspaceFile[]) => { adjust(); setFiles(next) }
  const reset = () => changeFiles([])
  const run = () => {
    if (!selected) return
    adjust()
    const next = startPdfToText({ file: { displayName: selected.displayName, bytes: selected.bytes } }, {
      onProgress: value => { if (active.current && job.current === next) setProgress(value) },
      onState: value => { if (active.current && job.current === next) setState(value) },
    })
    job.current = next; session.jobs.track(next); setState(next.state)
    void next.completion.then(() => {
      if (!active.current || job.current !== next) return
      if (next.state === 'done' && next.result) setResult(next.result)
      if (next.state === 'failed' && next.error) setError(next.error)
    })
  }
  const download = (output: VerifiedOutput) => {
    if (!output.verified) return
    const stored = session.listOutputs().find(item => item.name === output.name) ?? session.addOutput(output.name, output.mimeType, output.bytes)
    const anchor = document.createElement('a'); anchor.href = session.objectUrlFor(stored.id); anchor.download = stored.name; anchor.click()
  }
  return <div className="tool-screen pdf-to-text-tool">
    <header className="tool-header"><h1 className="tool-heading">{t("PDF to text")}</h1><p className="tool-subtitle">{t("Download the existing text layer as a UTF-8 text file, entirely on your device.")}</p></header>
    <p className="panel-hint">Text follows the PDF's stored order. Columns, tables, ligatures and unusual fonts can affect reading order or characters. This preserves available text; it does not reconstruct the page layout. Pages are separated by a form-feed character (\f), which some editors display as a page break.</p>
    {phase === 'configure' ? <><FileSelection expected="pdf" multiple={false} files={files} onChange={changeFiles} labels={{ limits: 'PDF up to 50 MB / 300 pages · text output up to 50 MB · processed locally' }} /><PreviewPanel title="Export available text" summary="All pages will be checked. Pages without text are reported, and their places are retained in the file. Image-only PDFs need OCR, which is planned for a later release." actionLabel="Export text" onConfirm={run} onCancel={onExit} disabled={!selected} disabledReason="Choose a valid PDF first." /></> : null}
    {phase === 'processing' ? <ProcessingPanel label="Extracting PDF text" progress={progress} onCancel={() => job.current?.cancel()} /> : null}
    {phase === 'failed' && error ? <FailurePanel error={error} onRetry={adjust} onReset={reset} /> : null}
    {phase === 'cancelled' ? <CancelledPanel onReset={reset} onAdjust={adjust} /> : null}
    {phase === 'result' && result ? <>
      {result.kind === 'no-text' ? <section className="panel" aria-label="OCR needed" role="status"><h2 className="panel-title">{t("No text layer found")}</h2><p className="panel-summary">None of the {result.totalPages} pages has extractable text. Scanned or image-only pages need OCR. OCR comes in a later release; no blank text file was created.</p><div className="panel-actions"><button className="btn-ghost" onClick={adjust}>{t("Choose another PDF")}</button><button className="btn-ghost" onClick={reset}>{t("Start over")}</button><button className="btn-ghost" onClick={onExit}>{t("Back to all tools")}</button></div></section> : <>
        <section className="panel" aria-label="Text extraction report"><h2 className="panel-title">{t("Text availability")}</h2><p className="panel-summary">{result.pagesWithText} of {result.totalPages} pages contain text.</p>{result.pagesWithoutText.length ? <><p role="note">{result.pagesWithoutText.length} pages have no extractable text. They may be blank or need OCR. Their page positions are retained with form-feed separators.</p><details><summary>{t("Pages without text")}</summary><p className="text-missing-pages">{result.pagesWithoutText.join(', ')}</p></details></> : null}<details><summary>Preview extracted text{result.previewTruncated ? ' (first 8,000 characters)' : ''}</summary><pre className="text-export-preview">{result.preview.replaceAll('\f', '\n\n[Page break]\n\n')}</pre>{result.previewTruncated ? <p className="panel-hint">{t("The download contains the full extracted text.")}</p> : null}</details></section>
        {result.output ? <ResultPanel outputs={[result.output]} onDownload={download} onRetry={adjust} retryLabel="Adjust settings" onReset={reset} onContinue={onExit} /> : null}
      </>}
    </> : null}
  </div>
}
