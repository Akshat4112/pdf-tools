import { describe, expect, it } from 'vitest'
import { germanPdfToJpgArticleHtml, germanPdfToJpgStaticHtml } from './germanPdfToJpgContent'
import { GERMAN_PDF_TO_JPG_META } from './germanPdfToJpgMeta'

describe('German PDF to JPG authored page', () => {
  it('provides one heading and documents page order, privacy, limits, and JavaScript-free guidance', () => {
    const html = germanPdfToJpgStaticHtml()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    for (const piece of ['3, 1, 5-8', 'Reihenfolge', '50 MiB', '300 PDF-Seiten', '8192', 'JPG', 'GitHub Pages', 'JavaScript']) expect(html).toContain(piece)
    expect(germanPdfToJpgArticleHtml()).not.toContain('<h1')
    expect(GERMAN_PDF_TO_JPG_META.canonical).toBe('https://akshat4112.github.io/pdf-tools/de/pdf-to-jpg/')
  })
})
