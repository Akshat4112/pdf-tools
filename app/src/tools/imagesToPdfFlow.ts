import { PDFDocument, clip, concatTransformationMatrix, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb } from 'pdf-lib'
import { IMAGE_LIMITS, readImageMetadata } from '../engines/imageMetadata'
import { openDocument } from '../engines/pdfjs'
import { CancelledError, runJob, type JobEvents } from '../jobs/orchestrator'
import { verifyOutput } from '../outputs/verify'
import { QUOTAS, toOffsetZeroU8, toolError } from '../registry'
import { DEFAULT_IMAGE_OPTIONS, planImagePage, type ImagePdfOptions } from './imagePagePlan'

export interface ImagesToPdfInput { images: readonly { displayName: string; bytes: Uint8Array }[]; options?: ImagePdfOptions }

/** UI wiring follows in PT-CORE-011. Snapshot order/options; never mutate source bytes. */
export function startImagesToPdf(input: ImagesToPdfInput, events: JobEvents = {}) {
  const snapshot = { images: input.images.map(image => ({ ...image })), options: { ...(input.options ?? DEFAULT_IMAGE_OPTIONS) } }
  return runJob('images-to-pdf', snapshot, async (inp, ctx) => {
    const check = () => { if (ctx.isCancelled()) throw new CancelledError() }
    check()
    if (!inp.images.length) throw toolError('E-INPUT-05', 'Select at least one image.', 'focus-picker')
    if (inp.images.length > QUOTAS.maxPages || inp.images.reduce((sum,image) => sum + image.bytes.byteLength,0) > IMAGE_LIMITS.totalBytes) throw toolError('E-INPUT-04', 'Use at most 300 images and 50 MB of image files in total.', 'show-limits')
    let pixels = 0
    const plans = inp.images.map(image => {
      const metadata = readImageMetadata(image.bytes)
      pixels += metadata.width * metadata.height
      if (pixels > IMAGE_LIMITS.totalPixels) throw toolError('E-INPUT-04', 'The selection exceeds 25.6 million pixels. Resize images or use fewer files.', 'show-limits')
      return { metadata, page: planImagePage(metadata,inp.options) }
    })
    const pdf = await PDFDocument.create()
    for (let i = 0; i < plans.length; i++) {
      check()
      const { metadata, page: plan } = plans[i]
      const bytes = toOffsetZeroU8(inp.images[i].bytes)
      // Browser preflight also catches damaged JPEG entropy (embedding alone only reads headers).
      if (typeof window !== 'undefined') {
        if (typeof createImageBitmap !== 'function') throw toolError('E-SYS-01', 'Image decoding is unavailable in this browser.', 'suggest-browser')
        try {
          const bitmap = await createImageBitmap(new Blob([Uint8Array.from(bytes).buffer], { type: metadata.kind === 'jpeg' ? 'image/jpeg' : 'image/png' }))
          bitmap.close()
        } catch { throw toolError('E-INPUT-03', `Image ${i + 1} could not be decoded.`, 'retry-file') }
        check()
      }
      let image
      try { image = metadata.kind === 'jpeg' ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes) }
      catch { throw toolError('E-INPUT-03', `Image ${i + 1} could not be decoded.`, 'retry-file') }
      if (image.width !== metadata.width || image.height !== metadata.height) throw toolError('E-INPUT-03', 'Image dimensions do not match its header.', 'retry-file')
      const page = pdf.addPage([plan.widthPt,plan.heightPt])
      page.drawRectangle({ x: 0, y: 0, width: plan.widthPt, height: plan.heightPt, color: rgb(1,1,1) })
      const frame = plan.frame
      page.pushOperators(pushGraphicsState(), rectangle(frame.x,frame.y,frame.width,frame.height), clip(), endPath(), concatTransformationMatrix(...plan.matrix))
      page.drawImage(image, { x: 0, y: 0, width: 1, height: 1 })
      page.pushOperators(popGraphicsState())
      ctx.reportProgress(0.7 * (i + 1) / plans.length, `Embedding image ${i + 1} of ${plans.length}`)
    }
    check()
    const bytes = await pdf.save()
    check()
    const output = await openDocument(bytes)
    try {
      if (output.numPages !== plans.length) throw toolError('E-OUT-01', 'The output page count is incorrect.', 'retry-job')
      for (let i = 0; i < plans.length; i++) {
        check()
        const page = await output.getPage(i + 1)
        try {
          const actual = page.getViewport({ scale: 1 }), wanted = plans[i].page
          if (page.rotate !== 0 || Math.abs(actual.width - wanted.widthPt) > 0.01 || Math.abs(actual.height - wanted.heightPt) > 0.01) throw toolError('E-OUT-01', 'The output page sizing is incorrect.', 'retry-job')
        } finally { page.cleanup() }
        ctx.reportProgress(0.7 + 0.25 * (i + 1) / plans.length, `Verified page ${i + 1} of ${plans.length}`)
      }
    } finally { await output.destroy() }
    check()
    const stem = (inp.images[0].displayName.split(/[\\/]/).pop() ?? '').replace(/\.[^.]*$/, '').replace(/[^\w.-]+/g,'_').slice(0,50) || 'images'
    return verifyOutput({ name: `${stem}-images.pdf`, mimeType: 'application/pdf', bytes, expectedPages: plans.length })
  }, events)
}
