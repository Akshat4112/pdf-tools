import { PUBLIC_PAGES, SITE_URL, SITE_NAME, SITE_DESCRIPTION, toolPageMeta, hubPageMeta, GUIDE_INDEX_META, guidePageMeta, INFO_PAGE_META } from './pageMetadata.ts'
import { TOOLS } from '../registry.ts'
import { HUBS, hubForTool } from './categoryHubs.ts'
import { GUIDES } from './guideCatalog.ts'
export const STRUCTURED_DATA_ID = 'public-structured-data'
export type SchemaNode = { '@type': string; '@id': string; [key: string]: unknown }
/** An exact public canonical allowlist prevents query/file state from entering JSON-LD. */
export function pageStructuredData(canonical: string): { '@context': string; '@graph': SchemaNode[] } | null {
  const page = PUBLIC_PAGES.find(page => page.canonical === canonical)
  if (!page) return null
  const license = 'https://github.com/Akshat4112/pdf-tools/blob/main/LICENSE'
  const site = { '@id': `${SITE_URL}#website` }
  const application = (url: string, name: string, description: string): SchemaNode => ({
    '@type': 'WebApplication', '@id': `${url}#application`, url, name, description,
    applicationCategory: 'UtilitiesApplication',
    isAccessibleForFree: true, license, offers: { '@type': 'Offer', price: 0 },
  })
  const graph: SchemaNode[] = []
  if (canonical === SITE_URL) {
    graph.push({ '@type': 'WebSite', ...site, url: SITE_URL, name: SITE_NAME, description: SITE_DESCRIPTION, inLanguage: 'en' })
    graph.push(application(SITE_URL, SITE_NAME, SITE_DESCRIPTION))
  } else {
    const tool = TOOLS.find(tool => tool.implemented && toolPageMeta(tool).canonical === canonical)
    const hub = tool ? hubForTool(tool) : HUBS.find(h => hubPageMeta(h).canonical === canonical)
    const guide = GUIDES.find(g => guidePageMeta(g).canonical === canonical)
    const info = INFO_PAGE_META.find(p => `${SITE_URL}${p.dir}/` === canonical)
    const trail = [
      { name: 'All PDF tools', item: SITE_URL },
      info ? { name: info.title, item: canonical } : hub ? { name: hub.title, item: hubPageMeta(hub).canonical } : { name: 'Guides', item: GUIDE_INDEX_META.canonical },
      ...(tool ? [{ name: tool.title, item: canonical }] : guide ? [{ name: guide.title, item: canonical }] : []),
    ]
    graph.push({ '@type': 'BreadcrumbList', '@id': `${canonical}#breadcrumb`,
      itemListElement: trail.map((entry, index) => ({ '@type': 'ListItem', position: index + 1, ...entry })),
    })
    if (tool) graph.push(application(canonical, tool.title, page.description))
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

/** JSON inside HTML must never be able to close its script element. */
export function serializeStructuredData(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
}
export function structuredDataScript(canonical: string): string {
  const data = pageStructuredData(canonical)
  return data ? `<script id="${STRUCTURED_DATA_ID}" type="application/ld+json">${serializeStructuredData(data)}</script>` : ''
}
