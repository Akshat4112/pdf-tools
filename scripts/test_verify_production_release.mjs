import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyProductionRelease } from './verify-production-release.mjs'

const root = 'https://release.example/pdf-tools/'
const urls = [root, ...Array.from({ length: 13 }, (_, i) => `${root}tool-${i}/`)]

function fixture({ robotsStatus = 200, robots = 'User-agent: *\nDisallow:\nSitemap: https://release.example/sitemap.xml', additionalUrl, redirect = false } = {}) {
  const requested = []
  const fetchImpl = async (url, options) => {
    const address = String(url)
    requested.push(address)
    assert.equal(options.redirect, 'error', 'Never follow a redirect outside the allowed property')
    if (address === 'https://release.example/robots.txt') {
      if (redirect) throw new TypeError('Unexpected redirect')
      return { status: robotsStatus, text: async () => robots }
    }
    assert.ok(address.startsWith(root), 'Only origin robots may leave the project path')
    assert.notEqual(address, root + 'robots.txt', 'Project robots is not the controlling file')
    let body = `<head><link rel="canonical" href="${address}"></head><body>PDF Tools</body>`
    if (address === root + 'sitemap.xml') body = '<urlset>' + [...urls, ...(additionalUrl ? [additionalUrl] : [])].map(u => `<url><loc>${u}</loc></url>`).join('') + '</urlset>'
    if (address === root + '404.html') body = '<meta name="robots" content="noindex,nofollow">Page not found'
    return { ok: true, status: 200, url: address, text: async () => body }
  }
  return { requested, fetchImpl }
}

test('shared-origin allow policy passes without a project sitemap advertisement or project robots', async () => {
  const { fetchImpl, requested } = fixture()
  const report = await verifyProductionRelease({ site: root, fetchImpl })
  assert.deepEqual(report.issues, [])
  assert.equal(report.originRobots.httpStatus, 200)
  assert.ok(requested.includes('https://release.example/robots.txt'))
})

test('missing origin robots is recorded as absent and permits normal page checks', async () => {
  const report = await verifyProductionRelease({ site: root, ...fixture({ robotsStatus: 404, robots: '<html>Not found</html>' }) })
  assert.deepEqual(report.issues, [])
  assert.equal(report.originRobots.httpStatus, 404)
})

test('disallowed project pages fail release readiness', async () => {
  const report = await verifyProductionRelease({ site: root, ...fixture({ robots: 'User-agent: *\nDisallow: /pdf-tools/' }) })
  assert.ok(report.issues.includes('Shared-origin robots disallows Googlebot: ' + root))
})

test('Googlebot-specific rules override an unrelated wildcard group', async () => {
  const report = await verifyProductionRelease({ site: root, ...fixture({ robots: 'User-agent: Googlebot\nDisallow: /pdf-tools/tool-0/\n\nUser-agent: *\nDisallow:' }) })
  assert.deepEqual(report.issues, ['Shared-origin robots disallows Googlebot: ' + root + 'tool-0/'])
})

test('unrelated sibling rules do not block PDF Tools', async () => {
  const report = await verifyProductionRelease({ site: root, ...fixture({ robots: 'User-agent: *\nDisallow: /another-project/' }) })
  assert.deepEqual(report.issues, [])
})

test('Google wildcard and end-anchor path policies never produce a false PASS', async () => {
  for (const rule of ['Disallow: /pdf-tools/*', 'Disallow: /pdf-tools/$', 'Allow: /pdf-tools/*']) {
    const report = await verifyProductionRelease({ site: root, ...fixture({ robots: 'User-agent: *\n' + rule }) })
    assert.ok(report.issues.some(issue => issue.includes('requires manual review')), rule)
  }
  const crOnly = await verifyProductionRelease({ site: root, ...fixture({ robots: 'User-agent: *\rDisallow: /pdf-tools/*\r' }) })
  assert.ok(crOnly.issues.some(issue => issue.includes('requires manual review')))
})

test('overlapping Allow/Disallow rules require review regardless of first-match order', async () => {
  for (const rules of ['Allow: /pdf-tools/\nDisallow: /pdf-tools/tool-0/', 'Disallow: /pdf-tools/tool-0/\nAllow: /pdf-tools/', 'Disallow: /pdf-tools/\nAllow: /pdf-tools/tool-0/']) {
    const report = await verifyProductionRelease({ site: root, ...fixture({ robots: 'User-agent: *\n' + rules }) })
    assert.ok(report.issues.some(issue => issue.includes('overlapping Allow/Disallow rules: requires manual review')))
  }
})

test('unavailable origin robots requires review rather than assuming crawl access', async () => {
  for (const status of [401, 403, 500]) {
    const report = await verifyProductionRelease({ site: root, ...fixture({ robotsStatus: status }) })
    assert.ok(report.issues.includes('Origin robots HTTP ' + status + ': requires manual review'))
  }
})

test('duplicate Googlebot groups require review instead of ignoring later restrictions', async () => {
  const robots = 'User-agent: Googlebot\nDisallow: /another-project/\n\nUser-agent: Googlebot\nDisallow: /pdf-tools/'
  const report = await verifyProductionRelease({ site: root, ...fixture({ robots }) })
  assert.ok(report.issues.includes('Origin robots uses repeated or unsupported user-agent groups: requires manual review'))
})

test('nonexact user-agent groups require review rather than substring matching', async () => {
  const robots = 'User-agent: Google\nDisallow: /another-project/\n\nUser-agent: Googlebot\nDisallow: /pdf-tools/'
  const report = await verifyProductionRelease({ site: root, ...fixture({ robots }) })
  assert.ok(report.issues.includes('Origin robots uses repeated or unsupported user-agent groups: requires manual review'))
})

test('origin robots redirects are rejected', async () => {
  const report = await verifyProductionRelease({ site: root, ...fixture({ redirect: true }) })
  assert.ok(report.issues.some(issue => issue.includes('Unexpected redirect')))
  assert.equal(report.checked.length, 0)
})

test('malicious sitemap destinations are reported without being fetched', async () => {
  const { fetchImpl, requested } = fixture({ additionalUrl: 'https://outside.example/private/' })
  const report = await verifyProductionRelease({ site: root, fetchImpl })
  assert.ok(report.issues.includes('Sitemap URL outside production root: https://outside.example/private/'))
  assert.ok(!requested.includes('https://outside.example/private/'))
})
