import { useCallback, useEffect, useRef, useState } from 'react'
import type { PdfToImagesOutcome, VerifiedPageImage } from '../tools/pdfToImagesFlow'
import type { VerifiedOutput } from '../outputs/verify'
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
        if (!context) return
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
  const [start, setStart] = useState(0)
  const queue = useRef(Promise.resolve())
  const schedule = useCallback((work: () => Promise<void>) => { queue.current = queue.current.then(work).catch(() => {}) }, [])
  const images = outcome.images.slice(start, start + 8)
  return <section className="panel pdf-images-results" aria-label="Results">
    <h2 className="panel-title">Done — your images are ready</h2>
    <p className="panel-summary">{outcome.images.length} image{outcome.images.length === 1 ? '' : 's'} and the ZIP were generated and verified. Sizes below are the actual download sizes.</p>
    <div className="pdf-images-zip">
      <span><strong>{outcome.zip.name}</strong><small>{formatBytes(outcome.zip.actualBytes)} · all {outcome.images.length} images</small></span>
      <button type="button" className="btn-primary" onClick={() => onDownload(outcome.zip)}>Download all as ZIP</button>
    </div>
    <div className="image-preview-grid">
      {images.map(image => <article key={image.name} className="image-preview-card" aria-label={`Image from page ${image.sourcePage}`}>
        <EncodedPreview image={image} schedule={schedule} />
        <p className="pdf-image-name" title={image.name}>{image.name}</p>
        <p className="panel-hint">Page {image.sourcePage} · {image.width} × {image.height} px · {formatBytes(image.actualBytes)}</p>
        <button type="button" className="btn-ghost" aria-label={`Download ${image.name}`} onClick={() => onDownload(image)}>Download image</button>
      </article>)}
    </div>
    <nav className="page-pagination" aria-label="Result image pages">
      <button type="button" className="btn-ghost" disabled={start === 0} onClick={() => setStart(current => current - 8)}>Previous images</button>
      <span>Images {start + 1}–{Math.min(start + 8, outcome.images.length)} of {outcome.images.length}</span>
      <button type="button" className="btn-ghost" disabled={start + 8 >= outcome.images.length} onClick={() => setStart(current => current + 8)}>Next images</button>
    </nav>
    <div className="panel-actions">
      <button type="button" className="btn-ghost" onClick={onAdjust}>Adjust settings</button>
      <button type="button" className="btn-ghost" onClick={onReset}>Start over</button>
      {onExit ? <button type="button" className="btn-ghost" onClick={onExit}>Back to all tools</button> : null}
    </div>
  </section>
}
