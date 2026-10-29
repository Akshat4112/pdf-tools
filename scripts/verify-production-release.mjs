#!/usr/bin/env node
/**
 * PT-BQA-002 — Read-only public production smoke.
 * Usage: node scripts/verify-production-release.mjs
 * Optional: PDF_TOOLS_PRODUCTION_URL=https://example.org/pdf-tools/
 * This script never uploads or processes user documents.
 * Requires Node.js and Python 3 (stdlib robots parser, as in PT-SEO-008).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export async function verifyProductionRelease({ site = process.env.PDF_TOOLS_PRODUCTION_URL ?? 'https://akshat4112.github.io/pdf-tools/', fetchImpl = fetch } = {}) {
  const root = new URL(site)
  if (root.protocol !== 'https:') throw Error('Production URL must use HTTPS')
  if (!root.pathname.endsWith('/')) root.pathname += '/'
  const errors = []
  const evidence = []
  let originRobots
  async function request(path) {
    const url = new URL(path, root)
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw Error('Out-of-scope URL: ' + url)
    const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'pdf-tools-release-smoke/1.0' } })
    const body = await response.text()
    evidence.push({ path, status: response.status, finalUrl: response.url })
    if (!response.ok) errors.push(path + ' returned HTTP ' + response.status)
    if (!response.url.startsWith(root.href)) errors.push(path + ' redirected outside release root')
    return body
  }
  function check(condition, message) { if (!condition) errors.push(message) }
  try {
    // The controlling robots file lives at the origin root, outside this project's
    // path. This is the only out-of-project GET; do not modify the shared website.
    const robotsUrl = new URL('/robots.txt', root)
    const robots = await fetchImpl(robotsUrl, { redirect: 'error', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'pdf-tools-release-smoke/1.0' } })
    const robotsText = await robots.text()
    originRobots = { url: robotsUrl.href, httpStatus: robots.status, note: 'Origin-root robots governs crawling; project-folder robots and project sitemap advertisement are not required.' }
    if (robots.status !== 200 && robots.status !== 404) errors.push('Origin robots HTTP ' + robots.status + ': requires manual review')
    const [home, sitemap] = await Promise.all([request(''), request('sitemap.xml')])
    check(home.includes('PDF Tools'), 'Homepage missing product brand')
    check(home.includes('rel="canonical"') && home.includes(root.href), 'Homepage missing canonical')
    check(!home.includes('content="noindex,nofollow"'), 'Homepage incorrectly noindexed')
    check(sitemap.includes('<urlset'), 'Sitemap not readable XML sitemap')
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x => x[1].replaceAll('&amp;', '&'))
    check(locs.length >= 14, 'Sitemap has fewer than 14 indexed public URLs')
    check(new Set(locs).size === locs.length, 'Sitemap contains duplicate URLs')
    // RobotFileParser handles simple prefix rules, not Google's wildcard/end-
    // anchor or longest-match semantics. Reject those policies for manual review
    // rather than allowing a literal/first-match interpretation to report PASS.
    if (robots.status === 200) {
      // Google's grouping differs from RobotFileParser's first/sub-string match.
      // Only unique, exact wildcard/Googlebot groups are checked automatically.
      const agents = robotsText.split(/[\r\n]+/).map(line => line.split('#', 1)[0].match(/^\s*user-agent\s*:\s*(\S+)/i)?.[1].toLowerCase()).filter(Boolean)
      const complexAgents = new Set(agents).size !== agents.length || agents.some(agent => agent !== '*' && agent !== 'googlebot')
      const rules = robotsText.split(/[\r\n]+/).map(line => line.split('#', 1)[0].match(/^\s*(allow|disallow)\s*:\s*(\S+)/i)).filter(Boolean)
      const allowPaths = rules.filter(rule => rule[1].toLowerCase() === 'allow').map(rule => rule[2])
      const disallowPaths = rules.filter(rule => rule[1].toLowerCase() === 'disallow').map(rule => rule[2])
      const complexPolicy = rules.some(rule => /[*$]/.test(rule[2])) || allowPaths.some(allow => disallowPaths.some(deny => allow.startsWith(deny) || deny.startsWith(allow)))
      if (complexAgents) {
        errors.push('Origin robots uses repeated or unsupported user-agent groups: requires manual review')
      } else if (complexPolicy) {
        errors.push('Origin robots uses wildcard/end-anchor or overlapping Allow/Disallow rules: requires manual review')
      } else {
        // For simple policies, reuse the same stdlib parser as PT-SEO-008.
        const blocked = JSON.parse(execFileSync('python3', ['-c', 'import json, sys; from urllib.robotparser import RobotFileParser; data=json.load(sys.stdin); parser=RobotFileParser(); parser.parse(data["text"].splitlines()); print(json.dumps([url for url in data["urls"] if not parser.can_fetch("Googlebot", url)]))'], { input: JSON.stringify({ text: robotsText, urls: locs }), encoding: 'utf8', timeout: 5000 }))
        for (const url of blocked) errors.push('Shared-origin robots disallows Googlebot: ' + url)
      }
    }
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
  } catch (error) {
    errors.push(String(error))
  }
  return { runAt: new Date().toISOString(), root: root.href, originRobots, checked: evidence, issues: errors }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyProductionRelease()
  console.log(JSON.stringify(report, null, 2))
  if (report.issues.length) process.exitCode = 1
}
