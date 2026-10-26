import { useLocale } from '../i18n'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import { ImageLayoutPreviews, type ImagePreviewItem } from './ImageLayoutPreviews'
import { CancelledPanel, FailurePanel, PreviewPanel, ProcessingPanel, ResultPanel } from './ToolScreens'
import { phaseFromJobState } from './screenPhase'
import { IMAGE_LIMITS, readImageMetadata, type ImageMetadata } from '../engines/imageMetadata'
import { DEFAULT_IMAGE_OPTIONS, planImagePage, type ImagePdfOptions } from '../tools/imagePagePlan'
import { startImagesToPdf, type ImagesToPdfInput } from '../tools/imagesToPdfFlow'
import { FileSession } from '../session/fileSession'
import { QUOTAS, getTool, toolError, type ToolError } from '../registry'
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { VerifiedOutput } from '../outputs/verify'

interface ImageFile extends WorkspaceFile { metadata?: ImageMetadata }
const PER_VIEW = 8
const IMAGE_LABELS = { browse: 'Choose images', dropzone: 'Drop JPG or PNG images here', emptyHint: 'No images selected yet.', limits: 'Static JPG/PNG only · 300 images · 50 MB total · 16 million pixels per image · 25.6 million pixels total · processed locally' }

export function ImagesToPdfTool({ onExit }: { onExit?: () => void }) {
  const { t } = useLocale()
  const tool = getTool('images-to-pdf')
  const [files, setFiles] = useState<ImageFile[]>([])
  const [options, setOptions] = useState<ImagePdfOptions>({ ...DEFAULT_IMAGE_OPTIONS })
  const [marginText, setMarginText] = useState(String(DEFAULT_IMAGE_OPTIONS.marginPt))
  const [viewStart, setViewStart] = useState(0)
  const [state, setState] = useState<JobState | null>(null)
  const [progress, setProgress] = useState<JobProgress>({ fraction: 0 })
  const [result, setResult] = useState<VerifiedOutput | null>(null)
  const [error, setError] = useState<ToolError | null>(null)
  const [session] = useState(() => new FileSession())
  const job = useRef<Job<ImagesToPdfInput, VerifiedOutput> | null>(null)
  const active = useRef(true)
  const phase = phaseFromJobState(state)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; job.current?.cancel(); job.current = null; session.resetSession() }
  }, [session])

  const resetJob = useCallback(() => {
    const previous = job.current
    job.current = null; previous?.cancel(); session.resetSession()
    setState(null); setProgress({ fraction: 0 }); setResult(null); setError(null)
  }, [session])
  const changeFiles = useCallback((next: WorkspaceFile[]) => {
    resetJob(); setViewStart(0)
    setFiles(next.map(file => {
      if (file.error || (file as ImageFile).metadata) return file as ImageFile
      try { return { ...file, metadata: readImageMetadata(file.bytes) } }
      catch (error) { return { ...file, error: error as ToolError } }
    }))
  }, [resetJob])
  const previewError = useCallback((id: number, error: ToolError) => {
    if (active.current) setFiles(current => current.map(file => file.id === id ? { ...file, error } : file))
  }, [])

  const layout = useMemo(() => {
    const valid = files.filter((file): file is ImageFile & { metadata: ImageMetadata } => !file.error && Boolean(file.metadata))
    const pixels = valid.reduce((sum,file) => sum + file.metadata.width * file.metadata.height, 0)
    try {
      if (pixels > IMAGE_LIMITS.totalPixels) throw toolError('E-INPUT-04', 'The selection exceeds 25.6 million pixels. Remove images or resize them.', 'show-limits')
      if (!marginText.trim()) throw toolError('E-CONFIG-01', 'Enter a margin of zero or more points.', 'fix-field')
      const items: ImagePreviewItem[] = valid.map((file, i) => ({ ...file, plan: planImagePage(file.metadata, options), position: i + 1 }))
      return { items, count: valid.length }
    } catch (error) { return { items: [] as ImagePreviewItem[], count: valid.length, error: error as ToolError } }
  }, [files, options, marginText])
  const start = Math.min(viewStart, Math.max(0, Math.floor((layout.items.length - 1) / PER_VIEW) * PER_VIEW))
  const visible = useMemo(() => layout.items.slice(start, start + PER_VIEW), [layout.items, start])
  const previewKey = `${visible.map(item => item.id).join(',')}:${JSON.stringify(options)}`
  const canRun = Boolean(layout.count && !layout.error)
  const updateOptions = (next: Partial<ImagePdfOptions>) => { resetJob(); setOptions(current => ({ ...current, ...next })) }
  const reset = () => { changeFiles([]); setOptions({ ...DEFAULT_IMAGE_OPTIONS }); setMarginText(String(DEFAULT_IMAGE_OPTIONS.marginPt)) }
  const run = () => {
    if (!canRun) return
    resetJob()
    const next = startImagesToPdf({ images: layout.items.map(({ displayName, bytes }) => ({ displayName, bytes })), options }, {
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
    const stored = session.listOutputs()[0] ?? session.addOutput(output.name, output.mimeType, output.bytes)
    const anchor = document.createElement('a')
    anchor.href = session.objectUrlFor(stored.id); anchor.download = stored.name; anchor.click()
  }

  return <div className="tool-screen images-to-pdf-tool">
    <header className="tool-header"><h1 className="tool-heading">{t(tool.title)}</h1><p className="tool-subtitle">{t(tool.description)}</p></header>
    {phase === 'configure' ? <>
      <FileSelection expected="jpeg" multiple files={files} onChange={changeFiles} labels={IMAGE_LABELS} maxFiles={QUOTAS.maxPages} maxTotalBytes={IMAGE_LIMITS.totalBytes} />
      {layout.count ? <section className="panel" aria-label="Image page settings">
        <h2 className="panel-title">{t("Set up your pages")}</h2>
        <p className="panel-summary">{t("One image per page, in the order above. Use the arrows to move images earlier or later.")}</p>
        <div className="image-settings-grid">
          <label htmlFor="image-page-size">{t("Page size")}<select id="image-page-size" value={options.pageSize} onChange={e => updateOptions({ pageSize: e.target.value as ImagePdfOptions['pageSize'], ...(e.target.value === 'original' ? { orientation: 'auto' as const } : {}) })}>
            <option value="a4">A4</option><option value="letter">{t("Letter")}</option><option value="original">{t("Original image size")}</option>
          </select></label>
          <label htmlFor="image-orientation">{t("Page orientation")}<select id="image-orientation" value={options.orientation} disabled={options.pageSize === 'original'} onChange={e => updateOptions({ orientation: e.target.value as ImagePdfOptions['orientation'] })}>
            <option value="auto">{t("Auto — match each image")}</option><option value="portrait">{t("Portrait")}</option><option value="landscape">{t("Landscape")}</option>
          </select></label>
          <label htmlFor="image-fit">{t("Image fit")}<select id="image-fit" value={options.fit} onChange={e => updateOptions({ fit: e.target.value as ImagePdfOptions['fit'] })}>
            <option value="contain">{t("Fit entire image")}</option><option value="cover">{t("Fill page — crop edges")}</option>
          </select></label>
          <label htmlFor="image-margin">{t("Margins (points)")}<input id="image-margin" type="number" inputMode="decimal" min="0" step="any" value={marginText} aria-invalid={Boolean(layout.error?.code === 'E-CONFIG-01')} aria-describedby="image-layout-help image-layout-status" onChange={e => { setMarginText(e.target.value); updateOptions({ marginPt: e.target.value.trim() ? Number(e.target.value) : NaN }) }} /></label>
          {options.pageSize === 'original' ? <label htmlFor="image-dpi">{t("Original size DPI")}<select id="image-dpi" value={options.dpi} onChange={e => updateOptions({ dpi: Number(e.target.value) as ImagePdfOptions['dpi'] })}>
            {QUOTAS.renderDpis.map(dpi => <option key={dpi} value={dpi}>{dpi} DPI</option>)}
          </select></label> : null}
        </div>
        <p id="image-layout-help" className="panel-hint">72 points = 1 inch. Auto orientation honors camera rotation. Original size uses the selected DPI plus margins. Fit keeps the whole image; Fill crops the center to the area inside the margins.</p>
        <p className="panel-hint">{t("Transparent areas and page margins are white. Color profiles may look different in the PDF.")}</p>
        <p id="image-layout-status" className="page-selection-status" role={layout.error ? 'alert' : 'status'}>{layout.error ? layout.error.message : `${layout.count} image${layout.count === 1 ? '' : 's'} → ${layout.count} page${layout.count === 1 ? '' : 's'}`}</p>
      </section> : null}
      {visible.length ? <section className="panel" aria-label="Page layout previews">
        <h2 className="panel-title">{t("Page layout preview")}</h2>
        <p className="panel-summary">{t("The preview uses your page size, margins, fit and image orientation. Review every page before creating your PDF.")}</p>
        <ImageLayoutPreviews key={previewKey} items={visible} onError={previewError} />
        <nav className="page-pagination" aria-label="Image preview pages">
          <button type="button" className="btn-ghost" disabled={start === 0} onClick={() => setViewStart(start - PER_VIEW)}>{t("Previous images")}</button>
          <span>Pages {start + 1}–{Math.min(start + PER_VIEW, layout.items.length)} of {layout.items.length}</span>
          <button type="button" className="btn-ghost" disabled={start + PER_VIEW >= layout.items.length} onClick={() => setViewStart(start + PER_VIEW)}>{t("Next images")}</button>
        </nav>
      </section> : null}
      <PreviewPanel title="Create your PDF" summary={canRun ? `${layout.count} image${layout.count === 1 ? '' : 's'} will become one ${layout.count}-page PDF.` : 'Choose JPG or PNG images and valid page settings to continue.'}
        details={canRun ? [`Output order: ${layout.items.map(item => item.displayName).join(' → ')}`, ...(files.some(file => file.error) ? ['Files marked with errors are left out. Remove them or choose a replacement.'] : []), 'Your original images stay untouched. Processing stays on your device.'] : undefined}
        actionLabel="Create PDF" onConfirm={run} onCancel={onExit} disabled={!canRun} disabledReason={layout.error?.message ?? 'No valid images selected yet.'} />
    </> : null}
    {phase === 'processing' ? <ProcessingPanel label="Creating your PDF" progress={progress} onCancel={() => job.current?.cancel()} /> : null}
    {phase === 'result' && result ? <ResultPanel outputs={[result]} onDownload={download} onRetry={resetJob} retryLabel="Adjust settings" onReset={reset} onContinue={onExit} /> : null}
    {phase === 'failed' && error ? <FailurePanel error={error} onRetry={resetJob} onReset={reset} /> : null}
    {phase === 'cancelled' ? <CancelledPanel onReset={reset} onAdjust={resetJob} /> : null}
  </div>
}
