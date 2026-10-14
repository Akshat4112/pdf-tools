import { openDocument } from '../engines/pdfjs'
import { renderPdfPageImage } from '../engines/pdfRaster'
import { parsePageRanges } from '../lib/pageRanges'
import { CancelledError, runJob, type JobEvents } from '../jobs/orchestrator'
import { buildZip, verifyOutput, zipEntryName, type VerifiedOutput } from '../outputs/verify'
import { verifyRasterImage } from '../outputs/verifyRaster'
import { QUOTAS, toolError } from '../registry'
import { validateFile } from '../validation/validate'
import { normalizePdfImageOptions, planPdfImagePage, PDF_IMAGE_LIMITS, type PdfImageOptions, type PdfImagePagePlan } from './pdfImagePlan'

export interface PdfToImagesInput { file: { displayName: string; bytes: Uint8Array }; /** undefined = all pages; provided empty expression is invalid */ pagesExpr?: string; options?: Partial<PdfImageOptions> }
export interface VerifiedPageImage extends VerifiedOutput { sourcePage: number; width: number; height: number; dpi: number; background: 'white' | 'transparent'; quality?: number }
export interface PdfToImagesOutcome { images: VerifiedPageImage[]; zip: VerifiedOutput }

async function verifyArchive(bytes: Uint8Array, images: VerifiedPageImage[], check: () => void) {
  const { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } = await import('@zip.js/zip.js')
  const reader = new ZipReader(new Uint8ArrayReader(bytes))
  try {
    const entries = await reader.getEntries()
    if (entries.length !== images.length) throw new Error('Incorrect archive count')
    for (let i = 0; i < entries.length; i++) {
      check()
      const entry = entries[i], expected = images[i]
      if (entry.directory || entry.filename !== expected.name || entry.uncompressedSize !== expected.bytes.length || !entry.getData) throw new Error('Incorrect archive entry')
      const extracted = await entry.getData(new Uint8ArrayWriter(), { checkSignature: true })
      if (extracted.length !== expected.bytes.length || !extracted.every((b, at) => b === expected.bytes[at])) throw new Error('Archive image differs')
    }
  } catch {
    check()
    throw toolError('E-OUT-01', 'The image archive did not pass verification.', 'retry-job')
  } finally { await reader.close() }
}

/** PT-CORE-012 engine only. PT-CORE-013 will mount the public interface. */
export function startPdfToImages(input: PdfToImagesInput, events: JobEvents = {}) {
  const snapshot = { ...input, file: { ...input.file }, options: { ...input.options } }
  return runJob('pdf-to-images', snapshot, async (inp, ctx): Promise<PdfToImagesOutcome> => {
    const check = () => { if (ctx.isCancelled()) throw new CancelledError() }
    check()
    const options = normalizePdfImageOptions(inp.options)
    const meta = validateFile(inp.file.displayName, inp.file.bytes, 'pdf')
    const doc = await openDocument(inp.file.bytes, { strict: true, maxCanvasBytes: PDF_IMAGE_LIMITS.maxPixels * 4 })
    const images: VerifiedPageImage[] = []
    const stem = meta.displayName.replace(/\.[^.]*$/, '').replace(/[^\w.-]+/g, '_').slice(0, 50) || 'document'
    const ext = options.format === 'jpeg' ? 'jpg' : 'png'
    try {
      check()
      const pages = inp.pagesExpr === undefined ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : parsePageRanges(inp.pagesExpr, doc.numPages).pages
      if (!pages.length) throw toolError('E-INPUT-05', 'Select at least one page.', 'focus-picker')
      if (pages.length > QUOTAS.maxPages) throw toolError('E-INPUT-04', 'Choose at most 300 pages.', 'show-limits')
      const plans: PdfImagePagePlan[] = []
      // Preflight every selected page before allocating the first render canvas.
      for (let i = 0; i < pages.length; i++) {
        check()
        const page = await doc.getPage(pages[i])
        try { plans.push(planPdfImagePage(page, pages[i], options)) } finally { page.cleanup() }
        ctx.reportProgress(0.1 * (i + 1) / pages.length, `Checking page ${i + 1} of ${pages.length}`)
      }
      let encodedBytes = 0
      for (let i = 0; i < plans.length; i++) {
        check()
        const plan = plans[i], bytes = await renderPdfPageImage(doc, plan, options, ctx)
        check()
        encodedBytes += bytes.length
        if (encodedBytes > PDF_IMAGE_LIMITS.maxEncodedBytes) throw toolError('E-PROC-02', 'The images exceed 50 MB in total. Reduce DPI, JPEG quality or the selected pages.', 'reduce-scope')
        const verified = await verifyRasterImage({ name: zipEntryName(`${stem}-page`, plan.sourcePage, doc.numPages, ext), mimeType: options.format === 'jpeg' ? 'image/jpeg' : 'image/png', bytes }, plan)
        check()
        images.push({ ...verified, sourcePage: plan.sourcePage, width: plan.width, height: plan.height, dpi: options.dpi, background: options.background, ...(options.format === 'jpeg' ? { quality: options.quality } : {}) })
        ctx.reportProgress(0.1 + 0.7 * (i + 1) / plans.length, `Rendered and verified page ${i + 1} of ${plans.length}`)
      }
    } finally { await doc.destroy() }
    check()
    ctx.reportProgress(0.85, 'Packing verified images')
    const bytes = await buildZip(images)
    check()
    await verifyArchive(bytes, images, check)
    check()
    ctx.reportProgress(0.95, 'Verified the image archive')
    const zip = await verifyOutput({ name: `${stem}-${ext}.zip`, mimeType: 'application/zip', bytes })
    check()
    return { images, zip }
  }, events)
}
