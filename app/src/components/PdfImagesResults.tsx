import { useLocale } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PdfToImagesOutcome, VerifiedPageImage } from '../tools/pdfToImagesFlow'
import type { VerifiedOutput } from '../outputs/verify'
import { WorkspaceCleanupNote } from './ToolScreens'
import { usePanelHeading } from './usePanelHeading'
import { formatBytes } from './format'

/** Results display the actual encoded images without creating preview object URLs. */
function EncodedPreview({ image, schedule }: { image: VerifiedPageImage; schedule(work: () => Promise<void>): void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    let disposed = false
    const canvas = ref.current
    schedule(async () => {
      if (disposed) return
      let bitmap: ImageBitmap | undefined
      try {
        const scale = Math.min(280 / image.width, 360 / image.height, 1)
        bitmap = await createImageBitmap(new Blob([Uint8Array.from(image.bytes).buffer], { type: image.mimeType }), { resizeWidth: Math.max(1, Math.ceil(image.width * scale)), resizeHeight: Math.max(1, Math.ceil(image.height * scale)) })
        if (disposed || !canvas) return
        canvas.width = bitmap.width; canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Preview canvas unavailable')
        context.drawImage(bitmap, 0, 0)
        setStatus('ready')
      } catch { if (!disposed) setStatus('failed') }
      finally { bitmap?.close() }
    })
    return () => { disposed = true; if (canvas) { canvas.width = 0; canvas.height = 0 } }
  }, [image, schedule])
  return <div className={`page-image${image.background === 'transparent' ? ' is-transparent' : ''}`}>
    <canvas ref={ref} aria-hidden="true" />
    {status !== 'ready' ? <span className="page-placeholder">{status === 'loading' ? 'Loading preview…' : 'Preview unavailable — download still available'}</span> : null}
  </div>
}

export function PdfImagesResults({ outcome, onDownload, onAdjust, onReset, onExit }: {
  outcome: PdfToImagesOutcome; onDownload(output: VerifiedOutput): void; onAdjust(): void; onReset(): void; onExit?: () => void
}) {
  const { t, locale } = useLocale()
  const german = locale === 'de'
  const heading = usePanelHeading()
  const [start, setStart] = useState(0)
  const queue = useRef(Promise.resolve())
  const schedule = useCallback((work: () => Promise<void>) => { queue.current = queue.current.then(work).catch(() => {}) }, [])
  const images = outcome.images.slice(start, start + 8)
  return <section className="panel state-panel is-result pdf-images-results" aria-label={t("Results")}>
    <h2 ref={heading} tabIndex={-1} className="panel-title">{german ? "Fertig – deine Bilder sind bereit" : "Done — your images are ready"}</h2>
    <p className="panel-summary">{german ? `${outcome.images.length} Bilder und eine ZIP-Datei wurden erstellt und geprüft. Angezeigt werden die tatsächlichen Downloadgrößen.` : `${outcome.images.length} image${outcome.images.length === 1 ? '' : 's'} and the ZIP were generated and verified. Sizes below are the actual download sizes.`}</p>
    <p className="panel-hint" role="status">{german ? "Deine Dateien sind bereit. Vorschaubilder laden separat und sind für den Download nicht erforderlich." : "Your result is ready to download. Image previews load separately and are not required for downloading."}</p>
    <div className="pdf-images-zip">
      <span><strong>{outcome.zip.name}</strong><small>{formatBytes(outcome.zip.actualBytes)} · {german ? 'alle' : 'all'} {outcome.images.length} {german ? 'Bilder' : 'images'}</small></span>
      <button type="button" className="btn-primary" onClick={() => onDownload(outcome.zip)}>{german ? 'Alle als ZIP herunterladen' : 'Download all as ZIP'}</button>
    </div>
    <div className="image-preview-grid">
      {images.map(image => <article key={image.name} className="image-preview-card" aria-label={german ? `Bild von Seite ${image.sourcePage}` : `Image from page ${image.sourcePage}`}>
        <EncodedPreview image={image} schedule={schedule} />
        <p className="pdf-image-name" title={image.name}>{image.name}</p>
        <p className="panel-hint">{german ? "Seite" : "Page"} {image.sourcePage} · {image.width} × {image.height} px · {formatBytes(image.actualBytes)}</p>
        <button type="button" className="btn-ghost" aria-label={german ? `Datei ${image.name} herunterladen` : `Download ${image.name}`} onClick={() => onDownload(image)}>{german ? 'Bild herunterladen' : 'Download image'}</button>
      </article>)}
    </div>
    <nav className="page-pagination" aria-label={german ? "Ergebnisbilder" : "Result image pages"}>
      <button type="button" className="btn-ghost" disabled={start === 0} onClick={() => setStart(current => current - 8)}>{t("Previous images")}</button>
      <span>{german ? `Bilder ${start + 1}–${Math.min(start + 8, outcome.images.length)} von ${outcome.images.length}` : `Images ${start + 1}–${Math.min(start + 8, outcome.images.length)} of ${outcome.images.length}`}</span>
      <button type="button" className="btn-ghost" disabled={start + 8 >= outcome.images.length} onClick={() => setStart(current => current + 8)}>{t("Next images")}</button>
    </nav>
    <div className="panel-actions">
      <button type="button" className="btn-ghost" onClick={onAdjust}>{t("Adjust settings")}</button>
      <button type="button" className="btn-ghost" onClick={onReset}>{t("Start over")}</button>
      {onExit ? <button type="button" className="btn-ghost" onClick={onExit}>{t("Back to all tools")}</button> : null}
    </div>
    <WorkspaceCleanupNote />
  </section>
}
