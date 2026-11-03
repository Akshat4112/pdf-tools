import { describe, expect, it } from 'vitest'
import { germanSplitArticleHtml, germanSplitStaticHtml } from './germanSplitContent'

describe('complete German Split guidance', () => {
  it('describes real modes, partial/overlapping ranges, ZIP output and limits without document data', () => {
    const html = germanSplitStaticHtml()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(germanSplitArticleHtml()).not.toContain('<h1')
    for (const text of ['Eigene Seitenbereiche', 'Alle N Seiten', 'Eine Datei pro Seite', 'überschneiden', 'Nicht gewählte Seiten', 'letzte Teil kann kürzer', 'ZIP-Datei', '50 MiB', '300 Seiten', '300 PDF-Teile', 'Digitale Signaturen', 'Betriebssystemspeichers', 'JavaScript']) expect(html).toContain(text)
    expect(html).toContain('href="/pdf-tools/de/merge/" hreflang="de"')
    expect(html).toContain('href="/pdf-tools/extract-pages/" hreflang="en"')
  })
})
