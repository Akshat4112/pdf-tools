import { TOOLS, type ToolCategory, type ToolDefinition } from '../registry.ts'

/** Public navigation only; filter/search state and document data never create URLs. */
export const HUBS = [
  { id: 'organize', title: 'Organize PDF pages', description: 'Choose the right tool to combine, separate, reorder or rotate PDF pages.', categories: ['organize'], guidance: 'Merge combines documents. Split creates separate parts. Extract keeps chosen pages together, while Delete pages removes whole pages from a new copy. Organize combines page arrangement controls; Rotate corrects quarter-turn orientation.', caution: 'Deleting pages is not redaction. Keep the original: rewriting may invalidate signatures or omit interactive features.' },
  { id: 'convert', title: 'Convert PDFs and images', description: 'Turn JPG and PNG images into a PDF, or export PDF pages and existing text.', categories: ['convert-to-pdf','convert-from-pdf'], guidance: 'Choose JPG/PNG to PDF for one image per page. PDF to JPG and PDF to PNG render page appearance as images. PDF to text exports an existing text layer as UTF-8 TXT. Compare each tool’s limits before selecting large files.', caution: 'Page rendering does not extract original embedded images. Text export does not perform OCR or create Word files; scans need a text layer first.' },
  { id: 'read', title: 'Read and inspect PDFs', description: 'Read, search and print a PDF, or inspect its metadata and page dimensions.', categories: ['view'], guidance: 'Use PDF reader for page navigation, zoom, searching existing text and local printing. Use Document information to inspect page count, cropped dimensions, rotation, metadata and document indicators without rewriting a PDF.', caution: 'Image-only scans cannot be searched without OCR. Metadata can be incomplete, and signature indicators do not establish authenticity or validate certificates.' },
  { id: 'markup', title: 'Add PDF numbers and watermarks', description: 'Add visible page numbers or a text watermark to selected PDF pages.', categories: ['markup'], guidance: 'Choose Page numbers for visible numbering with a chosen starting value and position. Choose Text watermark for a stamp such as DRAFT with opacity and placement controls. Both tools show the modified preview before applying changes to a new copy.', caution: 'A watermark is not access control or redaction. Visible numbers do not update internal PDF page labels. Review placement and retain the original, especially for signed documents.' },
] as const satisfies readonly { id: string; title: string; description: string; categories: readonly ToolCategory[]; guidance: string; caution: string }[]
export type CategoryHub = typeof HUBS[number]
export const hubPath = (hub: CategoryHub) => `/tools/${hub.id}`
export const hubByPath = (path: string) => HUBS.find(h => hubPath(h) === path)
export const hubForTool = (tool: ToolDefinition) => HUBS.find(h => (h.categories as readonly string[]).includes(tool.category))!
export const hubTools = (hub: CategoryHub) => TOOLS.filter(t => t.implemented && (hub.categories as readonly string[]).includes(t.category))
export const publicHref = (path: string) => `/pdf-tools${path === '/' ? '/' : `${path}/`}`
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export function breadcrumbHtml(hub: CategoryHub, tool?: ToolDefinition) {
  return `<nav class="workspace-breadcrumb" aria-label="Breadcrumb"><a href="/pdf-tools/">All PDF tools</a><span aria-hidden="true">/</span>${tool ? `<a href="${publicHref(hubPath(hub))}">${esc(hub.title)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(tool.title)}</span>` : `<span aria-current="page">${esc(hub.title)}</span>`}</nav>`
}
export function hubDirectoryHtml() {
  return `<nav class="hub-directory" aria-label="PDF task categories">${HUBS.map(h => `<a href="${publicHref(hubPath(h))}">${esc(h.title)}</a>`).join('')}</nav>`
}
export function categoryHubHtml(hub: CategoryHub) {
  return `${breadcrumbHtml(hub)}<header class="tool-header"><h1 class="tool-heading">${esc(hub.title)}</h1><p class="tool-subtitle">${esc(hub.description)}</p></header><section aria-label="Choose a tool"><h2>Which tool fits your task?</h2><p>${esc(hub.guidance)}</p><ul class="hub-tool-list">${hubTools(hub).map(t => `<li><a href="${publicHref(t.route)}">${esc(t.title)}</a><p>${esc(t.description)}</p></li>`).join('')}</ul><p>${esc(hub.caution)}</p></section><section class="hub-evidence" aria-label="Help and source"><h2>Help, privacy and source</h2><p>Each tool has usage steps, supported formats, limits and a practical example below its utility. Document processing stays in this browser; loading the site still connects to its host.</p><a href="https://github.com/Akshat4112/pdf-tools/blob/main/docs/security/PT-SEC-002-local-processing-audit.md">Local-processing evidence on GitHub</a><a href="https://github.com/Akshat4112/pdf-tools/blob/main/docs/product/PT-PD-003-data-lifecycle.md">Privacy and data lifecycle on GitHub</a><a href="https://github.com/Akshat4112/pdf-tools/blob/main/LICENSE">MIT license on GitHub</a></section>${hubDirectoryHtml()}`
}
export function relatedToolsHtml(tool: ToolDefinition) {
  const hub = hubForTool(tool)
  const related = hubTools(hub).filter(t => t.id !== tool.id)
  return `<nav class="related-tools" aria-label="Related PDF tools"><h2>Related tools</h2><a href="${publicHref(hubPath(hub))}">Explore ${esc(hub.title)}</a><ul>${related.map(t => `<li><a href="${publicHref(t.route)}">${esc(t.title)}</a> — ${esc(t.description)}</li>`).join('')}</ul></nav>`
}
