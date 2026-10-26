import { describe, expect, it } from 'vitest'
import { GUIDES, guidePath } from '../lib/guideCatalog'
import { guideHtml } from '../lib/guideContent'
import { GUIDE_INDEX_META, PUBLIC_PAGES, guidePageMeta } from '../lib/pageMetadata'
import { parsePath, metaForRoute } from '../router'
import { getTool } from '../registry'
import { createGuideExamples } from '../lib/guideExamples'
import { PDFDocument } from 'pdf-lib'

describe('PT-SEO-009 published guides', () => {
  it.each(GUIDES)('keeps $id static metadata, routes and shipped-tool links in agreement', guide => {
    const path = guidePath(guide), route = parsePath(`/pdf-tools${path}/`)
    expect(route.name).toBe('guide')
    expect(metaForRoute(route)).toEqual(guidePageMeta(guide))
    expect(PUBLIC_PAGES.filter(page => page.canonical === guidePageMeta(guide).canonical)).toHaveLength(1)
    expect(guide.description.length).toBeLessThanOrEqual(160)
    const html = guideHtml(path)!
    expect(html).toContain(`<h1>${guide.title}</h1>`)
    expect(html).toContain('Synthetic'.toLowerCase())
    for (const id of guide.tools) {
      expect(getTool(id).implemented).toBe(true)
      expect(html).toContain(`href="/pdf-tools${getTool(id).route}/"`)
    }
  })
  it('indexes the directory while unknown/private-state paths get no guide body', () => {
    expect(metaForRoute(parsePath('/pdf-tools/guides/'))).toEqual(GUIDE_INDEX_META)
    expect(guideHtml('/guides')).toContain('Choose a guide')
    for (const path of ['/guides/unknown', '/guides/copy-text-or-scan?file=private', '/guides/../merge', '/guides/copy-text-or-scan#secret']) expect(guideHtml(path)).toBeUndefined()
  })
  it('generates only the six documented public samples with the expected page structures', async () => {
    const samples = await createGuideExamples()
    expect(Object.keys(samples).sort()).toEqual(['appendix.pdf','cover.pdf','landscape.png','pages.pdf','portrait.png','scan.pdf'])
    for (const [name, count] of [['cover.pdf',1],['appendix.pdf',2],['pages.pdf',3],['scan.pdf',1]] as const) {
      const doc = await PDFDocument.load(samples[name])
      expect(doc.getPageCount()).toBe(count)
      expect(doc.getTitle()).toContain('synthetic')
      expect(doc.getForm().getFields()).toHaveLength(0)
    }
    for (const name of ['landscape.png','portrait.png']) expect([...samples[name].slice(0,8)]).toEqual([137,80,78,71,13,10,26,10])
  })
})
