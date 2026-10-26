import { useLocale } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { imagePreviewBytes } from '../engines/imagePreviewBytes'
import type { ImageMetadata } from '../engines/imageMetadata'
import type { ImagePagePlan } from '../tools/imagePagePlan'
import { toolError, type ToolError } from '../registry'

export interface ImagePreviewItem {
  id: number; displayName: string; bytes: Uint8Array; metadata: ImageMetadata; plan: ImagePagePlan; position: number
}

/** Eight bounded canvases; image decoding runs sequentially and every bitmap is closed. */
export function ImageLayoutPreviews({ items, onError }: { items: ImagePreviewItem[]; onError(id: number, error: ToolError): void }) {
  const { t } = useLocale()
  const canvases = useRef(new Map<number, HTMLCanvasElement>())
  const [rendered, setRendered] = useState<{ items: ImagePreviewItem[]; ids: number[] } | null>(null)
  const ready = rendered?.items === items ? rendered.ids : []
  useEffect(() => {
    let disposed = false
    const targets = new Map(canvases.current)
    void (async () => {
      for (const item of items) {
        if (disposed) return
        let bitmap: ImageBitmap | undefined
        try {
          if (typeof createImageBitmap !== 'function') throw toolError('E-SYS-01', 'Image previews are unavailable in this browser.', 'suggest-browser')
          const { metadata, plan } = item
          const raw = imagePreviewBytes(item.bytes, metadata.kind)
          const ratio = Math.min(1, 560 / metadata.width, 720 / metadata.height)
          bitmap = await createImageBitmap(new Blob([raw.buffer as ArrayBuffer]), {
            resizeWidth: Math.max(1, Math.round(metadata.width * ratio)), resizeHeight: Math.max(1, Math.round(metadata.height * ratio)), imageOrientation: 'none',
          })
          if (disposed) return
          const canvas = targets.get(item.id)
          if (!canvas) return
          const scale = Math.min(280 / plan.widthPt, 360 / plan.heightPt)
          canvas.width = Math.ceil(plan.widthPt * scale); canvas.height = Math.ceil(plan.heightPt * scale)
          const context = canvas.getContext('2d')
          if (!context) throw toolError('E-SYS-01', 'Image previews are unavailable in this browser.', 'suggest-browser')
          context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
          context.save()
          // PDF is bottom-left based; the decoded bitmap is top-left based.
          context.setTransform(scale, 0, 0, -scale, 0, plan.heightPt * scale)
          context.beginPath(); context.rect(plan.frame.x, plan.frame.y, plan.frame.width, plan.frame.height); context.clip()
          context.transform(...plan.matrix); context.transform(1, 0, 0, -1, 0, 1)
          context.drawImage(bitmap, 0, 0, 1, 1)
          context.restore()
          setRendered(current => ({ items, ids: [...(current?.items === items ? current.ids : []), item.id] }))
        } catch (error) {
          if (!disposed) onError(item.id, (error as ToolError).code ? error as ToolError : toolError('E-INPUT-03', 'This image could not be decoded. Remove it or choose another file.', 'retry-file'))
        } finally { bitmap?.close() }
      }
    })()
    return () => { disposed = true; for (const canvas of targets.values()) { canvas.width = 0; canvas.height = 0 } }
  }, [items, onError])
  return <div className="image-preview-grid">
    {items.map(item => <figure key={item.id} className="image-preview-card" aria-label={`Preview of page ${item.position}: ${item.displayName}`}>
      <div className="image-preview-paper">
        <canvas ref={node => { if (node) canvases.current.set(item.id, node); else canvases.current.delete(item.id) }} aria-hidden="true" />
        {!ready.includes(item.id) ? <span className="page-placeholder">Loading preview…</span> : null}
      </div>
      <figcaption><strong>Page {item.position}</strong><span title={item.displayName}>{item.displayName}</span><small>{Math.round(item.plan.widthPt * 25.4 / 72)} × {Math.round(item.plan.heightPt * 25.4 / 72)} mm</small></figcaption>
    </figure>)}
  </div>
}
