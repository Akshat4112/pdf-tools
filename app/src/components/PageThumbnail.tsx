import { useEffect, useRef, useState } from 'react'
import type { PdfjsDocument, PdfjsPage } from '../engines/pdfjs'

/** Only the current eight-page group is mounted, bounding retained canvases. */
export function PageThumbnail({ doc, pageNumber, selected, deleting, onToggle }: {
  doc: PdfjsDocument
  pageNumber: number
  selected: boolean
  deleting: boolean
  onToggle(): void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    let disposed = false
    let page: PdfjsPage | undefined
    let task: { promise: Promise<void>; cancel?: () => void } | undefined
    const target = canvas.current
    void (async () => {
      try {
        page = await doc.getPage(pageNumber)
        if (disposed || !target) return
        const original = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: Math.min(280 / original.width, 360 / original.height) })
        target.width = Math.ceil(viewport.width)
        target.height = Math.ceil(viewport.height)
        const context = target.getContext('2d')
        if (!context) throw new Error('Canvas unavailable')
        task = page.render({ canvas: target, canvasContext: context, viewport, background: '#ffffff' })
        await task.promise
        if (!disposed) setStatus('ready')
      } catch {
        if (!disposed) setStatus('failed')
      } finally {
        page?.cleanup()
      }
    })()
    return () => {
      disposed = true
      task?.cancel?.()
      if (target) { target.width = 0; target.height = 0 }
    }
  }, [doc, pageNumber])

  return (
    <button type="button" className={`page-pick${selected ? ' is-selected' : ''}${selected && deleting ? ' is-removal' : ''}`}
      aria-label={`Page ${pageNumber}`} aria-pressed={selected} onClick={onToggle}>
      <span className="page-image">
        <canvas ref={canvas} aria-hidden="true" />
        {status !== 'ready' ? <span className="page-placeholder">{status === 'loading' ? 'Loading preview…' : 'Preview unavailable'}</span> : null}
      </span>
      <span className="page-pick-label">Page {pageNumber}<span>{selected ? (deleting ? 'Remove' : 'Selected') : 'Select'}</span></span>
    </button>
  )
}
