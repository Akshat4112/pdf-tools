import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { openDocument, type PdfjsDocument } from '../engines/pdfjs'
import { CancelledError, runJob, type JobEvents } from '../jobs/orchestrator'
import { toolError, type ToolError } from '../registry'
import { validateFile } from '../validation/validate'

export interface DocumentInfoInput { file: { displayName: string; bytes: Uint8Array } }
export interface InfoField { label: string; value: string; truncated: boolean }
export interface PageInfo { number: number; width: number; height: number; rotation: number; userUnit: number }
export interface DocumentInfo {
  name: string
  byteLength: number
  locked: boolean
  pageCount?: number
  version?: string
  encryption: 'password-required' | 'encrypted' | 'none-reported' | 'unknown'
  signatureEntries?: number
  signatureFlag?: boolean
  fields: InfoField[]
  xmp: InfoField[]
  pages: PageInfo[]
  warnings: string[]
}
type InspectorDocument = PdfjsDocument & Pick<PDFDocumentProxy, 'getMetadata' | 'getSignatures'>
export const INFO_FIELD_LIMIT = 1000
const dictionaryFields = [['Title','Title'],['Author','Author'],['Subject','Subject'],['Keywords','Keywords'],['Creator','Creator'],['Producer','Producer'],['CreationDate','Created (PDF date)'],['ModDate','Modified (PDF date)']] as const
const xmpFields = [['dc:title','Title'],['dc:creator','Creator'],['dc:description','Description'],['pdf:keywords','Keywords'],['xmp:createdate','Created'],['xmp:modifydate','Modified']] as const
function field(label: string, raw: unknown): InfoField {
  const arrayTruncated = Array.isArray(raw) && (raw.length > 20 || raw.some(item => typeof item === 'string' && item.length > INFO_FIELD_LIMIT))
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.filter(item => typeof item === 'string').slice(0, 20).map(item => item.slice(0, INFO_FIELD_LIMIT)).join('; ') : ''
  return { label, value: value.slice(0, INFO_FIELD_LIMIT) || 'Not supplied', truncated: arrayTruncated || value.length > INFO_FIELD_LIMIT }
}
async function wait<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  let rejectAbort: (error: CancelledError) => void = () => {}
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject })
  const abort = () => rejectAbort(new CancelledError())
  signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort()
  try { return await Promise.race([pending, aborted]) } finally { signal.removeEventListener('abort', abort) }
}

/** Geometry and allowlisted metadata only: no text extraction, rendering, or signature verification. */
export function startDocumentInfo(input: DocumentInfoInput, events: JobEvents = {}) {
  return runJob('doc-info', { file: { ...input.file } }, async (request, ctx): Promise<DocumentInfo> => {
    const meta = validateFile(request.file.displayName, request.file.bytes, 'pdf', { allowEncrypted: true })
    const controller = new AbortController(), monitor = setInterval(() => { if (ctx.isCancelled()) controller.abort() }, 20)
    const check = () => { if (ctx.isCancelled()) throw new CancelledError() }
    const report: DocumentInfo = { name: meta.displayName, byteLength: meta.byteLength, locked: false, encryption: 'unknown', fields: [], xmp: [], pages: [], warnings: [] }
    let doc: InspectorDocument | undefined
    try {
      check()
      try { doc = await openDocument(request.file.bytes, { strict: true, quiet: true, signal: controller.signal }) as InspectorDocument }
      catch (error) {
        check()
        // Only the parser's PasswordException mapping confirms a locked document; a byte marker does not.
        if ((error as ToolError).code !== 'E-INPUT-02') throw error
        return { ...report, locked: true, encryption: 'password-required', warnings: ['A password is required. Page count, metadata and signature indicators cannot be inspected in this release.'] }
      }
      check(); report.pageCount = doc.numPages
      try {
        const metadata = await wait(doc.getMetadata(), controller.signal), info = metadata.info as Record<string, unknown>
        report.version = typeof info.PDFFormatVersion === 'string' ? info.PDFFormatVersion.slice(0, 20) : undefined
        report.encryption = typeof info.EncryptFilterName === 'string' ? 'encrypted' : info.EncryptFilterName === null ? 'none-reported' : 'unknown'
        report.signatureFlag = typeof info.IsSignaturesPresent === 'boolean' ? info.IsSignaturesPresent : undefined
        report.fields = dictionaryFields.map(([key,label]) => field(label, info[key]))
        report.xmp = metadata.metadata ? xmpFields.map(([key,label]) => field(label, metadata.metadata.get(key))) : []
      } catch { check(); report.warnings.push('Document metadata could not be inspected. Unavailable indicators remain unknown.') }
      try { const signatures = await wait(doc.getSignatures(), controller.signal); report.signatureEntries = signatures?.length ?? 0 }
      catch { check(); report.warnings.push('Digital signature entries could not be inspected. Their presence is unknown.') }
      for (let number = 1; number <= doc.numPages; number++) {
        check(); const page = await wait(doc.getPage(number), controller.signal)
        try {
          check(); const view = page.getViewport({ scale: 1 }), userUnit = (page as unknown as { userUnit: number }).userUnit
          if (![view.width, view.height, page.rotate, userUnit].every(Number.isFinite) || view.width <= 0 || view.height <= 0 || userUnit <= 0) throw toolError('E-INPUT-03', 'A page has invalid dimensions.', 'retry-file')
          report.pages.push({ number, width: view.width, height: view.height, rotation: page.rotate, userUnit })
        } finally { page.cleanup() }
        ctx.reportProgress(number / doc.numPages, `Inspected page ${number} of ${doc.numPages}`)
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      check(); return report
    } finally { clearInterval(monitor); await doc?.destroy() }
  }, events)
}
