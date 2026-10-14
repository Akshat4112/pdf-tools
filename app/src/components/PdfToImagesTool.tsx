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

export function PdfToImagesTool({ mode, onExit }: { mode: 'pdf-to-jpg' | 'pdf-to-png'; onExit?: () => void }) {
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
    anchor.href = session.objectUrlFor(stored.id); anchor.download = output.name; anchor.click()
  }
  const problem = readError ?? configuration.error ?? planError
  const pixels = plans?.reduce((sum, plan) => sum + plan.width * plan.height, 0) ?? 0
  const start = Math.min(viewStart, Math.max(0, Math.floor(((doc?.numPages ?? 1) - 1) / 8) * 8))

  return <div className="tool-screen pdf-to-images-tool">
    <header className="tool-header"><h1 className="tool-heading">{tool.title}</h1><p className="tool-subtitle">Render PDF pages as images, with no uploads. Your original PDF stays untouched.</p></header>
    {phase === 'configure' ? <>
      <FileSelection expected="pdf" multiple={false} files={files} onChange={changeFiles} labels={{ limits: 'PDF up to 50 MB / 300 pages · 8192 px per side / 16 million pixels per image · 50 MB total encoded images · processed locally' }} />
      {selected ? <section className="panel" aria-label="PDF image settings">
        <h2 className="panel-title">Choose pages and image settings</h2>
        <div className="image-settings-grid">
          <label htmlFor="pdf-image-format">Image format<select id="pdf-image-format" value={options.format} onChange={event => { changeOptions({ format: event.target.value as PdfImageOptions['format'], background: 'white' }); setQualityText('80') }}><option value="jpeg">JPG</option><option value="png">PNG</option></select></label>
          <label htmlFor="pdf-image-dpi">Resolution<select id="pdf-image-dpi" value={options.dpi} onChange={event => changeOptions({ dpi: Number(event.target.value) })}>{QUOTAS.renderDpis.map(dpi => <option key={dpi} value={dpi}>{dpi} DPI</option>)}</select></label>
          {options.format === 'jpeg' ? <label htmlFor="pdf-image-quality">JPG quality (%)<input id="pdf-image-quality" type="number" inputMode="decimal" min="0" max="100" step="1" value={qualityText} onChange={event => { resetJob(); setQualityText(event.target.value) }} aria-invalid={Boolean(configuration.error?.code === 'E-CONFIG-01')} aria-describedby="pdf-image-help" /></label> : <label htmlFor="pdf-image-background">PNG background<select id="pdf-image-background" value={options.background} onChange={event => changeOptions({ background: event.target.value as PdfImageOptions['background'] })}><option value="white">White</option><option value="transparent">Transparent</option></select></label>}
        </div>
        <div className="page-range-field pdf-image-ranges"><label htmlFor="pdf-image-pages">Pages to convert</label><input id="pdf-image-pages" type="text" value={expression} placeholder="3, 1, 5-8" disabled={!doc} onChange={event => updateExpression(event.target.value)} aria-invalid={Boolean(configuration.rangeError)} aria-describedby="pdf-image-help pdf-image-status" /></div>
        <p id="pdf-image-help" className="panel-hint">Use page numbers and ranges separated by commas, in the order you want. Repeated pages are included once. Higher DPI makes larger images. JPG always has a white background; PNG can keep unpainted areas transparent.</p>
        {doc ? <>
          <div className="panel-actions"><button type="button" className="btn-ghost" onClick={() => updateExpression(doc.numPages === 1 ? '1' : `1-${doc.numPages}`)}>Select all pages</button><button type="button" className="btn-ghost" onClick={() => updateExpression('')}>Clear page selection</button></div>
          <div className="page-grid" role="group" aria-label="PDF page previews">
            {Array.from({ length: Math.min(8, doc.numPages - start) }, (_, i) => start + i + 1).map(number => <PageThumbnail key={`${selected.id}:${number}:${options.background}`} doc={doc} pageNumber={number} selected={picked.has(number)} deleting={false} onToggle={() => updateExpression(togglePage(expression, number, doc.numPages))} background={options.format === 'png' ? options.background : 'white'} />)}
          </div>
          <nav className="page-pagination" aria-label="PDF preview pages"><button type="button" className="btn-ghost" disabled={start === 0} onClick={() => setViewStart(start - 8)}>Previous pages</button><span>Pages {start + 1}–{Math.min(start + 8, doc.numPages)} of {doc.numPages}</span><button type="button" className="btn-ghost" disabled={start + 8 >= doc.numPages} onClick={() => setViewStart(start + 8)}>Next pages</button></nav>
        </> : null}
        <p id="pdf-image-status" className="page-selection-status" role={problem ? 'alert' : 'status'}>{problem ? problem.message : !doc ? 'Reading the PDF…' : !plans ? 'Checking image dimensions…' : `${plans.length} page${plans.length === 1 ? '' : 's'} ready for conversion`}</p>
      </section> : null}
      {plans?.length && !problem ? <section className="panel" aria-label="Output dimensions and size estimate">
        <h2 className="panel-title">Output dimensions and size estimate</h2>
        <p className="panel-summary">Uncompressed pixels: about {formatBytes(pixels * 4)} across {plans.length} image{plans.length === 1 ? '' : 's'}. One page is rendered at a time.</p>
        <p className="panel-hint">This is a pixel-memory estimate, not the encoded download size. Actual JPG/PNG size depends on content and quality and is shown after conversion. Encoded images are limited to 50 MB in total; the ZIP adds a small amount of overhead.</p>
        <details className="pdf-image-dimensions"><summary>View dimensions for {plans.length} selected page{plans.length === 1 ? '' : 's'}</summary><ul className="panel-details">{plans.map(plan => <li key={plan.sourcePage}>Page {plan.sourcePage}: {plan.width} × {plan.height} px</li>)}</ul></details>
      </section> : null}
      <PreviewPanel title="Create your images" summary={canRun ? `${plans!.length} ${options.format === 'jpeg' ? 'JPG' : 'PNG'} image${plans!.length === 1 ? '' : 's'} and one ZIP will be created.` : 'Choose a valid PDF, page selection and image settings.'}
        details={canRun ? [`Output page order: ${configuration.pages.join(', ')}`, 'The layout preview shows the page appearance. JPG compression can affect fine detail; actual encoded previews are shown after conversion.', 'This renders pages. It does not extract the original images embedded in the PDF.'] : undefined}
        actionLabel="Create images" onConfirm={run} onCancel={onExit} disabled={!canRun} disabledReason={problem?.message ?? 'Wait for a valid page selection and dimension check.'} />
    </> : null}
    {phase === 'processing' ? <ProcessingPanel label="Creating your images" progress={progress} onCancel={() => job.current?.cancel()} /> : null}
    {phase === 'result' && result ? <PdfImagesResults outcome={result} onDownload={download} onAdjust={resetJob} onReset={reset} onExit={onExit} /> : null}
    {phase === 'failed' && error ? <FailurePanel error={error} onRetry={resetJob} onReset={reset} /> : null}
    {phase === 'cancelled' ? <CancelledPanel onReset={reset} onAdjust={resetJob} /> : null}
  </div>
}
