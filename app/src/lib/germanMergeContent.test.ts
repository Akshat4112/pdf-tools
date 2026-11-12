import { describe, expect, it } from 'vitest'
import { germanMergeArticleHtml, germanMergeStaticHtml } from './germanMergeContent'
import { approvedLanguageAlternates, hasGermanPage } from './localizedRoutes'

describe('first complete German Merge page', () => {
  it('provides German formats, real limits, example, cleanup and signature caveats with one static heading', () => {
    const html = germanMergeStaticHtml()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    for (const text of ['50 MiB', '300 Seiten', 'Originale', 'Metadaten', 'Digitale Signaturen', 'JavaScript', 'Betriebssystemspeichers']) expect(html).toContain(text)
    expect(germanMergeArticleHtml()).not.toContain('<h1')
    expect(html).toContain('hreflang="en"')
  })
  it('only exposes approved catalog, Merge, Split and Rotate language pairs', () => {
    expect(hasGermanPage('/merge')).toBe(true)
    expect(hasGermanPage('/split')).toBe(true)
    expect(hasGermanPage('/rotate')).toBe(true)
    expect(hasGermanPage('/delete-pages')).toBe(true)
    expect(hasGermanPage('/extract-pages')).toBe(true)
    expect(hasGermanPage('/organize')).toBe(true)
    const merge = approvedLanguageAlternates('https://akshat4112.github.io/pdf-tools/de/merge/')
    expect(merge.map(x => x.href)).toEqual(['https://akshat4112.github.io/pdf-tools/merge/', 'https://akshat4112.github.io/pdf-tools/de/merge/', 'https://akshat4112.github.io/pdf-tools/merge/'])
    expect(approvedLanguageAlternates('https://akshat4112.github.io/pdf-tools/rotate/')).toHaveLength(3)
    expect(approvedLanguageAlternates('https://example.com/pdf-tools/merge/')).toEqual([])
  })
})
