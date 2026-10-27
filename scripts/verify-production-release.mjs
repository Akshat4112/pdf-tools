#!/usr/bin/env node
/**
 * PT-BQA-002 — Read-only public production smoke.
 * Usage: node scripts/verify-production-release.mjs
 * Optional: PDF_TOOLS_PRODUCTION_URL=https://example.org/pdf-tools/
 * This script never uploads or processes user documents.
 */
const root = new URL(process.env.PDF_TOOLS_PRODUCTION_URL ?? 'https://akshat4112.github.io/pdf-tools/')
if (root.protocol !== 'https:') throw Error('Production URL must use HTTPS')
if (!root.pathname.endsWith('/')) root.pathname += '/'
const errors = []
const evidence = []
async function request(path) {
  const url = new URL(path, root)
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw Error('Out-of-scope URL: ' + url)
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'pdf-tools-release-smoke/1.0' } })
  const body = await response.text()
  evidence.push({ path, status: response.status, finalUrl: response.url })
  if (!response.ok) errors.push(path + ' returned HTTP ' + response.status)
  if (!response.url.startsWith(root.href)) errors.push(path + ' redirected outside release root')
  return body
}
function check(condition, message) { if (!condition) errors.push(message) }
try {
  const [home, sitemap, robots] = await Promise.all([request(''), request('sitemap.xml'), request('robots.txt')])
  check(home.includes('PDF Tools'), 'Homepage missing product brand')
  check(home.includes('rel="canonical"') && home.includes(root.href), 'Homepage missing canonical')
  check(!home.includes('content="noindex,nofollow"'), 'Homepage incorrectly noindexed')
  check(sitemap.includes('<urlset'), 'Sitemap not readable XML sitemap')
  check(robots.toLowerCase().includes('sitemap'), 'robots.txt does not advertise sitemap')
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1].replaceAll('&amp;', '&'))
  check(locs.length >= 14, 'Sitemap has fewer than 14 indexed public URLs')
  check(new Set(locs).size === locs.length, 'Sitemap contains duplicate URLs')
  for (const link of locs) {
    const url = new URL(link)
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) { errors.push('Sitemap URL outside production root: ' + link); continue }
    const path = url.pathname.slice(root.pathname.length) + url.search
    const html = await request(path)
    check(html.includes('rel="canonical"') && html.includes(link), 'Canonical mismatch at ' + path)
    check(!html.includes('content="noindex,nofollow"'), 'Indexed page noindexed: ' + path)
  }
  for (const path of ['help/', 'privacy/', 'trust/', 'limitations/']) {
    const html = await request(path)
    check(html.includes('PDF Tools'), 'Public trust/help page does not include branding: ' + path)
  }
  const fallback = await request('404.html')
  check(fallback.includes('content="noindex,nofollow"'), '404 fallback lacks noindex')
  check(fallback.includes('Page not found'), '404 fallback lacks not-found explanation')
  console.log(JSON.stringify({ runAt: new Date().toISOString(), root: root.href, checked: evidence, issues: errors }, null, 2))
  if (errors.length) process.exitCode = 1
} catch (error) {
  console.error(JSON.stringify({ runAt: new Date().toISOString(), root: root.href, checked: evidence, issues: [...errors, String(error)] }, null, 2))
  process.exitCode = 1
}
