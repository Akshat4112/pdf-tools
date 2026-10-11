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

import { TOOLS, getTool, type ToolId, type ToolDefinition } from '../registry'

/** Production origin + base path (PT-PD-004 §5). */
export const SITE_ORIGIN = 'https://akshat4112.github.io'
export const SITE_BASE = '/pdf-tools/'
export const SITE_URL = `${SITE_ORIGIN}${SITE_BASE}`

/** Static catalog-page copy (index). */
export const SITE_TITLE = 'PDF Tools — free local PDF tools in your browser'
export const SITE_DESCRIPTION =
  'Merge, split, convert and inspect PDFs free in your browser. No accounts, no uploads — your files are processed entirely on your own device.'
export const SITE_NAME = 'PDF Tools'

export interface PageMeta {
  /** <title> content */
  title: string
  /** meta description (<= 160 chars) */
  description: string
  /** absolute canonical URL including /pdf-tools/ base */
  canonical: string
  /** Open Graph type; 'website' for catalog, 'article' feels wrong for tools */
  ogType: 'website'
}

/** Catalog page metadata. */
export const CATALOG_META: PageMeta = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  canonical: SITE_URL,
  ogType: 'website',
}

/**
 * Per-tool static metadata. Titles follow the pattern
 * "<Tool title> — PDF Tools"; descriptions reuse the registry copy plus the
 * local-processing promise. All content is static and derived from the
 * registry (single source of truth) — no user data can appear in meta tags.
 */
export function toolPageMeta(tool: ToolDefinition): PageMeta {
  return {
    title: `${tool.title} — PDF Tools`,
    description: `${tool.description} Runs entirely in your browser — no uploads, no accounts.`,
    canonical: `${SITE_URL}${tool.route.replace(/^\//, '')}/`,
    ogType: 'website',
  }
}

export function toolMetaById(id: ToolId): PageMeta {
  return toolPageMeta(getTool(id))
}

/** 404 page metadata (also used by 404.html). */
export const NOT_FOUND_META: PageMeta = {
  title: 'Page not found — PDF Tools',
  description: 'This page does not exist. Browse the PDF Tools catalog instead.',
  canonical: `${SITE_URL}404.html`,
  ogType: 'website',
}

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
  upsertMeta('meta[name="description"]', { name: 'description', content: meta.description })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: meta.title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: meta.description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: meta.canonical })
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: meta.ogType })
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: meta.title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: meta.description })
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
  const urls = [CATALOG_META.canonical, ...TOOLS.map((t) => toolPageMeta(t).canonical)]
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
