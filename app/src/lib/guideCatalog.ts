import type { ToolId } from '../registry.ts'

/** Published, public editorial metadata only. Unpublished ideas live in the backlog. */
export const GUIDES = [
  { id: 'combine-pdfs-in-order', title: 'Combine PDFs in the right reading order', description: 'Plan a combined PDF, arrange its files, and check the finished page sequence using a small synthetic example.', tools: ['merge', 'organize', 'reader'], summary: 'Build one reading sequence from several documents, then verify the result.' },
  { id: 'share-selected-pages', title: 'Share selected PDF pages without sending the whole file', description: 'Choose between extracting, deleting and splitting PDF pages. Review a synthetic example and understand why page deletion is not redaction.', tools: ['extract-pages', 'delete-pages', 'split'], summary: 'Keep chosen pages together and understand what the new copy does not protect.' },
  { id: 'images-to-readable-pdf', title: 'Turn images into a readable PDF', description: 'Arrange JPG or PNG images, choose a page fit, and check orientation and legibility before sharing a PDF.', tools: ['images-to-pdf', 'reader'], summary: 'Choose layout settings that preserve the useful parts of each image.' },
  { id: 'copy-text-or-scan', title: 'Get text from a PDF and recognize an image-only scan', description: 'Check for an existing text layer, export UTF-8 text, and understand why image-only scans need OCR.', tools: ['reader', 'pdf-to-text'], summary: 'Distinguish text extraction from OCR and review the plain-text result.' },
] as const satisfies readonly { id: string; title: string; description: string; tools: readonly ToolId[]; summary: string }[]

export type Guide = typeof GUIDES[number]
export const guidePath = (guide: Guide) => `/guides/${guide.id}`
export const guideByPath = (path: string) => GUIDES.find(guide => guidePath(guide) === path)
export const isGuidePath = (path: string) => path === '/guides' || Boolean(guideByPath(path))
export const guideHref = (guide: Guide) => `/pdf-tools${guidePath(guide)}/`
const esc = (text: string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))

export function guideDirectoryHtml(heading = 'Practical PDF guides') {
  return `<section class="guide-directory" aria-labelledby="guides-heading"><h2 id="guides-heading">${esc(heading)}</h2><p>Work through a specific task with small synthetic examples and checks you can repeat.</p><ul>${GUIDES.map(guide => `<li><a href="${guideHref(guide)}">${esc(guide.title)}</a><p>${esc(guide.summary)}</p></li>`).join('')}</ul><a href="/pdf-tools/guides/">Browse all PDF guides</a></section>`
}

export function relatedGuidesHtml(tool: ToolId) {
  const guides = GUIDES.filter(guide => guide.tools.some(id => id === tool))
  return guides.length ? `<nav class="related-tools" aria-label="Related practical guides"><h2>Practical guides</h2><ul>${guides.map(guide => `<li><a href="${guideHref(guide)}">${esc(guide.title)}</a></li>`).join('')}</ul></nav>` : ''
}
