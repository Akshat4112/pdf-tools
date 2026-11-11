import { useLocale } from '../i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import { PageThumbnail } from './PageThumbnail'
import { CancelledPanel, FailurePanel, PreviewPanel, ProcessingPanel, ResultPanel } from './ToolScreens'
import { phaseFromJobState } from './screenPhase'
import { FileSession } from '../session/fileSession'
import { openDocument, type PdfjsDocument } from '../engines/pdfjs'
import { getTool, type ToolError } from '../registry'
import { parsePageRanges } from '../lib/pageRanges'
import { startExtract, type ExtractInput } from '../tools/extractFlow'
import { startDelete } from '../tools/deleteFlow'
import { deletionReviewKey, pageSelectionPlan, togglePage, type PageSelectionMode } from '../tools/pageSelectionPlan'
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { VerifiedOutput } from '../outputs/verify'

/** Loaded with the page-selection workspace, not the catalog startup bundle. */
const DELETE_DE: Readonly<Record<string, string>> = {
  'Choose pages to remove': 'Zu entfernende Seiten auswählen',
  'Selected pages will be removed from a new copy. Keep at least one page.': 'Die markierten Seiten werden aus einer neuen Kopie entfernt. Mindestens eine Seite muss bleiben.',
  'Delete configuration': 'Einstellungen zum Entfernen',
  'Pages to remove': 'Zu entfernende Seiten',
  'Deletion preview': 'Vorschau der entfernten Seiten',
  'Create copy without selected pages': 'Kopie ohne markierte Seiten erstellen',
  'Choose a PDF to select pages. Processing stays on your device.': 'Wähle ein PDF und markiere Seiten. Die Verarbeitung bleibt auf deinem Gerät.',
  'Choose a valid page selection to review the new copy.': 'Wähle gültige Seiten aus, um die neue Kopie zu prüfen.',
  'Review the output order and confirm removal below.': 'Prüfe die Reihenfolge und bestätige unten das Entfernen.',
  'Choose a valid page selection above.': 'Markiere oben gültige Seiten.',
  'Removing selected pages': 'Markierte Seiten werden entfernt',
  'Your original file stays untouched. Changes can invalidate digital signatures.': 'Dein Original bleibt unverändert. Änderungen können digitale Signaturen ungültig machen.',
  'Reading the document…': 'Dokument wird gelesen …',
  'This PDF has no pages.': 'Dieses PDF hat keine Seiten.',
}

const THUMBNAILS_PER_VIEW = 8

export function PageSelectionTool({ mode, onExit }: { mode: PageSelectionMode; onExit?: () => void }) {
  const { t: baseT, locale } = useLocale()
  const germanDelete = locale === 'de' && mode === 'delete-pages'
  const t = (message: string) => germanDelete ? (DELETE_DE[message] ?? baseT(message)) : baseT(message)
  const tool = getTool(mode)
  const deleting = mode === 'delete-pages'
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [expression, setExpression] = useState('')
  const [documentState, setDocumentState] = useState<{ fileId: number; doc?: PdfjsDocument; error?: ToolError } | null>(null)
  const [viewStart, setViewStart] = useState(0)
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const [state, setState] = useState<JobState | null>(null)
  const [progress, setProgress] = useState<JobProgress>({ fraction: 0 })
  const [result, setResult] = useState<VerifiedOutput | null>(null)
  const [error, setError] = useState<ToolError | null>(null)
  const [session] = useState(() => new FileSession())
  const job = useRef<Job<ExtractInput, VerifiedOutput> | null>(null)
  const active = useRef(true)
  const selected = files.find((f) => !f.error)
  // An old document is never usable after replacement, even before effects run.
  const doc = selected && documentState?.fileId === selected.id ? documentState.doc : undefined
  const readError = selected && documentState?.fileId === selected.id ? documentState.error : undefined
  const phase = phaseFromJobState(state)

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      job.current?.cancel()
      job.current = null
      session.resetSession()
    }
  }, [session])

  useEffect(() => {
    if (!selected) return
    let disposed = false
    let loaded: PdfjsDocument | undefined
    void openDocument(selected.bytes).then((document) => {
      loaded = document
      if (disposed) { void document.destroy().catch(() => {}); return }
      setDocumentState({ fileId: selected.id, doc: document })
    }).catch((e: ToolError) => {
      if (!disposed) setDocumentState({ fileId: selected.id, error: e })
    })
    return () => {
      disposed = true
      if (loaded) void loaded.destroy().catch(() => {})
    }
  }, [selected])

  const selection = useMemo(() => {
    if (!doc) return { pages: [] as number[], output: [] as number[] }
    try {
      const plan = pageSelectionPlan(mode, expression, doc.numPages)
      return { pages: plan.selected, output: plan.output }
    } catch (e) {
      // Keep thumbnail highlights for an all-delete plan so users can deselect.
      let pages: number[] = []
      try { pages = parsePageRanges(expression, doc.numPages).pages } catch { /* invalid input */ }
      return { pages, output: [] as number[], error: e as ToolError }
    }
  }, [doc, expression, mode])
  const picked = new Set(selection.pages)
  const reviewKey = selected ? deletionReviewKey(selected.id, selection.pages) : null
  const valid = Boolean(doc && !selection.error && selection.output.length)
  const canRun = valid && (!deleting || confirmed === reviewKey)

  const resetJob = useCallback(() => {
    const old = job.current
    job.current = null
    old?.cancel()
    session.resetSession()
    setState(null)
    setResult(null)
    setError(null)
    setProgress({ fraction: 0 })
    setConfirmed(null)
  }, [session])

  const changeFiles = useCallback((next: WorkspaceFile[]) => {
    resetJob()
    setDocumentState(null)
    setFiles(next)
    setExpression('')
    setViewStart(0)
  }, [resetJob])

  const updateExpression = (value: string) => {
    setExpression(value)
    setConfirmed(null)
  }

  const run = () => {
    if (!canRun || !selected) return
    setError(null)
    setResult(null)
    setProgress({ fraction: 0 })
    const start = deleting ? startDelete : startExtract
    const next = start({ file: { displayName: selected.displayName, bytes: selected.bytes }, pagesExpr: expression }, {
      onProgress: (value) => { if (active.current && job.current === next) setProgress(value) },
      onState: () => { if (active.current && job.current === next) setState(next.state) },
    })
    job.current = next
    setState(next.state)
    session.jobs.track(next)
    void next.completion.then(() => {
      if (!active.current || job.current !== next) return
      if (next.state === 'done' && next.result) setResult(next.result)
      if (next.state === 'failed' && next.error) setError(next.error)
    })
  }

  const download = (output: VerifiedOutput) => {
    const stored = session.listOutputs()[0] ?? session.addOutput(output.name, output.mimeType, output.bytes)
    const a = document.createElement('a')
    a.href = session.objectUrlFor(stored.id)
    a.download = stored.name
    a.click()
  }
  const reset = () => changeFiles([])

  return (
    <div className="tool-screen page-selection-tool">
      <header className="tool-header">
        <h1 className="tool-heading">{t(tool.title)}</h1>
        <p className="tool-subtitle">{t(tool.description)}</p>
      </header>
      {phase === 'configure' ? (
        <>
          <FileSelection expected="pdf" multiple={false} files={files} onChange={changeFiles} />
          {selected ? (
            <section className="panel" aria-label={t(deleting ? 'Delete configuration' : 'Extract configuration')}>
              <h2 className="panel-title">{t(deleting ? 'Choose pages to remove' : 'Choose pages to extract')}</h2>
              <p className="panel-summary">{t(deleting ? 'Selected pages will be removed from a new copy. Keep at least one page.' : 'Pick thumbnails or enter ranges. Pages are extracted in the order you choose.')}</p>
              <div className="page-range-field">
                <label htmlFor="page-selection">{t(deleting ? 'Pages to remove' : 'Pages to extract')}</label>
                <input id="page-selection" type="text" inputMode="text" value={expression} placeholder="3, 1, 5-8"
                  onChange={(e) => updateExpression(e.target.value)} disabled={!doc}
                  aria-invalid={Boolean(selection.error && expression.trim())} aria-describedby="page-selection-help page-selection-status" />
                <p id="page-selection-help" className="panel-hint">{t("Use page numbers and ranges, separated by commas. Repeated pages are included once.")}</p>
              </div>
              {doc ? (
                <>
                  <div className="panel-actions">
                    <button type="button" className="btn-ghost" onClick={() => updateExpression(`1-${doc.numPages}`)}>{t("Select all pages")}</button>
                    <button type="button" className="btn-ghost" onClick={() => updateExpression('')}>{t("Clear page selection")}</button>
                  </div>
                  <div className="page-grid" role="group" aria-label={t(deleting ? 'Pages to remove' : 'Pages to extract')}>
                    {Array.from({ length: Math.min(THUMBNAILS_PER_VIEW, doc.numPages - viewStart) }, (_, i) => viewStart + i + 1).map((page) => (
                      <PageThumbnail key={`${selected.id}:${page}`} doc={doc} pageNumber={page} selected={picked.has(page)} deleting={deleting}
                        label={germanDelete ? `Seite ${page}` : undefined} caption={germanDelete ? `Seite ${page}` : undefined}
                        onToggle={() => updateExpression(togglePage(expression, page, doc.numPages))} />
                    ))}
                  </div>
                  <nav className="page-pagination" aria-label={t("Thumbnail pages")}>
                    <button type="button" className="btn-ghost" disabled={viewStart === 0} onClick={() => setViewStart((p) => p - THUMBNAILS_PER_VIEW)}>{t("Previous pages")}</button>
                    <span>{germanDelete ? `Seiten ${viewStart + 1}–${Math.min(viewStart + THUMBNAILS_PER_VIEW, doc.numPages)} von ${doc.numPages}` : `Pages ${viewStart + 1}–${Math.min(viewStart + THUMBNAILS_PER_VIEW, doc.numPages)} of ${doc.numPages}`}</span>
                    <button type="button" className="btn-ghost" disabled={viewStart + THUMBNAILS_PER_VIEW >= doc.numPages} onClick={() => setViewStart((p) => p + THUMBNAILS_PER_VIEW)}>{t("Next pages")}</button>
                  </nav>
                </>
              ) : null}
              <p id="page-selection-status" className="page-selection-status" role={readError ? 'alert' : 'status'}>
                {readError ? t(readError.message) : !doc ? t('Reading the document…') : selection.error ? t(selection.error.message) : germanDelete ? `${selection.pages.length} ausgewählt · ${selection.output.length} Seiten im Ergebnis` : `${selection.pages.length} selected · ${selection.output.length} pages in the output`}
              </p>
            </section>
          ) : null}
          <PreviewPanel title={t(deleting ? 'Deletion preview' : 'Extraction preview')}
            summary={!selected ? t('Choose a PDF to select pages. Processing stays on your device.') : !valid ? t('Choose a valid page selection to review the new copy.') : germanDelete ? `Eine PDF-Datei mit ${selection.output.length} Seiten wird erstellt.` : `${selection.output.length}-page PDF will be created.`}
            details={valid ? [
              ...(deleting ? [germanDelete ? `Zu entfernende Seiten: ${selection.pages.join(', ')}` : `Pages to remove: ${selection.pages.join(', ')}`] : []),
              germanDelete ? `Reihenfolge im Ergebnis: ${selection.output.join(', ')}` : `Output order: ${selection.output.join(', ')}`, 
              t('Your original file stays untouched. Changes can invalidate digital signatures.'),
            ] : undefined}
            actionLabel={t(deleting ? 'Create copy without selected pages' : 'Extract pages')}
            disabled={!canRun} disabledReason={t(deleting && valid && confirmed !== reviewKey ? 'Review the output order and confirm removal below.' : 'Choose a valid page selection above.')}
            onConfirm={run} onCancel={onExit} />
          {deleting && valid ? (
            <label className="page-delete-confirmation">
              <input type="checkbox" checked={confirmed === reviewKey} onChange={(e) => setConfirmed(e.target.checked ? reviewKey : null)} />
              <span>{t("I reviewed the pages to remove and the output order. Create a new copy without those pages.")}</span>
            </label>
          ) : null}
        </>
      ) : null}
      {phase === 'processing' ? <ProcessingPanel label={t(deleting ? 'Removing selected pages' : 'Extracting selected pages')} progress={progress} onCancel={() => job.current?.cancel()} /> : null}
      {phase === 'result' && result ? <ResultPanel outputs={[result]} onDownload={download} onRetry={resetJob} retryLabel="Adjust settings" onReset={reset} onContinue={onExit} /> : null}
      {phase === 'failed' && error ? <FailurePanel error={error} onRetry={resetJob} onReset={reset} /> : null}
      {phase === 'cancelled' ? <CancelledPanel onReset={reset} onAdjust={resetJob} /> : null}
    </div>
  )
}
