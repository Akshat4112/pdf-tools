import { useLocale } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import type { PdfjsDocument, PdfjsPage } from '../engines/pdfjs'

/** Only the current eight-page group is mounted, bounding retained canvases. */
export function PageThumbnail({ doc, pageNumber, selected, deleting, onToggle, rotation, label, caption, detail, background = 'white' }: {
  doc: PdfjsDocument
  pageNumber: number
  selected: boolean
  deleting: boolean
  onToggle(): void
  /** Absolute final rotation: the preview uses the same angle as the export plan. */
  rotation?: number
  label?: string
  caption?: string
  detail?: string
  background?: 'white' | 'transparent'
}) {
  const { t } = useLocale()
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
        const original = page.getViewport({ scale: 1, rotation })
        const viewport = page.getViewport({ scale: Math.min(280 / original.width, 360 / original.height), rotation })
        target.width = Math.ceil(viewport.width)
        target.height = Math.ceil(viewport.height)
        const context = target.getContext('2d')
        if (!context) throw new Error('Canvas unavailable')
        task = page.render({ canvas: target, canvasContext: context, viewport, background: background === 'white' ? '#ffffff' : 'rgba(0,0,0,0)' })
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
  }, [doc, pageNumber, rotation, background])

  return (
    <button type="button" className={`page-pick${selected ? ' is-selected' : ''}${selected && deleting ? ' is-removal' : ''}`}
      aria-label={label ?? `Page ${pageNumber}`} aria-pressed={selected} onClick={onToggle}>
      <span className={`page-image${background === 'transparent' ? ' is-transparent' : ''}`}>
        <canvas ref={canvas} aria-hidden="true" />
        {status !== 'ready' ? <span className="page-placeholder">{status === 'loading' ? 'Loading preview…' : 'Preview unavailable'}</span> : null}
      </span>
      <span className="page-pick-label">{caption ?? `Page ${pageNumber}`}<span>{detail ?? (selected ? (deleting ? 'Remove' : 'Selected') : 'Select')}</span></span>
    </button>
  )
}
