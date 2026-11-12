import { describe, expect, it } from 'vitest'
import { germanImagesToPdfStaticHtml, germanImagesToPdfArticleHtml } from './germanImagesToPdfContent'
import { GERMAN_IMAGES_TO_PDF_META } from './germanImagesToPdfMeta'

describe('German Images to PDF landing', () => {
  it('ships accurate static instructions and quota/disclosure text', () => {
    const html = germanImagesToPdfStaticHtml()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    for (const text of ['JavaScript', 'JPG-', 'PNG-', '50 MiB', '300 Bilder', '25,6 Millionen', 'Transparente', 'weiße Ränder', 'GitHub Pages', 'OCR']) expect(html).toContain(text)
    expect(germanImagesToPdfArticleHtml()).not.toContain('<h1')
    expect(GERMAN_IMAGES_TO_PDF_META.canonical).toBe('https://akshat4112.github.io/pdf-tools/de/images-to-pdf/')
  })
})
