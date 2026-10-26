/** PT-SEO-007: empty-page lab measurements only; never selects a document. */
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../app/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const [distArg, output, label = 'candidate'] = process.argv.slice(2)
if (!distArg || !output) throw Error('Usage: node scripts/measure_startup.mjs DIST OUTPUT [LABEL]')
const dist = resolve(distArg), manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json')))
const seen = new Set(), assets = new Set()
function walk(key) { if (seen.has(key)) return; seen.add(key); const entry = manifest[key]; assets.add(entry.file); for (const css of entry.css ?? []) assets.add(css); for (const key of entry.imports ?? []) walk(key) }
walk('index.html')
const initialAssets = [...assets].map(file => { const bytes = readFileSync(resolve(dist, file)); return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length } })
const sum = (suffix, property) => initialAssets.filter(a => a.file.endsWith(suffix)).reduce((sum, a) => sum + a[property], 0)
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json' }
const server = createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost'), path = decodeURIComponent(url.pathname)
    if (!path.startsWith('/pdf-tools/')) throw Error('outside base')
    let file = resolve(dist, path.slice('/pdf-tools/'.length) || '.')
    if (file !== dist && !file.startsWith(dist + sep)) throw Error('outside dist')
    if (statSync(file).isDirectory()) file = resolve(file, 'index.html')
    const type = mime[extname(file)] ?? 'application/octet-stream', bytes = readFileSync(file)
    const compress = /html|javascript|css|svg|json/.test(type) && request.headers['accept-encoding']?.includes('gzip')
    const body = compress ? gzipSync(bytes) : bytes
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control':'no-store', ...(compress ? { 'Content-Encoding':'gzip' } : {}) }); response.end(body)
  } catch { response.writeHead(404); response.end('Not found') }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ headless:true, args:['--no-sandbox'], ...(process.env.PDF_TOOLS_CHROMIUM_PATH ? { executablePath:process.env.PDF_TOOLS_CHROMIUM_PATH } : {}) })
const samples = []
try {
  for (const route of ['', 'tools/convert/', 'merge/']) for (let sample = 1; sample <= 3; sample++) {
    const context = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:2, isMobile:true })
    const page = await context.newPage(), session = await context.newCDPSession(page)
    await session.send('Network.enable'); await session.send('Network.setCacheDisabled', { cacheDisabled:true })
    await session.send('Network.emulateNetworkConditions', { offline:false, latency:150, downloadThroughput:200000, uploadThroughput:93750, connectionType:'cellular4g' })
    await session.send('Emulation.setCPUThrottlingRate', { rate:4 })
    await page.addInitScript(() => {
      window.__startup = { lcp:0, cls:0, blockingMs:0 }
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__startup.lcp = entry.startTime }).observe({ type:'largest-contentful-paint', buffered:true })
      new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__startup.cls += entry.value }).observe({ type:'layout-shift', buffered:true })
      new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__startup.blockingMs += Math.max(0, entry.duration - 50) }).observe({ type:'longtask', buffered:true })
    })
    await page.goto(`${origin}/pdf-tools/${route}`, { waitUntil:'domcontentloaded' })
    await page.locator(route === 'merge/' ? 'input[type=file]' : route ? '.category-hub h1' : '.fl-hero h1').waitFor({ state:'attached' })
    const readyMs = await page.evaluate(() => performance.now())
    await page.waitForLoadState('networkidle')
    const values = await page.evaluate(() => ({ ...window.__startup, fcpMs:performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0,
      resources:performance.getEntriesByType('resource').map(r => ({ path:new URL(r.name).pathname, decodedBytes:r.decodedBodySize, transferBytes:r.transferSize })) }))
    const record = { route:`/pdf-tools/${route}`, sample, readyMs, ...values }; samples.push(record)
    console.log(`${label} ${record.route} #${sample}: ready=${readyMs.toFixed(0)}ms LCP=${values.lcp.toFixed(0)}ms CLS=${values.cls.toFixed(3)}`)
    await context.close()
  }
  const report = { label, browser:browser.version(), settings:{ viewport:'390x844', deviceScaleFactor:2, cpuSlowdown:4, latencyMs:150, downloadBytesPerSecond:200000, uploadBytesPerSecond:93750, cache:'disabled; fresh context per sample; gzip responses', repeats:3 },
    initialAssets, initialJsBytes:sum('.js','bytes'), initialJsGzipBytes:sum('.js','gzipBytes'), initialCssBytes:sum('.css','bytes'), initialCssGzipBytes:sum('.css','gzipBytes'), samples }
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n')
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
