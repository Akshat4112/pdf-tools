#!/usr/bin/env node
/**
 * PT-SEO-010 locale indexing guard. Run after app build:
 *   node scripts/verify-locale-indexing.mjs
 * Current English-only output passes; once German URLs are exposed, incomplete
 * translation/reciprocal indexing fails rather than advertising broken routes.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
const dist = resolve(process.argv[2] ?? 'app/dist')
const base = 'https://akshat4112.github.io/pdf-tools/'
const errors = []
function read(path) {
  const full = join(dist, path)
  if (!existsSync(full)) { errors.push('Missing: ' + path); return '' }
  return readFileSync(full, 'utf8')
}
function check(ok, message) { if (!ok) errors.push(message) }
const sitemap = read('sitemap.xml')
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(x => x[1].replaceAll('&amp;', '&'))
check(urls.length > 0, 'No sitemap URLs')
check(new Set(urls).size === urls.length, 'Duplicate sitemap URLs')
for (const url of urls) {
  check(url.startsWith(base), 'Foreign URL in sitemap: ' + url)
  if (!url.startsWith(base)) continue
  const relative = url.slice(base.length)
  const html = read(relative ? relative + 'index.html' : 'index.html')
  if (!html) continue
  check(html.includes('rel="canonical" href="' + url + '"'), 'Canonical mismatch: ' + url)
  const isGerman = relative === 'de/' || relative.startsWith('de/')
  const expectedLang = isGerman ? 'de' : 'en'
  const documentLang = html.match(/<html\b[^>]*\blang=["']([^"']+)/i)?.[1]
  if (documentLang) check(documentLang === expectedLang, 'Wrong HTML lang: ' + url)
  if (isGerman) {
    check(/hreflang=["']de["']/.test(html) && /hreflang=["']en["']/.test(html), 'Missing reciprocal language alternatives: ' + url)
    check(/\b(?:lang=["']de["'])/.test(html), 'German route not declared German: ' + url)
  }
  const pairs = [...html.matchAll(/<link\b[^>]*rel=["']alternate["'][^>]*>/gi)]
  for (const [tag] of pairs) {
    const locale = tag.match(/hreflang=["']([^"']+)/i)?.[1]
    const href = tag.match(/href=["']([^"']+)/i)?.[1]
    if (!locale || !['en','de','x-default'].includes(locale)) continue
    check(Boolean(href && urls.includes(href)), 'Unshipped hreflang destination: ' + (href ?? 'missing') + ' from ' + url)
    if (!href || !urls.includes(href)) continue
    const alt = href.slice(base.length)
    const other = read(alt ? alt + 'index.html' : 'index.html')
    const reciprocal = isGerman ? 'de' : 'en'
    check(new RegExp('hreflang=["\\x27]' + reciprocal + '["\\x27]').test(other) && other.includes(url), 'Missing reciprocal link from ' + href + ' to ' + url)
  }
}
check(!sitemap.includes('<loc>' + base + 'de/</loc>') || existsSync(join(dist, 'de/index.html')), 'German homepage advertised before build')
console.log(JSON.stringify({ pageCount: urls.length, germanPageCount: urls.filter(x => x.startsWith(base + 'de/')).length, errors }, null, 2))
if (errors.length) process.exitCode = 1
