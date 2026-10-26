import { GUIDES } from '../lib/guideCatalog'
import { HUBS } from '../lib/categoryHubs'
import { describe, expect, it } from 'vitest'
import { CATALOG_META, NOT_FOUND_META, PUBLIC_PAGES, SHARE_IMAGE, pageMetaTags, toolPageMeta, withPageMetadata } from '../lib/pageMetadata'
import { TOOLS } from '../registry'

describe('PT-SEO-005 public metadata', () => {
  it('covers only shipped routes with distinct useful copy', () => {
    expect(PUBLIC_PAGES).toHaveLength(TOOLS.filter(tool => tool.implemented).length + HUBS.length + GUIDES.length + 2)
    expect(new Set(PUBLIC_PAGES.map(page => page.title)).size).toBe(PUBLIC_PAGES.length)
    expect(new Set(PUBLIC_PAGES.map(page => page.description)).size).toBe(PUBLIC_PAGES.length)
    for (const page of PUBLIC_PAGES) {
      expect(page.title).toContain('PDF Tools')
      expect(page.description.length).toBeLessThanOrEqual(160)
      expect(page.description.length).toBeGreaterThan(20)
      expect(page.canonical).not.toMatch(/[?#]/)
    }
    expect(toolPageMeta(TOOLS.find(tool => tool.id === 'pdf-to-text')!).description).toContain('does not recognize text in images')
    expect(toolPageMeta(TOOLS.find(tool => tool.id === 'doc-info')!).description).toContain('do not validate authenticity')
  })

  it('includes a single branded social image with its real dimensions and descriptive alt text', () => {
    const tags = pageMetaTags(CATALOG_META)
    const content = (key: string) => tags.find(tag => tag.key === key)?.content
    expect(content('og:image')).toBe('https://akshat4112.github.io/pdf-tools/brand/social-card.png')
    expect(content('twitter:image')).toBe(content('og:image'))
    expect(content('og:image:width')).toBe('1200')
    expect(content('og:image:height')).toBe('630')
    expect(content('og:image:type')).toBe('image/png')
    expect(content('twitter:card')).toBe('summary_large_image')
    expect(content('og:image:alt')).toBe(SHARE_IMAGE.alt)
    expect(content('twitter:image:alt')).toBe(SHARE_IMAGE.alt)
  })

  it('replaces metadata idempotently instead of accumulating stale route tags', () => {
    const base = '<html><head><title>Old page</title><meta name="description" content="old"><link rel="canonical" href="old"><meta property="og:title" content="old"></head><body>Public content</body></html>'
    const once = withPageMetadata(base, CATALOG_META)
    const twice = withPageMetadata(once, NOT_FOUND_META)
    for (const tag of pageMetaTags(NOT_FOUND_META)) {
      expect(twice.match(new RegExp(`${tag.attribute}="${tag.key}"`, 'g'))).toHaveLength(1)
    }
    expect(twice.match(/rel="canonical"/g)).toHaveLength(1)
    expect(withPageMetadata(twice, NOT_FOUND_META)).toBe(twice)
    expect(twice).toContain('<body>Public content</body>')
    expect(twice).not.toContain('content="old"')
  })

  it('escapes HTML attribute and title syntax', () => {
    const meta = { ...CATALOG_META, title: '<PDF> & tools', description: 'A "quoted" <description> & more' }
    const html = withPageMetadata('<head><title>Old</title></head>', meta)
    expect(html).toContain('<title>&lt;PDF&gt; &amp; tools</title>')
    expect(html).toContain('content="A &quot;quoted&quot; &lt;description&gt; &amp; more"')
    expect(html).not.toContain('<description>')
  })
})
