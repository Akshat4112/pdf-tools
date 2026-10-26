import { describe, expect, it } from 'vitest'
import { INFO_PAGE_META, PUBLIC_PAGES, infoPageMeta } from '../lib/pageMetadata'
import { publicInfoHtml } from '../lib/publicInfo'

describe('PT-REL-001 authored public help, privacy and limitations pages', () => {
  it('generates three unique canonical pages with document-independent text', () => {
    expect(INFO_PAGE_META).toHaveLength(3)
    expect(new Set(INFO_PAGE_META.map(p => p.path)).size).toBe(3)
    for (const p of INFO_PAGE_META) {
      const info = infoPageMeta(p.path)!
      expect(info.canonical).toBe(`https://akshat4112.github.io/pdf-tools/${p.dir}/`)
      expect(PUBLIC_PAGES.some(page => page.canonical === info.canonical)).toBe(true)
      const html = publicInfoHtml(p.path)!
      expect(html).toContain(`<h1>${p.title}</h1>`)
      expect(html).not.toContain('<form')
      expect(html).not.toContain('private-file-canary.pdf')
    }
  })
  it('uses a strict route map, not arbitrary path/query interpolation', () => {
    expect(infoPageMeta('/privacy?filename=private.pdf')).toBeUndefined()
    expect(publicInfoHtml('/privacy?filename=private.pdf')).toBeUndefined()
    expect(publicInfoHtml('<script>alert(1)</script>')).toBeUndefined()
  })
  it('warns about hosting IP metadata, memory erasure and public reports', () => {
    const notice = publicInfoHtml('/privacy')!
    expect(notice).toContain('IP address')
    expect(notice).toContain('secure erasure')
    expect(notice).toContain('GitHub Pages')
    expect(publicInfoHtml('/limitations')).toContain('not')
    expect(publicInfoHtml('/help')).toContain('Never post personal')
  })
})
