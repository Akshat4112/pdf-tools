import { describe, expect, it } from 'vitest'
import { germanDeleteStaticHtml, germanDeleteArticleHtml } from './germanDeleteContent'
import { GERMAN_DELETE_META } from './germanDeleteMeta'
describe('German Delete Pages publication', () => {
  it('documents selection, confirmation, limits, privacy and redaction risk', () => {
    const html = germanDeleteStaticHtml()
    expect(html.match(/<h1\\b/g)).toHaveLength(1)
    for (const word of ['50 MiB', '300 Seiten', 'keine sichere Schwärzung', 'Bestätige', 'JavaScript', 'Digitale Signaturen', 'GitHub Pages']) expect(html).toContain(word)
    expect(germanDeleteArticleHtml()).not.toContain('<h1')
    expect(GERMAN_DELETE_META.canonical).toBe('https://akshat4112.github.io/pdf-tools/de/delete-pages/')
  })
})
