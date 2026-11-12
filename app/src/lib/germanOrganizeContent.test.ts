import { describe, expect, it } from 'vitest'
import { germanOrganizeArticleHtml, germanOrganizeStaticHtml } from './germanOrganizeContent'
import { GERMAN_ORGANIZE_META } from './germanOrganizeMeta'

describe('German Organize PDF publication', () => {
  it('contains complete authored no-JS, accessibility, safety and privacy guidance', () => {
    const html = germanOrganizeStaticHtml()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    for (const phrase of ['Drag-and-drop', 'Tastatur', 'Screenreader', 'Zielposition', 'Duplizieren', '300 Seiten', '50 MiB', 'keine sichere Schwärzung', 'GitHub Pages', 'JavaScript']) expect(html).toContain(phrase)
    expect(germanOrganizeArticleHtml()).not.toContain('<h1')
    expect(GERMAN_ORGANIZE_META.canonical).toBe('https://akshat4112.github.io/pdf-tools/de/organize/')
  })
})
