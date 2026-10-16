import type { PDFLinkService } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'

/** Documents are supplied as bytes, never a document-controlled URL.
 * Asset delivery is still online and self-hosted; these flags are not a network sandbox. */
export const PDF_DOCUMENT_SAFETY = Object.freeze({
  enableXfa: false, disableAutoFetch: true, disableStream: true, disableRange: true,
  // Defense for older adapters; PDF.js 6.4 no longer consumes this legacy option.
  isEvalSupported: false,
})

/** Remove external destinations entirely (including middle-click/context-menu use).
 * Preserve internal page destinations and read-only annotation appearances. */
export function restrictPdfLinks(service: PDFLinkService): void {
  service.externalLinkEnabled = false
  service.addLinkAttributes = link => {
    link.removeAttribute('href'); link.removeAttribute('target')
    link.setAttribute('aria-disabled', 'true')
    link.title = 'External PDF links are disabled'
    link.onclick = event => { event.preventDefault(); return false }
  }
  // Attachments/media are outside the reader's supported read/search/print scope.
  service.getAttachmentContent = async () => null
  const navigate = service.executeNamedAction.bind(service)
  service.executeNamedAction = action => {
    if (['NextPage', 'PrevPage', 'FirstPage', 'LastPage'].includes(action)) navigate(action)
  }
}
