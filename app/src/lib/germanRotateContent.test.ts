import { describe, expect, it } from 'vitest'
import { germanRotateArticleHtml, germanRotateStaticHtml } from './germanRotateContent'
import { GERMAN_ROTATE_META } from './germanRotateMeta'

describe('German Rotate public content', () => {
  it('provides complete static help and accurate published metadata', () => {
    const html = germanRotateStaticHtml()
    expect(html).toContain('PDF-Seiten')
    expect(html).toContain('90-Grad-Schritten')
    expect(html).toContain('JavaScript')
    expect(html).toContain('Digitale Signaturen')
    expect(html).toContain('50 MiB')
    expect(html).toContain('/pdf-tools/de/split/')
    expect(GERMAN_ROTATE_META.canonical).toBe('https://akshat4112.github.io/pdf-tools/de/rotate/')
    expect(germanRotateArticleHtml()).not.toContain('financial-statement_PRIVATE.pdf')
  })
})
