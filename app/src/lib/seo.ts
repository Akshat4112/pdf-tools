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
export function applyMeta(meta: PageMeta): void {
  document.title = meta.title
  for (const tag of pageMetaTags(meta)) {
    upsertMeta(`meta[${tag.attribute}="${tag.key}"]`, { [tag.attribute]: tag.key, content: tag.content })
  }
  upsertLink('canonical', meta.canonical)
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
  const urls = PUBLIC_PAGES.map(page => page.canonical)
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
