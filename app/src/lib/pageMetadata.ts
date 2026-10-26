import { GUIDES, guidePath, type Guide } from './guideCatalog.ts'
import { HUBS, hubPath, hubForTool, type CategoryHub } from './categoryHubs.ts'
/** Shared, document-free metadata for static HTML and client navigation (PT-SEO-005). */
import { TOOLS, getTool, type ToolId, type ToolDefinition } from '../registry.ts'

/** Production origin + base path (PT-PD-004 §5). */
export const SITE_ORIGIN = 'https://akshat4112.github.io'
export const SITE_BASE = '/pdf-tools/'
export const SITE_URL = `${SITE_ORIGIN}${SITE_BASE}`

/** Static catalog-page copy (index). */
export const SITE_TITLE = 'PDF Tools — Free PDF tools on your device'
export const SITE_DESCRIPTION =
  'Free, open-source PDF tools to merge, split, organize, read and convert files in your browser. No account required; documents are processed on your device.'
export const SITE_NAME = 'PDF Tools'

export interface PageMeta {
  /** <title> content */
  title: string
  /** meta description (<= 160 chars) */
  description: string
  /** absolute canonical URL including /pdf-tools/ base */
  canonical: string
  /** Open Graph type; 'website' for catalog, 'article' feels wrong for tools */
  ogType: 'website' | 'article'
}

/** Catalog page metadata. */
export const CATALOG_META: PageMeta = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  canonical: SITE_URL,
  ogType: 'website',
}

/** Curated public descriptions describe shipped behavior, never selected documents. */
const TOOL_DESCRIPTIONS: Record<ToolId, string> = {
  merge: 'Merge PDFs in your chosen order into one file, free in your browser. Process documents on your device without an account.',
  split: 'Split a PDF by ranges, every N pages or one file per page. Download a ZIP of the parts, processed free in your browser.',
  rotate: 'Rotate selected PDF pages in 90-degree steps and download a new copy. Free browser tool; your original file stays unchanged.',
  'delete-pages': 'Remove selected pages from a PDF and save a new copy. Review the pages before deleting, free in your browser on your device.',
  'extract-pages': 'Extract selected PDF pages into a new file in the order you choose. Free browser tool with page previews and local processing.',
  organize: 'Reorder, rotate, duplicate and delete PDF pages with undo. Preview your page order and save a new copy, free in your browser.',
  'images-to-pdf': 'Turn JPG and PNG images into one PDF with one image per page. Choose page size, fit and margins, free in your browser.',
  'pdf-to-jpg': 'Convert selected PDF pages to JPG images with resolution and quality options. Download individual images or a ZIP, free in your browser.',
  'pdf-to-png': 'Convert selected PDF pages to PNG images with white or transparent backgrounds. Download images or a ZIP, free in your browser.',
  reader: 'Read PDFs in your browser: navigate, zoom, search existing text, copy and print. Free and processed on your device; no account required.',
  'page-numbers': 'Add page numbers to selected PDF pages with a starting number and position. Preview the result and save a new copy, free in your browser.',
  watermark: 'Add a text watermark to selected PDF pages with position and opacity options. Preview the result and download a new copy in your browser.',
  'pdf-to-text': 'Export an existing PDF text layer as UTF-8 TXT, free in your browser. Scanned pages need OCR; this tool does not recognize text in images.',
  'doc-info': 'Inspect PDF metadata, page count, dimensions and document indicators in your browser. Signature indicators do not validate authenticity.',
}

export function toolPageMeta(tool: ToolDefinition): PageMeta {
  return {
    title: `${tool.title} — PDF Tools`,
    description: TOOL_DESCRIPTIONS[tool.id],
    canonical: `${SITE_URL}${tool.route.replace(/^\//, '')}/`,
    ogType: 'website',
  }
}

export function toolMetaById(id: ToolId): PageMeta {
  return toolPageMeta(getTool(id))
}

export function hubPageMeta(hub: CategoryHub): PageMeta {
  return { title: `${hub.title} — PDF Tools`, description: `${hub.description} Free tools in your browser.`, canonical: `${SITE_URL}${hubPath(hub).slice(1)}/`, ogType: 'website' }
}

/** 404 page metadata (also used by 404.html). */
export const NOT_FOUND_META: PageMeta = {
  title: 'Page not found — PDF Tools',
  description: 'This page does not exist. Browse the PDF Tools catalog instead.',
  canonical: `${SITE_URL}404.html`,
  ogType: 'website',
}


export const GUIDE_INDEX_META: PageMeta = { title: 'Practical PDF guides — PDF Tools', description: 'Work through everyday PDF tasks with small synthetic examples, step-by-step checks and clear limits.', canonical: `${SITE_URL}guides/`, ogType: 'website' }
export const guidePageMeta = (guide: Guide): PageMeta => ({ title: `${guide.title} — PDF Tools`, description: guide.description, canonical: `${SITE_URL}${guidePath(guide).slice(1)}/`, ogType: 'article' })

/** Only shipped tools, hubs and published guides are indexable. */
export const PUBLIC_PAGES = [
  { dir: '.', ...CATALOG_META },
  { dir: 'guides', ...GUIDE_INDEX_META },
  ...GUIDES.map(guide => ({ dir: guidePath(guide).slice(1), ...guidePageMeta(guide) })),
  ...HUBS.map(hub => ({ dir: hubPath(hub).slice(1), ...hubPageMeta(hub) })),
  ...TOOLS.filter(tool => tool.implemented).map(tool => ({ dir: tool.route.slice(1), ...toolPageMeta(tool) })),
]

export const SHARE_IMAGE = {
  url: `${SITE_URL}brand/social-card.png`,
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'PDF Tools. Free PDF tools. On your device. Free forever and open source.',
} as const

export function pageMetaTags(meta: PageMeta) {
  return [
    { attribute: 'name', key: 'description', content: meta.description },
    { attribute: 'property', key: 'og:title', content: meta.title },
    { attribute: 'property', key: 'og:description', content: meta.description },
    { attribute: 'property', key: 'og:url', content: meta.canonical },
    { attribute: 'property', key: 'og:site_name', content: SITE_NAME },
    { attribute: 'property', key: 'og:type', content: meta.ogType },
    { attribute: 'property', key: 'og:image', content: SHARE_IMAGE.url },
    { attribute: 'property', key: 'og:image:secure_url', content: SHARE_IMAGE.url },
    { attribute: 'property', key: 'og:image:type', content: SHARE_IMAGE.type },
    { attribute: 'property', key: 'og:image:width', content: String(SHARE_IMAGE.width) },
    { attribute: 'property', key: 'og:image:height', content: String(SHARE_IMAGE.height) },
    { attribute: 'property', key: 'og:image:alt', content: SHARE_IMAGE.alt },
    { attribute: 'name', key: 'twitter:card', content: 'summary_large_image' },
    { attribute: 'name', key: 'twitter:title', content: meta.title },
    { attribute: 'name', key: 'twitter:description', content: meta.description },
    { attribute: 'name', key: 'twitter:image', content: SHARE_IMAGE.url },
    { attribute: 'name', key: 'twitter:image:alt', content: SHARE_IMAGE.alt },
  ] as const
}

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

/** Safe static metadata; values are public copy, never file names, PDF text or query state. */
export function withPageMetadata(html: string, meta: PageMeta): string {
  const clean = html
    .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/\s*<meta\b[^>]*(?:name|property)=["'](?:description|og:[\w:]+|twitter:[\w:]+)["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*id=["']public-structured-data["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\s*<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
  const tags = pageMetaTags(meta).map(tag => `  <meta ${tag.attribute}="${tag.key}" content="${escapeHtml(tag.content)}" />`).join('\n')
  return clean.replace('</head>', `${tags}\n${structuredDataScript(meta.canonical)}\n  <link rel="canonical" href="${escapeHtml(meta.canonical)}" />\n</head>`)
}

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
    const trail = [
      { name: 'All PDF tools', item: SITE_URL },
      hub ? { name: hub.title, item: hubPageMeta(hub).canonical } : { name: 'Guides', item: GUIDE_INDEX_META.canonical },
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
