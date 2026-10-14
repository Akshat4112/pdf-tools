import { CancelledError, type JobContext } from '../jobs/orchestrator'
import { toolError } from '../registry'
import type { PdfImageOptions, PdfImagePagePlan } from '../tools/pdfImagePlan'
import { PDF_IMAGE_LIMITS } from '../tools/pdfImagePlan'
import { assertRenderedImages, type PdfjsDocument } from './pdfjs'

/** One page/canvas at a time. Cancellation interrupts PDF.js rendering and discards late encoding. */
export async function renderPdfPageImage(doc: PdfjsDocument, plan: PdfImagePagePlan, options: PdfImageOptions, ctx: Pick<JobContext, 'isCancelled'>): Promise<Uint8Array> {
  const check = () => { if (ctx.isCancelled()) throw new CancelledError() }
  check()
  // Defense in depth: callers cannot allocate an unvalidated canvas through this adapter.
  if (!Number.isInteger(plan.width) || !Number.isInteger(plan.height) || plan.width < 1 || plan.height < 1 || plan.width > PDF_IMAGE_LIMITS.maxDimensionPx || plan.height > PDF_IMAGE_LIMITS.maxDimensionPx || plan.width * plan.height > PDF_IMAGE_LIMITS.maxPixels) throw toolError('E-PROC-02', 'This page exceeds the image size limit.', 'reduce-scope')
  const page = await doc.getPage(plan.sourcePage)
  let canvas: HTMLCanvasElement | OffscreenCanvas | undefined
  let task: { promise: Promise<void>; cancel?: () => void } | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  try {
    check()
    if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(plan.width, plan.height)
    else if (typeof document !== 'undefined') { canvas = document.createElement('canvas'); canvas.width = plan.width; canvas.height = plan.height }
    else throw toolError('E-SYS-01', 'Image rendering is unavailable in this browser.', 'suggest-browser')
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!context) throw toolError('E-SYS-01', 'Image rendering is unavailable in this browser.', 'suggest-browser')
    task = page.render({ canvas, canvasContext: context, viewport: plan.viewport, background: options.background === 'white' ? '#ffffff' : 'rgba(0,0,0,0)' })
    timer = setInterval(() => { if (ctx.isCancelled()) task?.cancel?.() }, 20)
    await task.promise
    clearInterval(timer); timer = undefined
    check()
    // PDF.js can resolve a render after substituting a null image resource. Reject that output.
    await assertRenderedImages(page, ctx.isCancelled)
    check()
    const mime = options.format === 'jpeg' ? 'image/jpeg' : 'image/png'
    const quality = options.format === 'jpeg' ? options.quality : undefined
    const blob = 'convertToBlob' in canvas ? await canvas.convertToBlob({ type: mime, quality }) : await new Promise<Blob>((resolve, reject) => {
      ;(canvas as HTMLCanvasElement).toBlob(value => value ? resolve(value) : reject(toolError('E-PROC-02', 'Image encoding failed. Reduce DPI and try again.', 'reduce-scope')), mime, quality)
    })
    check()
    if (blob.type !== mime || !blob.size) throw toolError('E-OUT-01', 'The image encoder did not produce the requested format.', 'retry-job')
    if (blob.size > PDF_IMAGE_LIMITS.maxEncodedBytes) throw toolError('E-PROC-02', 'This image exceeds the 50 MB output limit. Reduce DPI or JPEG quality.', 'reduce-scope')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    check()
    return bytes
  } catch (error) {
    if (ctx.isCancelled()) throw new CancelledError()
    const e = error as ReturnType<typeof toolError>
    if (typeof e.code === 'string' && e.code.startsWith('E-')) throw e
    throw toolError('E-PROC-01', 'This PDF page could not be rendered as an image.', 'retry-job')
  } finally {
    if (timer) clearInterval(timer)
    task?.cancel?.()
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    page.cleanup()
  }
}
