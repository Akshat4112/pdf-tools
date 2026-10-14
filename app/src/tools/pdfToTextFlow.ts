import { openDocument } from '../engines/pdfjs'
import { CancelledError, runJob, type JobEvents } from '../jobs/orchestrator'
import { verifyOutput, type VerifiedOutput } from '../outputs/verify'
import { QUOTAS, toolError } from '../registry'
import { validateFile } from '../validation/validate'

export const TEXT_OUTPUT_LIMIT = QUOTAS.maxInputBytes
export const TEXT_PREVIEW_LIMIT = 8000
export interface PdfToTextInput { file: { displayName: string; bytes: Uint8Array } }
export type PdfToTextOutcome = {
  kind: 'text' | 'no-text'
  totalPages: number
  pagesWithText: number
  pagesWithoutText: number[]
  output?: VerifiedOutput
  preview: string
  previewTruncated: boolean
}

/** Preserve Unicode and PDF text-item order; line endings are hints, not layout reconstruction. */
export function joinTextItems(items: { str: string; hasEOL?: boolean }[]): string {
  return items.map(item => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`).join('').trim()
}

export function startPdfToText(input: PdfToTextInput, events: JobEvents = {}) {
  return runJob('pdf-to-text', { file: { ...input.file } }, async (request, ctx): Promise<PdfToTextOutcome> => {
    const check = () => { if (ctx.isCancelled()) throw new CancelledError() }
    check()
    const meta = validateFile(request.file.displayName, request.file.bytes, 'pdf')
    const doc = await openDocument(request.file.bytes, { strict: true })
    let destroyed: Promise<void> | undefined
    const destroy = () => destroyed ??= doc.destroy()
    // Cancel an in-flight worker text request as well as checking between pages.
    const cancellation = setInterval(() => { if (ctx.isCancelled()) void destroy().catch(() => {}) }, 20)
    const encoder = new TextEncoder(), chunks: Uint8Array[] = [], without: number[] = []
    let size = 0, withText = 0, preview = '', previewTruncated = false
    try {
      for (let number = 1; number <= doc.numPages; number++) {
        check()
        const page = await doc.getPage(number)
        let text: string
        try {
          check()
          const content = await page.getTextContent()
          check()
          // Refuse oversized text before joining/encoding another large string.
          const chars = content.items.reduce((sum, item) => sum + (item.str?.length ?? 0) + 1, 0)
          if (chars > TEXT_OUTPUT_LIMIT) throw toolError('E-PROC-02', 'The extracted text exceeds the 50 MB output limit. Split the PDF into smaller documents first.', 'reduce-scope')
          text = joinTextItems(content.items)
        } finally { page.cleanup() }
        if (text.trim()) withText++
        else without.push(number)
        const part = `${number === 1 ? '' : '\f'}${text}`
        const bytes = encoder.encode(part)
        size += bytes.length
        if (size > TEXT_OUTPUT_LIMIT) throw toolError('E-PROC-02', 'The extracted text exceeds the 50 MB output limit. Split the PDF into smaller documents first.', 'reduce-scope')
        chunks.push(bytes)
        const remaining = Math.max(0, TEXT_PREVIEW_LIMIT - preview.length)
        preview += part.slice(0, remaining)
        previewTruncated ||= part.length > remaining
        ctx.reportProgress(0.9 * number / doc.numPages, `Read page ${number} of ${doc.numPages}`)
      }
      check()
      const report = { totalPages: doc.numPages, pagesWithText: withText, pagesWithoutText: without, preview, previewTruncated }
      if (!withText) return { ...report, kind: 'no-text', preview: '', previewTruncated: false }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      // Fatal UTF-8 readback, exact bytes, and one separator per page boundary.
      const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
      if (decoded.includes('\u0000')) throw toolError('E-OUT-01', 'The extracted text contains unsupported NUL characters and did not pass verification.', 'retry-job')
      const readback = encoder.encode(decoded)
      if (readback.length !== bytes.length || !readback.every((value, index) => value === bytes[index])) throw toolError('E-OUT-01', 'The text file did not pass UTF-8 verification.', 'retry-job')
      ctx.reportProgress(0.95, 'Verifying UTF-8 text')
      const stem = meta.displayName.replace(/\.[^.]*$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'document'
      const output = await verifyOutput({ name: `${stem}.txt`, mimeType: 'text/plain', bytes })
      check()
      return { ...report, kind: 'text', output }
    } finally { clearInterval(cancellation); await destroy() }
  }, events)
}
