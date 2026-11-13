import { useLocale } from '../i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import { PageThumbnail } from './PageThumbnail'
import { PdfImagesResults } from './PdfImagesResults'
import { CancelledPanel, FailurePanel, PreviewPanel, ProcessingPanel } from './ToolScreens'
import { phaseFromJobState } from './screenPhase'
import { FileSession } from '../session/fileSession'
import { openDocument, type PdfjsDocument } from '../engines/pdfjs'
import { parsePageRanges } from '../lib/pageRanges'
import { togglePage } from '../tools/pageSelectionPlan'
import { DEFAULT_PDF_IMAGE_OPTIONS, normalizePdfImageOptions, planPdfImagePage, PDF_IMAGE_LIMITS, type PdfImageOptions, type PdfImagePagePlan } from '../tools/pdfImagePlan'
import { startPdfToImages, type PdfToImagesInput, type PdfToImagesOutcome } from '../tools/pdfToImagesFlow'
import { getTool, QUOTAS, type ToolError } from '../registry'
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { VerifiedOutput } from '../outputs/verify'
import { formatBytes } from './format'

const PDF_TO_JPG_DE: Readonly<Record<string, string>> = {
  'Render PDF pages as images, with no uploads. Your original PDF stays untouched.': 'PDF-Seiten ohne Upload als Bilder exportieren. Dein Original bleibt unverändert.',
  'Choose pages and image settings': 'Seiten und JPG-Einstellungen auswählen',
  'Image format': 'Bildformat',
  'Resolution': 'Auflösung',
  'JPG quality (%)': 'JPG-Qualität (%)',
  'Pages to convert': 'Umzuwandelnde Seiten',
  'Select all pages': 'Alle Seiten auswählen',
  'Clear page selection': 'Seitenauswahl aufheben',
  'Previous pages': 'Vorherige Seiten',
  'Next pages': 'Nächste Seiten',
  'Output dimensions and size estimate': 'Ausgabeabmessungen und Größenschätzung',
  'Create your images': 'JPG-Bilder erstellen',
  'Create images': 'JPG-Bilder erstellen',
  'Creating your images': 'JPG-Bilder werden erstellt',
  'Choose a valid PDF, page selection and image settings.': 'Wähle ein gültiges PDF und passende Seiten- und Bildeinstellungen.',
  'Wait for a valid page selection and dimension check.': 'Wähle gültige Seiten aus und prüfe die Bildabmessungen.',
  'Reading the PDF…': 'PDF wird gelesen …',
  'Checking image dimensions…': 'Bildabmessungen werden geprüft …',
  'PDF image settings': 'JPG-Einstellungen',
  'PDF page previews': 'PDF-Seitenvorschau',
  'PDF preview pages': 'Seiten der PDF-Vorschau',
  'Use page numbers and ranges separated by commas, in the order you want. Repeated pages are included once. Higher DPI makes larger images. JPG always has a white background; PNG can keep unpainted areas transparent.': 'Gib Seitenzahlen und Bereiche durch Kommas getrennt in der gewünschten Reihenfolge ein. Wiederholungen zählen nur einmal. Höhere DPI ergeben größere Dateien. JPG hat einen weißen Hintergrund.',
  'This is a pixel-memory estimate, not the encoded download size. Actual JPG/PNG size depends on content and quality and is shown after conversion. Encoded images are limited to 50 MB in total; the ZIP adds a small amount of overhead.': 'Dies ist eine Schätzung des unkomprimierten Speicherbedarfs, nicht der Downloadgröße. Die tatsächliche Größe hängt von Bildinhalt und Qualität ab. Insgesamt sind 50 MB Bilddaten erlaubt; das ZIP benötigt etwas mehr.',
  'The layout preview shows the page appearance. JPG compression can affect fine detail; actual encoded previews are shown after conversion.': 'Die Vorschau zeigt die Seitendarstellung. JPG-Komprimierung kann Details verändern. Die fertigen Bilder werden nach der Konvertierung angezeigt.',
  'This renders pages. It does not extract the original images embedded in the PDF.': 'Das Werkzeug rendert Seiten und extrahiert keine Originalbilder aus der PDF.',
}

export function PdfToImagesTool({ mode, onExit }: { mode: 'pdf-to-jpg' | 'pdf-to-png'; onExit?: () => void }) {
  const { t: baseT, locale } = useLocale()
  const germanJpg = locale === 'de' && mode === 'pdf-to-jpg'
  const t = (text: string) => germanJpg ? (PDF_TO_JPG_DE[text] ?? baseT(text)) : baseT(text)
  const initialFormat = mode === 'pdf-to-png' ? 'png' : 'jpeg'
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [expression, setExpression] = useState('')
  const [options, setOptions] = useState<PdfImageOptions>({ ...DEFAULT_PDF_IMAGE_OPTIONS, format: initialFormat })
  const [qualityText, setQualityText] = useState('80')
  const [documentState, setDocumentState] = useState<{ fileId: number; doc?: PdfjsDocument; error?: ToolError } | null>(null)
  const [planState, setPlanState] = useState<{ key: string; plans?: PdfImagePagePlan[]; error?: ToolError } | null>(null)
  const [viewStart, setViewStart] = useState(0)
  const [state, setState] = useState<JobState | null>(null)
  const [progress, setProgress] = useState<JobProgress>({ fraction: 0 })
  const [result, setResult] = useState<PdfToImagesOutcome | null>(null)
  const [error, setError] = useState<ToolError | null>(null)
  const [session] = useState(() => new FileSession())
  const job = useRef<Job<PdfToImagesInput, PdfToImagesOutcome> | null>(null)
  const active = useRef(true)
  const selected = files.find(file => !file.error)
  const doc = selected && documentState?.fileId === selected.id ? documentState.doc : undefined
  const readError = selected && documentState?.fileId === selected.id ? documentState.error : undefined
  const phase = phaseFromJobState(state)
  const tool = getTool(options.format === 'jpeg' ? 'pdf-to-jpg' : 'pdf-to-png')

  useEffect(() => {
    active.current = true
    return () => { active.current = false; job.current?.cancel(); job.current = null; session.resetSession() }
  }, [session])
  useEffect(() => {
    if (!selected) return
    let disposed = false, loaded: PdfjsDocument | undefined
    void openDocument(selected.bytes, { strict: true, maxCanvasBytes: PDF_IMAGE_LIMITS.maxPixels * 4 }).then(document => {
      loaded = document
      if (disposed) { void document.destroy().catch(() => {}); return }
      setDocumentState({ fileId: selected.id, doc: document })
      setExpression(document.numPages === 1 ? '1' : `1-${document.numPages}`)
    }).catch((error: ToolError) => { if (!disposed) setDocumentState({ fileId: selected.id, error }) })
    return () => { disposed = true; if (loaded) void loaded.destroy().catch(() => {}) }
  }, [selected])

  const configuration = useMemo(() => {
    let pages: number[] = [], rangeError: ToolError | undefined
    try { pages = doc ? parsePageRanges(expression, doc.numPages).pages : [] }
    catch (error) { rangeError = error as ToolError }
    try {
      const normalized = normalizePdfImageOptions({ ...options, quality: options.format === 'jpeg' ? (qualityText.trim() ? Number(qualityText) / 100 : NaN) : DEFAULT_PDF_IMAGE_OPTIONS.quality })
      return { options: normalized, pages, rangeError, error: rangeError }
    } catch (error) { return { pages, rangeError, error: rangeError ?? error as ToolError } }
  }, [options, qualityText, doc, expression])
  const planKey = `${selected?.id}:${expression}:${JSON.stringify(configuration.options)}`
  const plans = planState?.key === planKey ? planState.plans : undefined
  const planError = planState?.key === planKey ? planState.error : undefined
  useEffect(() => {
    if (!doc || !configuration.options || configuration.error) return
    let disposed = false
    void (async () => {
      try {
        const items: PdfImagePagePlan[] = []
        for (const number of configuration.pages) {
          if (disposed) return
          const page = await doc.getPage(number)
          try { items.push(planPdfImagePage(page, number, configuration.options!)) } finally { page.cleanup() }
        }
        if (!disposed) setPlanState({ key: planKey, plans: items })
      } catch (error) { if (!disposed) setPlanState({ key: planKey, error: error as ToolError }) }
    })()
    return () => { disposed = true }
  }, [doc, configuration, planKey])

  const resetJob = useCallback(() => {
    const previous = job.current
    job.current = null; previous?.cancel(); session.resetSession()
    setState(null); setResult(null); setError(null); setProgress({ fraction: 0 })
  }, [session])
  const changeFiles = useCallback((next: WorkspaceFile[]) => {
    resetJob(); setDocumentState(null); setPlanState(null); setFiles(next); setExpression(''); setViewStart(0)
  }, [resetJob])
  const reset = () => { changeFiles([]); setOptions({ ...DEFAULT_PDF_IMAGE_OPTIONS, format: initialFormat }); setQualityText('80') }
  const changeOptions = (next: Partial<PdfImageOptions>) => { resetJob(); setOptions(current => ({ ...current, ...next })) }
  const updateExpression = (value: string) => { resetJob(); setExpression(value) }
  const picked = new Set(configuration.pages)
  const canRun = Boolean(selected && doc && configuration.options && !configuration.error && !planError && plans?.length)
  const run = () => {
    if (!canRun || !selected || !configuration.options) return
    resetJob()
    const next = startPdfToImages({ file: { displayName: selected.displayName, bytes: selected.bytes }, pagesExpr: expression, options: configuration.options }, {
      onProgress: value => { if (active.current && job.current === next) setProgress(value) },
      onState: value => { if (active.current && job.current === next) setState(value) },
    })
    job.current = next; setState(next.state); session.jobs.track(next)
    void next.completion.then(() => {
      if (!active.current || job.current !== next) return
      if (next.state === 'done' && next.result) setResult(next.result)
      if (next.state === 'failed' && next.error) setError(next.error)
    })
  }
  const download = (output: VerifiedOutput) => {
    if (!output.verified) return
    const stored = session.listOutputs().find(item => item.name === output.name) ?? session.addOutput(output.name, output.mimeType, output.bytes)
    const anchor = document.createElement('a')
    anchor.href = session.objectUrlFor(stored.id); anchor.download = stored.name; anchor.click()
  }
  const problem = readError ?? configuration.error ?? planError
  const pixels = plans?.reduce((sum, plan) => sum + plan.width * plan.height, 0) ?? 0
  const start = Math.min(viewStart, Math.max(0, Math.floor(((doc?.numPages ?? 1) - 1) / 8) * 8))

  return <div className="tool-screen pdf-to-images-tool">
    <header className="tool-header"><h1 className="tool-heading">{t(tool.title)}</h1><p className="tool-subtitle">{t("Render PDF pages as images, with no uploads. Your original PDF stays untouched.")}</p></header>
    {phase === 'configure' ? <>
      <FileSelection expected="pdf" multiple={false} files={files} onChange={changeFiles} labels={{ limits: germanJpg ? 'PDF bis 50 MB / 300 Seiten · 8192 Pixel pro Seite / 16 Millionen Pixel pro Bild · insgesamt 50 MB Bilddateien · lokale Verarbeitung' : 'PDF up to 50 MB / 300 pages · 8192 px per side / 16 million pixels per image · 50 MB total encoded images · processed locally' }} />
      {selected ? <section className="panel" aria-label={t("PDF image settings")}>
        <h2 className="panel-title">{t("Choose pages and image settings")}</h2>
        <div className="image-settings-grid">
          <label htmlFor="pdf-image-format">{t("Image format")}<select id="pdf-image-format" value={options.format} onChange={event => { changeOptions({ format: event.target.value as PdfImageOptions['format'], background: 'white' }); setQualityText('80') }}><option value="jpeg">JPG</option><option value="png">PNG</option></select></label>
          <label htmlFor="pdf-image-dpi">{t("Resolution")}<select id="pdf-image-dpi" value={options.dpi} onChange={event => changeOptions({ dpi: Number(event.target.value) })}>{QUOTAS.renderDpis.map(dpi => <option key={dpi} value={dpi}>{dpi} DPI</option>)}</select></label>
          {options.format === 'jpeg' ? <label htmlFor="pdf-image-quality">{t("JPG quality (%)")}<input id="pdf-image-quality" type="number" inputMode="decimal" min="0" max="100" step="1" value={qualityText} onChange={event => { resetJob(); setQualityText(event.target.value) }} aria-invalid={Boolean(configuration.error?.code === 'E-CONFIG-01')} aria-describedby="pdf-image-help" /></label> : <label htmlFor="pdf-image-background">{t("PNG background")}<select id="pdf-image-background" value={options.background} onChange={event => changeOptions({ background: event.target.value as PdfImageOptions['background'] })}><option value="white">{t("White")}</option><option value="transparent">{t("Transparent")}</option></select></label>}
        </div>
        <div className="page-range-field pdf-image-ranges"><label htmlFor="pdf-image-pages">{t("Pages to convert")}</label><input id="pdf-image-pages" type="text" value={expression} placeholder="3, 1, 5-8" disabled={!doc} onChange={event => updateExpression(event.target.value)} aria-invalid={Boolean(configuration.rangeError)} aria-describedby="pdf-image-help pdf-image-status" /></div>
        <p id="pdf-image-help" className="panel-hint">{t("Use page numbers and ranges separated by commas, in the order you want. Repeated pages are included once. Higher DPI makes larger images. JPG always has a white background; PNG can keep unpainted areas transparent.")}</p>
        {doc ? <>
          <div className="panel-actions"><button type="button" className="btn-ghost" onClick={() => updateExpression(doc.numPages === 1 ? '1' : `1-${doc.numPages}`)}>{t("Select all pages")}</button><button type="button" className="btn-ghost" onClick={() => updateExpression('')}>{t("Clear page selection")}</button></div>
          <div className="page-grid" role="group" aria-label={t("PDF page previews")}>
            {Array.from({ length: Math.min(8, doc.numPages - start) }, (_, i) => start + i + 1).map(number => <PageThumbnail key={`${selected.id}:${number}:${options.background}`} doc={doc} pageNumber={number} selected={picked.has(number)} deleting={false} onToggle={() => updateExpression(togglePage(expression, number, doc.numPages))} background={options.format === 'png' ? options.background : 'white'} />)}
          </div>
          <nav className="page-pagination" aria-label={t("PDF preview pages")}><button type="button" className="btn-ghost" disabled={start === 0} onClick={() => setViewStart(start - 8)}>{t("Previous pages")}</button><span>{germanJpg ? `Seiten ${start + 1}–${Math.min(start + 8, doc.numPages)} von ${doc.numPages}` : `Pages ${start + 1}–${Math.min(start + 8, doc.numPages)} of ${doc.numPages}`}</span><button type="button" className="btn-ghost" disabled={start + 8 >= doc.numPages} onClick={() => setViewStart(start + 8)}>{t("Next pages")}</button></nav>
        </> : null}
        <p id="pdf-image-status" className="page-selection-status" role={problem ? 'alert' : 'status'}>{problem ? t(problem.message) : !doc ? t('Reading the PDF…') : !plans ? t('Checking image dimensions…') : germanJpg ? `${plans.length} Seiten bereit zur Konvertierung` : `${plans.length} page${plans.length === 1 ? '' : 's'} ready for conversion`}</p>
      </section> : null}
      {plans?.length && !problem ? <section className="panel" aria-label={t("Output dimensions and size estimate")}>
        <h2 className="panel-title">{t("Output dimensions and size estimate")}</h2>
        <p className="panel-summary">{germanJpg ? `Unkomprimiert: ungefähr ${formatBytes(pixels * 4)} für ${plans.length} Bilder. Die Seiten werden einzeln gerendert.` : `Uncompressed pixels: about ${formatBytes(pixels * 4)} across ${plans.length} image${plans.length === 1 ? '' : 's'}. One page is rendered at a time.`}</p>
        <p className="panel-hint">{t("This is a pixel-memory estimate, not the encoded download size. Actual JPG/PNG size depends on content and quality and is shown after conversion. Encoded images are limited to 50 MB in total; the ZIP adds a small amount of overhead.")}</p>
        <details className="pdf-image-dimensions"><summary>{germanJpg ? `Abmessungen für ${plans.length} ausgewählte Seiten anzeigen` : `View dimensions for ${plans.length} selected page${plans.length === 1 ? '' : 's'}`}</summary><ul className="panel-details">{plans.map(plan => <li key={plan.sourcePage}>{germanJpg ? 'Seite' : 'Page'} {plan.sourcePage}: {plan.width} × {plan.height} px</li>)}</ul></details>
      </section> : null}
      <PreviewPanel title={t("Create your images")} summary={canRun ? germanJpg ? `${plans!.length} JPG-Bilder und eine ZIP-Datei werden erstellt.` : `${plans!.length} ${options.format === 'jpeg' ? 'JPG' : 'PNG'} image${plans!.length === 1 ? '' : 's'} and one ZIP will be created.` : t('Choose a valid PDF, page selection and image settings.')}
        details={canRun ? [germanJpg ? `Ausgabereihenfolge: ${configuration.pages.join(', ')}` : `Output page order: ${configuration.pages.join(', ')}`, t('The layout preview shows the page appearance. JPG compression can affect fine detail; actual encoded previews are shown after conversion.'), t('This renders pages. It does not extract the original images embedded in the PDF.')] : undefined}
        actionLabel={t("Create images")} onConfirm={run} onCancel={onExit} disabled={!canRun} disabledReason={problem ? t(problem.message) : t('Wait for a valid page selection and dimension check.')} />
    </> : null}
    {phase === 'processing' ? <ProcessingPanel label={t("Creating your images")} progress={progress} onCancel={() => job.current?.cancel()} /> : null}
    {phase === 'result' && result ? <PdfImagesResults outcome={result} onDownload={download} onAdjust={resetJob} onReset={reset} onExit={onExit} /> : null}
    {phase === 'failed' && error ? <FailurePanel error={error} onRetry={resetJob} onReset={reset} /> : null}
    {phase === 'cancelled' ? <CancelledPanel onReset={reset} onAdjust={resetJob} /> : null}
  </div>
}
