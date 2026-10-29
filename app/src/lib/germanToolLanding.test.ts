import { describe, expect, it } from 'vitest'
import { germanToolLandingHtml, type GermanToolLandingCopy } from './germanToolLanding'

const copy: GermanToolLandingCopy = {
  title: 'PDFs zusammenfügen — PDF Tools',
  heading: 'PDF-Dateien zusammenfügen',
  description: 'Füge deine PDFs kostenlos und direkt im Browser zusammen.',
  steps: ['Zwei PDFs auswählen.', 'Die gewünschte Reihenfolge festlegen.', 'Das Ergebnis prüfen und herunterladen.'],
  limitation: 'Digitale Signaturen können beim Bearbeiten ihre Gültigkeit verlieren.',
}

describe('PT-SEO-010 gated German tool landing renderer', () => {
  it('renders meaningful German static content and English fallback without publishing hreflang', () => {
    const html = germanToolLandingHtml({ id: 'merge', route: '/merge' }, copy)
    expect(html).toContain('<h1 class="tool-heading">PDF-Dateien zusammenfügen</h1>')
    expect(html).toContain('aria-current="page"')
    expect(html.match(/<li>/g)).toHaveLength(3)
    expect(html).toContain('Digitale Signaturen')
    expect(html).toContain('href="/pdf-tools/de/"')
    expect(html).toContain('href="/pdf-tools/merge/" lang="en"')
    expect(html).not.toContain('rel="canonical"')
    expect(html).not.toContain('hreflang=')
    expect(html).not.toContain('upload')
  })
  it('escapes authored content for safe HTML output', () => {
    const html = germanToolLandingHtml({ id: 'merge', route: '/merge' }, {
      ...copy,
      description: 'PDF & <script>alert("x")</script>',
    })
    expect(html).toContain('PDF &amp; &lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
  it('rejects nonregistry paths and incomplete translation content', () => {
    expect(() => germanToolLandingHtml({ id: 'merge', route: '/../privacy' }, copy)).toThrow()
    expect(() => germanToolLandingHtml({ id: 'merge', route: '/merge' }, { ...copy, steps: ['', 'Zwei', 'Drei'] })).toThrow()
    expect(() => germanToolLandingHtml({ id: 'merge', route: '/merge' }, { ...copy, limitation: '' })).toThrow()
  })
})
