import { describe, it, expect } from 'vitest'
import { HUBS, hubTools, hubForTool, hubPath, publicHref, breadcrumbHtml, relatedToolsHtml } from '../lib/categoryHubs'
import { TOOLS } from '../registry'
import { parsePath, metaForRoute } from '../router'
import { hubPageMeta, PUBLIC_PAGES } from '../lib/pageMetadata'

describe('public category hierarchy', () => {
  it('covers every shipped tool once with useful multi-tool hubs', () => {
    const members = HUBS.flatMap(h => hubTools(h).map(t => t.id))
    expect(members.sort()).toEqual(TOOLS.filter(t => t.implemented).map(t => t.id).sort())
    for (const hub of HUBS) expect(hubTools(hub).length).toBeGreaterThanOrEqual(2)
  })
  it('resolves slash variants and metadata without creating filter URLs', () => {
    for (const hub of HUBS) {
      for (const path of [publicHref(hubPath(hub)), publicHref(hubPath(hub)).replace(/\/$/, '')]) {
        const route = parsePath(path)
        expect(route.name).toBe('category'); expect(metaForRoute(route)).toEqual(hubPageMeta(hub))
      }
      expect(PUBLIC_PAGES.some(p => p.canonical === hubPageMeta(hub).canonical)).toBe(true)
    }
    expect(parsePath('/pdf-tools/tools/unknown/').name).toBe('not-found')
  })
  it('relates each tool to its hub and siblings without linking to itself', () => {
    for (const tool of TOOLS) {
      const hub = hubForTool(tool), html = relatedToolsHtml(tool)
      expect(html).toContain(publicHref(hubPath(hub)))
      expect(html).not.toContain(`href="${publicHref(tool.route)}"`)
      expect(breadcrumbHtml(hub, tool)).toContain(`aria-current="page">${tool.title}`)
    }
  })
})
