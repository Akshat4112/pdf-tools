/**
 * Static site metadata + SEO helpers — PT-UX-004.
 *
 * Rules from the spec chain:
 * - PT-PD-004 §5: production origin is https://akshat4112.github.io and the
 *   site lives under /pdf-tools/ — canonical URLs are absolute and include
 *   the base path.
 * - PT-UX-004 acceptance: accurate titles/descriptions per route, canonical
 *   link per page, sitemap + robots present, no private document data ever
 *   in metadata (all copy below is static — no user input flows into meta).
 * - PT-PD-003: nothing here writes to localStorage or any storage.
 */


export * from './pageMetadata'
import { SITE_URL, CATALOG_META, PUBLIC_PAGES, pageMetaTags, type PageMeta } from './pageMetadata'
import { GERMAN_CATALOG_META } from './germanCatalogMeta'
import { GERMAN_MERGE_META } from './germanMergeMeta'
import { GERMAN_SPLIT_META } from './germanSplitMeta'
import { GERMAN_ROTATE_META } from './germanRotateMeta'
import { GERMAN_DELETE_META } from './germanDeleteMeta'
import { GERMAN_EXTRACT_META } from './germanExtractMeta'
import { approvedLanguageAlternates } from './localizedRoutes'

// ---------------------------------------------------------------------------
// DOM helpers — applied by the router on each route change (client side).
// ---------------------------------------------------------------------------

function upsertMeta(selector: string, attrs: Record<string, string>): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Apply a page's metadata to the live document. Static-site entry pages ship
 * the same tags server-side (prerendered); this keeps an SPA-navigated
 * document in sync (acceptance: "accurate titles" on every route).
 */
let schemaGeneration = 0
export function applyMeta(meta: PageMeta): void {
  document.title = meta.title
  for (const tag of pageMetaTags(meta)) {
    upsertMeta(`meta[${tag.attribute}="${tag.key}"]`, { [tag.attribute]: tag.key, content: tag.content })
  }
  const previousCanonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
  upsertLink('canonical', meta.canonical)
  // Remove stale language links; only explicitly approved pairs advertise them.
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(link => link.remove())
  for (const { hreflang, href } of approvedLanguageAlternates(meta.canonical)) {
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = hreflang
      link.href = href
      document.head.appendChild(link)
  }
  const desired = meta.canonical
  const german = desired === GERMAN_CATALOG_META.canonical || desired === GERMAN_MERGE_META.canonical || desired === GERMAN_SPLIT_META.canonical || desired === GERMAN_ROTATE_META.canonical || desired === GERMAN_DELETE_META.canonical || desired === GERMAN_EXTRACT_META.canonical
  document.documentElement.lang = german ? 'de' : 'en'
  document.querySelector('.fl-footer-navigation')?.setAttribute('aria-label', german ? 'Links zu PDF Tools' : 'PDF Tools links')
  // The footer is outside React and survives SPA transitions. Route its
  // translated destinations with the page locale; other links stay labelled EN.
  document.querySelectorAll<HTMLAnchorElement>('.fl-site-footer a[href]').forEach(link => {
    const path = link.getAttribute('href')
    if (path === '/pdf-tools/' || path === '/pdf-tools/de/') {
      link.setAttribute('href', german ? '/pdf-tools/de/' : '/pdf-tools/')
      link.hreflang = german ? 'de' : 'en'
    } else if (path === '/pdf-tools/merge/' || path === '/pdf-tools/de/merge/') {
      link.setAttribute('href', german ? '/pdf-tools/de/merge/' : '/pdf-tools/merge/')
      link.hreflang = german ? 'de' : 'en'
    } else if (path === '/pdf-tools/extract-pages/' || path === '/pdf-tools/de/extract-pages/') {
      link.setAttribute('href', german ? '/pdf-tools/de/extract-pages/' : '/pdf-tools/extract-pages/')
      link.hreflang = german ? 'de' : 'en'
    } else if (path === '/pdf-tools/delete-pages/' || path === '/pdf-tools/de/delete-pages/') {
      link.setAttribute('href', german ? '/pdf-tools/de/delete-pages/' : '/pdf-tools/delete-pages/')
      link.hreflang = german ? 'de' : 'en'
    } else if (path === '/pdf-tools/rotate/' || path === '/pdf-tools/de/rotate/') {
      link.setAttribute('href', german ? '/pdf-tools/de/rotate/' : '/pdf-tools/rotate/')
      link.hreflang = german ? 'de' : 'en'
    } else if (path === '/pdf-tools/split/' || path === '/pdf-tools/de/split/') {
      link.setAttribute('href', german ? '/pdf-tools/de/split/' : '/pdf-tools/split/')
      link.hreflang = german ? 'de' : 'en'
    }
  })
  const generation = ++schemaGeneration
  // German pages deliberately omit untranslated JSON-LD.
  if (german) {
    document.getElementById('public-structured-data')?.remove()
    return
  }
  // Prerendered HTML already has the correct public JSON-LD. Do not request
  // another JavaScript chunk on cold homepage/tool/guide loads.
  const existing = document.getElementById('public-structured-data')?.textContent ?? ''
  if (previousCanonical === desired &&
      (existing.includes(desired) || (desired.endsWith('/404.html') && !existing))) return
  void import('./structuredData').then(({ pageStructuredData, serializeStructuredData, STRUCTURED_DATA_ID }) => {
    if (generation !== schemaGeneration || document.querySelector('link[rel="canonical"]')?.getAttribute('href') !== desired) return
    const data = pageStructuredData(desired)
    let script = document.getElementById(STRUCTURED_DATA_ID) as HTMLScriptElement | null
    if (!data) { script?.remove(); return }
    if (!script) {
      script = document.createElement('script'); script.id = STRUCTURED_DATA_ID
      script.type = 'application/ld+json'; document.head.appendChild(script)
    }
    script.textContent = serializeStructuredData(data)
  })
}

// ---------------------------------------------------------------------------
// sitemap.xml + robots.txt generation (pure string builders — tested).
// ---------------------------------------------------------------------------

/** W3C date for <lastmod>; deterministic so builds are reproducible. */
export function sitemapLastmod(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/**
 * sitemap.xml body. One <url> per page: the catalog plus every tool entry.
 * Only canonical, indexable pages — no query/user URLs can ever appear.
 */
export function buildSitemapXml(lastmod = sitemapLastmod()): string {
  const urls = [...PUBLIC_PAGES.map(page => page.canonical), GERMAN_CATALOG_META.canonical, GERMAN_MERGE_META.canonical, GERMAN_SPLIT_META.canonical, GERMAN_ROTATE_META.canonical, GERMAN_DELETE_META.canonical, GERMAN_EXTRACT_META.canonical]
  const entries = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u === CATALOG_META.canonical ? '1.0' : '0.8'}</priority>\n  </url>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}

/** robots.txt body. Sitemap URL is absolute per the robots spec. */
export function buildRobotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`
}
