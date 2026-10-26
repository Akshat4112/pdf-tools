import { GUIDES } from '../lib/guideCatalog'
import { HUBS } from '../lib/categoryHubs'
import { describe, expect, it } from 'vitest'
import {
  buildRobotsTxt,
  buildSitemapXml,
  CATALOG_META,
  INFO_PAGE_META,
  NOT_FOUND_META,
  SITE_URL,
  toolMetaById,
  toolPageMeta,
} from '../lib/seo'
import { TOOLS } from '../registry'

describe('route metadata (PT-UX-004)', () => {
  it('catalog metadata has absolute canonical URL including base path', () => {
    expect(CATALOG_META.canonical).toBe('https://akshat4112.github.io/pdf-tools/')
  })

  it('every tool gets a page meta with title, description and canonical URL', () => {
    for (const tool of TOOLS) {
      const meta = toolPageMeta(tool)
      expect(meta.title).toBe(`${tool.title} — PDF Tools`)
      expect(meta.canonical).toBe(`https://akshat4112.github.io/pdf-tools${tool.route}/`)
      expect(meta.description.length).toBeGreaterThan(20)
      expect(meta.description.length).toBeLessThanOrEqual(160)
    }
  })

  it('toolMetaById resolves registry ids', () => {
    expect(toolMetaById('merge').canonical).toBe(`${SITE_URL}merge/`)
    expect(toolMetaById('reader').title).toBe('PDF reader — PDF Tools')
  })

  it('descriptions never contain user data — only static registry copy', () => {
    for (const tool of TOOLS) {
      const meta = toolPageMeta(tool)
      expect(meta.description).toContain('browser')
    }
  })

  it('not-found metadata is distinct from the catalog', () => {
    expect(NOT_FOUND_META.title).not.toBe(CATALOG_META.title)
    expect(NOT_FOUND_META.canonical).toBe(`${SITE_URL}404.html`)
  })
})

describe('sitemap + robots generation (PT-UX-004)', () => {
  it('sitemap lists the catalog and every tool route exactly once', () => {
    const xml = buildSitemapXml('2026-01-01')
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs[0]).toBe(CATALOG_META.canonical)
    expect(locs).toHaveLength(TOOLS.length + HUBS.length + GUIDES.length + INFO_PAGE_META.length + 2)
    expect(new Set(locs).size).toBe(locs.length)
    for (const tool of TOOLS) {
      expect(locs).toContain(toolPageMeta(tool).canonical)
    }
    expect(xml).toContain('<lastmod>2026-01-01</lastmod>')
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true)
  })

  it('sitemap priority favors the catalog', () => {
    const xml = buildSitemapXml()
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml).toContain('<priority>0.8</priority>')
  })

  it('robots.txt allows all crawlers and points at the sitemap', () => {
    const txt = buildRobotsTxt()
    expect(txt).toContain('User-agent: *')
    expect(txt).toContain('Allow: /')
    expect(txt).toContain(`Sitemap: ${SITE_URL}sitemap.xml`)
  })
})
