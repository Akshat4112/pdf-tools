import { describe, it, expect } from 'vitest'
import { PUBLIC_PAGES, SITE_URL, NOT_FOUND_META, pageStructuredData, serializeStructuredData, withPageMetadata } from '../lib/pageMetadata'

describe('public structured data', () => {
  it('allows exact public canonicals only, never file/query/fragment state', () => {
    for (const page of PUBLIC_PAGES) expect(pageStructuredData(page.canonical)).not.toBeNull()
    for (const url of [NOT_FOUND_META.canonical, `${SITE_URL}missing/`, `${SITE_URL}?file=private.pdf`, `${SITE_URL}merge/#private`, SITE_URL.slice(0, -1)]) expect(pageStructuredData(url)).toBeNull()
  })
  it('uses real free/license data without unsupported ratings or certifications', () => {
    for (const page of PUBLIC_PAGES) {
      const data = pageStructuredData(page.canonical)!
      for (const app of data['@graph'].filter(n => n['@type'] === 'WebApplication')) {
        expect(app.isAccessibleForFree).toBe(true); expect(app.offers).toEqual({ '@type': 'Offer', price: 0 })
        expect(app.license).toBe('https://github.com/Akshat4112/pdf-tools/blob/main/LICENSE')
      }
      expect(JSON.stringify(data)).not.toMatch(/"(?:aggregateRating|review|certification|potentialAction)"\s*:/)
      const crumbs = data['@graph'].find(n => n['@type'] === 'BreadcrumbList')
      if (crumbs) {
        const items = crumbs.itemListElement as { position: number; item: string }[]
        expect(items.length).toBeGreaterThanOrEqual(2)
        expect(items.map(i => i.position)).toEqual(items.map((_, i) => i + 1))
        for (const item of items) expect(PUBLIC_PAGES.some(p => p.canonical === item.item)).toBe(true)
      }
    }
  })
  it('safely serializes script delimiters and preserves JSON meaning', () => {
    const input = { name: '</script><script>alert("x")</script>&\u2028\u2029' }
    const text = serializeStructuredData(input)
    expect(text).not.toMatch(/[<>&\u2028\u2029]/); expect(JSON.parse(text)).toEqual(input)
  })
  it('replaces stale schema and excludes caller-supplied titles from public JSON', () => {
    const meta = { ...PUBLIC_PAGES[0], title: 'private-canary.pdf' }
    const once = withPageMetadata('<head><title>Old</title></head>', meta)
    const twice = withPageMetadata(once, meta)
    expect(twice.match(/id="public-structured-data"/g)).toHaveLength(1)
    const json = twice.match(/type="application\/ld\+json">(.*?)<\/script>/)![1]
    expect(json).not.toContain('private-canary')
    expect(withPageMetadata(twice, NOT_FOUND_META)).not.toContain('public-structured-data')
  })
})
