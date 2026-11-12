import { describe, expect, it } from 'vitest'
import { germanExtractArticleHtml, germanExtractStaticHtml } from './germanExtractContent'
import { GERMAN_EXTRACT_META } from './germanExtractMeta'

describe('German Extract Pages authored content', () => {
  it('provides a single heading, correct ordering, limits, safety and no-JS instructions', () => {
    const html = germanExtractStaticHtml()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    for (const piece of ['aufsteigender Reihenfolge', '50 MiB', '300 Seiten', 'keine sichere Schwärzung', 'digitale Signaturen', 'GitHub Pages', 'JavaScript']) expect(html).toContain(piece)
    expect(germanExtractArticleHtml()).not.toContain('<h1')
    expect(GERMAN_EXTRACT_META.canonical).toBe('https://akshat4112.github.io/pdf-tools/de/extract-pages/')
    expect(html).not.toContain('PRIVATE_TEST_DOCUMENT.pdf')
  })
})
