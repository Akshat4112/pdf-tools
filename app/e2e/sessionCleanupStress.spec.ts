import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { unzipSync } from 'fflate'
import { readImageMetadata } from '../src/engines/imageMetadata'

// PT-IMP-009: synthetic browser lifecycle stress, complementary to FileSession unit stress.
// Keep this bounded in CI; extended 100-cycle/memory profiling is a separate acceptance gate.
const fixture = () => readFile('../fixtures/pdf/F-001-plain-text-3p.pdf')
// Run PT_IMP009_EXTENDED=1 npx playwright test sessionCleanupStress.spec.ts --project=chromium
// for the opt-in 100-cycle profile; normal CI stays bounded at 12 cycles.
const extended = process.env.PT_IMP009_EXTENDED === '1'
const cycleCount = extended ? 100 : 12

// Independently decode every sampled download instead of accepting nonempty bytes.
async function verifySyntheticDownload(bytes: Uint8Array, route: 'merge' | 'split') {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
    const pages = pdf.getPageCount()
    if (route === 'merge') expect(pages).toBe(6)
    else expect([1, 2]).toContain(pages)
    return
  }
  // Split can package multiple PDFs into a ZIP. Validate every member.
  expect(route).toBe('split')
  expect(bytes[0]).toBe(0x50)
  expect(bytes[1]).toBe(0x4b)
  const entries = Object.entries(unzipSync(bytes)).filter(([name]) => !name.endsWith('/'))
  expect(entries).toHaveLength(2)
  const pageCounts: number[] = []
  for (const [name, contents] of entries) {
    expect(name.toLowerCase()).toMatch(/\.pdf$/)
    const pdf = await PDFDocument.load(contents, { updateMetadata: false })
    pageCounts.push(pdf.getPageCount())
  }
  expect(pageCounts.sort()).toEqual([1, 2])
}

for (const route of ['merge', 'split'] as const) {
  test(`PT-IMP-009 ${route}: repeated processing, download and reset leave no retained URLs or storage`, async ({ page }) => {
    test.setTimeout(extended ? 1_200_000 : 180_000)
    await page.addInitScript(() => {
      const create = URL.createObjectURL.bind(URL)
      const revoke = URL.revokeObjectURL.bind(URL)
      const active = new Map<string, { type: string; size: number; stack: string }>()
      URL.createObjectURL = blob => { const url = create(blob); active.set(url, { type: blob instanceof Blob ? blob.type : 'MediaSource', size: blob instanceof Blob ? blob.size : 0, stack: new Error().stack?.slice(0, 1200) ?? '' }); return url }
      URL.revokeObjectURL = url => { active.delete(url); revoke(url) }
      Object.assign(window, { ptImp009ActiveUrls: () => active.size, ptImp009UrlDetails: () => [...active.entries()].map(([url, detail]) => ({ url, ...detail })) })
    })
    // PT-IMP-009 privacy gate: no document-processing request may upload a body.
    // Static GETs for application assets are allowed; every other network method is recorded.
    // Unhandled browser exceptions during a long session are a lifecycle regression,
    // even when the visible result and download appear successful.
    // Observe real worker instances independently of zip.js's retained script Blob URL.
    // A script URL alone cannot establish whether workers terminate after processing.
    const liveWorkers = new Set<import('@playwright/test').Worker>()
    let workersCreated = 0
    let peakLiveWorkers = 0
    const workerOrigins = new Map<string, number>()
    const workerCycleSamples: Array<{ cycle: number; created: number; live: number }> = []
    page.on('worker', worker => {
      workerOrigins.set(worker.url(), (workerOrigins.get(worker.url()) ?? 0) + 1)
      workersCreated++
      liveWorkers.add(worker)
      peakLiveWorkers = Math.max(peakLiveWorkers, liveWorkers.size)
      worker.on('close', () => liveWorkers.delete(worker))
    })
    // WebSocket traffic is not represented by ordinary HTTP request events.
    // Observe the complete document lifetime, including bootstrap and navigation.
    const unexpectedWebSockets: string[] = []
    page.on('websocket', socket => unexpectedWebSockets.push(socket.url()))
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    // Privacy regression: generated synthetic input filenames must not appear in browser console output.
    const consoleMessages: string[] = []
    page.on('console', message => consoleMessages.push(message.text()))
    // Same-origin GET requests can also expose private filenames in URL paths or query strings.
    const filenameUrlLeaks: string[] = []
    const outboundWrites: Array<{ method: string; url: string }> = []
    page.on('request', request => {
      if (/(?:synthetic|second)-\d+\.pdf/i.test(decodeURIComponent(request.url()))) {
        filenameUrlLeaks.push(request.url())
      }
      if (!['GET', 'HEAD'].includes(request.method())) {
        outboundWrites.push({ method: request.method(), url: request.url() })
      }
    })
    // Install the privacy observer BEFORE initial navigation. A third-party
    // request during bootstrap must not escape detection merely because it
    // happened before the tool's first render.
    const observedHttpRequests: Array<{ method: string; url: string }> = []
    page.on('request', request => {
      const url = new URL(request.url())
      if (['http:', 'https:'].includes(url.protocol)) {
        observedHttpRequests.push({ method: request.method(), url: request.url() })
      }
    })
    await page.goto(`${route}/`)
    const appOrigin = new URL(page.url()).origin
    const bytes = await fixture()
    const baseline = await page.evaluate(() => (window as unknown as { ptImp009ActiveUrls(): number }).ptImp009ActiveUrls())
    const run = page.getByRole('button', { name: route === 'merge' ? 'Merge PDFs' : 'Split PDF', exact: true })
    const heapSamples: Array<{ cycle: number; bytes: number }> = []
    const cdp = extended ? await page.context().newCDPSession(page) : null
    const measureHeap = async () => {
      if (!cdp) return null
      await cdp.send('HeapProfiler.collectGarbage')
      return (await cdp.send('Runtime.getHeapUsage')).usedSize
    }
    // Include a pre-processing baseline; without it, cycle-one allocations are invisible.
    if (extended) {
      const initialHeap = await measureHeap()
      if (initialHeap !== null) heapSamples.push({ cycle: 0, bytes: initialHeap })
    }
    for (let cycle = 0; cycle < cycleCount; cycle++) {
      const file = { name: `synthetic-${cycle}.pdf`, mimeType: 'application/pdf', buffer: bytes }
      await page.locator('input[type=file]').setInputFiles(route === 'merge'
        ? [file, { ...file, name: `second-${cycle}.pdf` }] : file)
      await expect(page.locator('.file-row')).toHaveCount(route === 'merge' ? 2 : 1)
      if (route === 'split') await page.getByRole('textbox', { name: 'Ranges (comma separated)' }).fill('1, 2-3')
      await expect(run).toBeEnabled()
      await run.click()
      const result = page.getByRole('region', { name: 'Results', exact: true })
      await expect(result).toBeVisible()
      const downloadPromise = page.waitForEvent('download')
      await result.getByRole('button', { name: /^Download / }).first().click()
      const download = await downloadPromise
      await verifySyntheticDownload(await readFile((await download.path())!), route)
      await page.getByRole('button', { name: 'Start over', exact: true }).click()
      await expect(result).toHaveCount(0)
      await expect(page.locator('.file-row')).toHaveCount(0)
      // Stored ZIP packaging runs without zip.js workers; all job URLs and workers must be released.
      await expect.poll(async () => page.evaluate(() => (window as unknown as {
        ptImp009UrlDetails(): Array<{ url: string }>
      }).ptImp009UrlDetails().length), { timeout: 10_000 }).toBe(baseline)
      await expect.poll(() => liveWorkers.size, { timeout: 10_000 }).toBe(0)
      workerCycleSamples.push({ cycle: cycle + 1, created: workersCreated, live: liveWorkers.size })
      expect(liveWorkers.size, `Worker instances accumulated after ${route} cycle ${cycle + 1}`).toBeLessThanOrEqual(2)
      expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
      expect(pageErrors, `Uncaught browser exceptions after ${route} cycle ${cycle + 1}`).toEqual([])
      if (extended && (cycle === 0 || (cycle + 1) % 10 === 0)) {
        // Chromium-only experimental JS heap metric. This is diagnostic, not total process RSS.
        const bytesUsed = await measureHeap()
        if (bytesUsed !== null) heapSamples.push({ cycle: cycle + 1, bytes: bytesUsed })
      }
    }
    console.log(`PT-IMP-009 ${route} worker lifecycle: ${JSON.stringify({ workersCreated, peakLiveWorkers, liveAfterCycles: liveWorkers.size, workerOrigins: [...workerOrigins], workerCycleSamples })}`)
    // A transient burst can disappear before the per-cycle sample. Bound peak concurrency too.
    expect(peakLiveWorkers, `Unexpected concurrent workers during ${route} stress`).toBeLessThanOrEqual(2)
    // Exact-head CI diagnostics (2026-11-16) identified PDF.js worker churn:
    // Merge creates three pdf.worker.min.mjs instances per cycle; Split creates four
    // per cycle; allow one initial PDF.js worker. ZIP packaging must not spawn workers.
    // These workers terminate (peak <=2); cumulative creation alone is not a leak.
    // Keep a bounded per-cycle regression guard rather than the unsupported 2/cycle cap.
    const maxWorkersPerCycle = route === 'merge' ? 3 : 4
    const startupAllowance = route === 'split' ? 1 : 0
    expect(workersCreated, `Unexpected ${route} worker churn`).toBeLessThanOrEqual(cycleCount * maxWorkersPerCycle + startupAllowance)
    for (let i = 1; i < workerCycleSamples.length; i++) {
      const createdThisCycle = workerCycleSamples[i].created - workerCycleSamples[i - 1].created
      expect(createdThisCycle, `Unexpected worker churn in ${route} cycle ${i + 1}`).toBeLessThanOrEqual(maxWorkersPerCycle)
    }
    const unexpectedWorkerOrigins = [...workerOrigins.keys()].filter(url =>
      !url.includes('/assets/pdf.worker.min.mjs')
    )
    expect(unexpectedWorkerOrigins, 'Unexpected worker scripts').toEqual([])
    if (extended) {
      expect(heapSamples.length, 'Extended Chromium profiling must expose baseline and repeated JS heap samples').toBeGreaterThan(2)
      expect(heapSamples[0].cycle).toBe(0)
      expect(heapSamples.at(-1)?.cycle).toBe(100)
      expect(heapSamples.every(sample => Number.isFinite(sample.bytes) && sample.bytes > 0)).toBe(true)
      const first = heapSamples[0].bytes
      const last = heapSamples[heapSamples.length - 1].bytes
      const peak = Math.max(...heapSamples.map(sample => sample.bytes))
      const growthLimit = Math.max(32 * 1024 * 1024, first * 2)
      console.log(`PT-IMP-009 ${route} 100-cycle Chromium CDP post-GC heap profile: ${JSON.stringify({ baselineBytes: first, finalBytes: last, deltaBytes: last - first, peakBytes: peak, growthLimitBytes: growthLimit, samples: heapSamples })}`)
      expect(new Set(heapSamples.map(sample => sample.bytes)).size, 'Constant heap readings are not meaningful').toBeGreaterThan(1)
      expect(last - first, 'Post-GC V8 heap growth exceeds allowance').toBeLessThanOrEqual(growthLimit)
      await cdp?.detach()
    }
    expect(consoleMessages.filter(message => /(?:synthetic|second)-\d+\.pdf/.test(message)), 'Input filenames must not leak into browser console logs').toEqual([])
    expect(unexpectedWebSockets, 'PDF processing must not open WebSocket connections').toEqual([])
    expect(pageErrors, 'PDF workflows must not raise uncaught browser exceptions').toEqual([])
    expect(filenameUrlLeaks, 'Input filenames must not appear in any network URL, including same-origin GETs').toEqual([])
    expect(outboundWrites, 'PDF workflows must not upload data via network writes').toEqual([])
    expect(observedHttpRequests.filter(request => new URL(request.url).origin !== appOrigin), 'Initial loading and PDF processing must not send even read-only requests to third-party origins').toEqual([])
    // Exercise browser history after repeated processing: returning to the tool must
    // not resurrect selected files, generated results or private browser storage.
    const toolUrl = page.url()
    const homeUrl = new URL('../', toolUrl).href
    await page.goto(homeUrl)
    await expect(page.locator('.file-row')).toHaveCount(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
    await expect.poll(() => liveWorkers.size, { timeout: 10_000 }).toBe(0)
    await page.goBack()
    await expect(page).toHaveURL(toolUrl)
    await expect(page.locator('.file-row')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
    // Back/forward-cache restoration must not resurrect the previous document's
    // retained zip.js script URL or any generated download URL.
    await expect.poll(async () => page.evaluate(() => (window as unknown as {
      ptImp009UrlDetails(): Array<{ url: string }>
    }).ptImp009UrlDetails().length)).toBe(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
    expect(pageErrors, 'History navigation must not trigger uncaught browser exceptions').toEqual([])
    await page.reload()
    await expect(page.locator('.file-row')).toHaveCount(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
    const origin = new URL(page.url()).origin
    const basePath = new URL(page.url()).pathname.replace(/(?:de\/)?(?:merge|split)\/?$/, '')
    for (const localePath of [`de/${route}/`, `${route}/`]) {
      await page.goto(`${origin}${basePath}${localePath}`)
      await expect(page.locator('input[type=file]')).toHaveCount(1)
      await expect(page.locator('.file-row')).toHaveCount(0)
      await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
      // Locale navigation creates a new document; old result and worker Blob
      // URLs must not appear in the new page's URL registry.
      await expect.poll(() => page.evaluate(() => (window as unknown as {
        ptImp009UrlDetails(): Array<{ url: string }>
      }).ptImp009UrlDetails().length)).toBe(0)
      expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
      expect(pageErrors, `Locale transition to ${localePath} must not raise uncaught errors`).toEqual([])
    }
    // The request observers remain attached through home navigation, history
    // restoration and reload. Check again here: a late navigation-time request
    // must not bypass the earlier processing-only privacy assertions.
    expect(filenameUrlLeaks, 'Navigation must not disclose input filenames in request URLs').toEqual([])
    expect(outboundWrites, 'Navigation must not issue unexpected network writes').toEqual([])
    expect(observedHttpRequests.filter(request => new URL(request.url).origin !== appOrigin),
      'Navigation and history restoration must not contact third-party origins').toEqual([])
    expect(consoleMessages.filter(message => /(?:synthetic|second)-\d+\.pdf/.test(message)),
      'Late navigation or locale logs must not disclose synthetic input filenames').toEqual([])
    expect(unexpectedWebSockets, 'Navigation must not open WebSocket connections').toEqual([])
    expect(pageErrors, 'Reload must not raise uncaught browser exceptions').toEqual([])
  })
}


for (const route of ['merge', 'split'] as const) {
  test(`PT-IMP-009 ${route}: locale navigation discards selected synthetic files before processing`, async ({ page }) => {
  const leakedRequests: string[] = []
  const unexpectedNetwork: string[] = []
  const leakedConsole: string[] = []
  const errors: string[] = []
  page.on('request', request => {
    if (/locale-switch-synthetic\.pdf/i.test(request.url())) leakedRequests.push(request.url())
    // Record all HTTP requests, including those during the initial page load.
    if (/^https?:/.test(request.url())) unexpectedNetwork.push(request.url())
  })
  page.on('console', message => {
    if (/locale-switch-synthetic\.pdf/i.test(message.text())) leakedConsole.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${route}/`)
  const original = page.url()
  const input = page.locator('input[type=file]')
  await input.setInputFiles({
    name: 'locale-switch-synthetic.pdf',
    mimeType: 'application/pdf',
    buffer: await fixture(),
  })
  await expect(page.locator('.file-row')).toHaveCount(1)
  const germanUrl = new URL(`../de/${route}/`, original).href
  await page.goto(germanUrl)
  await expect(page.locator('input[type=file]')).toHaveCount(1)
  await expect(page.locator('.file-row')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  await page.goBack()
  await expect(page).toHaveURL(original)
  await expect(page.locator('.file-row')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  expect(leakedRequests).toEqual([])
  expect(leakedConsole, 'Locale navigation must not log selected filenames').toEqual([])
  const origin = new URL(original).origin
  expect(unexpectedNetwork.filter(url => new URL(url).origin !== origin),
    'Selected-file locale navigation must not contact third-party origins').toEqual([])
  expect(errors).toEqual([])
  })
}


// Cover the remaining PDF-input workflows at the selection/navigation boundary.
// This does not replace each engine's processing/output-validation acceptance.
for (const route of [
  'rotate', 'delete-pages', 'extract-pages', 'organize', 'pdf-to-jpg',
  'pdf-to-png', 'reader', 'page-numbers', 'watermark', 'pdf-to-text', 'doc-info',
] as const) {
  test(`PT-IMP-009 ${route}: locale/history clears selected PDF without network disclosure`, async ({ page }) => {
    const outbound: string[] = []
    const requests: string[] = []
    // A WebSocket can disclose data without appearing as a normal HTTP request.
    // Track the handshake throughout selection, locale navigation and history.
    const webSockets: string[] = []
    page.on('websocket', socket => webSockets.push(socket.url()))
    const consoleLeaks: string[] = []
    const errors: string[] = []
    const selectedName = 'pt-imp009-private-selection.pdf'
    page.on('request', request => {
      if (/^https?:/.test(request.url())) requests.push(request.url())
      if (/pt-imp009-private-selection/i.test(request.url()) ||
        !['GET', 'HEAD'].includes(request.method())) outbound.push(`${request.method()} ${request.url()}`)
    })
    page.on('console', message => {
      if (message.text().includes(selectedName)) consoleLeaks.push(message.text())
    })
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${route}/`)
    const original = page.url()
    const origin = new URL(original).origin
    // Capture requests from initial load, processing, locale navigation and history.
    // Performance entries alone omit previous documents after navigation.
    const input = page.locator('input[type=file]')
    await expect(input).toHaveCount(1)
    await input.setInputFiles({ name: selectedName, mimeType: 'application/pdf', buffer: await fixture() })
    await expect(page.locator('.file-row')).toHaveCount(1)
    // Only explicitly published German tool routes may be tested as tool pages.
    // For the remaining EN tools, navigate to the published German catalog instead:
    // this exercises locale/history privacy without inventing a DE tool route.
    const germanUrl = new URL('../de/', original).href
    await page.goto(germanUrl)
    await expect(page.locator('input[type=file]')).toHaveCount(0)
    await expect(page.locator('.file-row')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
    await page.goBack()
    await expect(page).toHaveURL(original)
    await expect(page.locator('.file-row')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
    expect(requests.filter(url => new URL(url).origin !== origin),
      'Cross-tool locale/history navigation must not contact third-party origins').toEqual([])
    expect(outbound).toEqual([])
    expect(webSockets, 'PDF selection/navigation must not open WebSocket connections').toEqual([])
    expect(consoleLeaks).toEqual([])
    expect(errors).toEqual([])
  })
}


test('PT-IMP-009 Split: larger stored archive yields to browser and verifies every PDF', async ({ page }) => {
  test.setTimeout(180_000)
  const source = await PDFDocument.create()
  const count = 24
  for (let i = 0; i < count; i++) {
    const p = source.addPage([300 + i, 400])
    p.drawText('Synthetic page ' + (i + 1), { x: 20, y: 350 })
  }
  const workers = new Set<import('@playwright/test').Worker>()
  const origins: string[] = []
  page.on('worker', worker => {
    workers.add(worker)
    origins.push(worker.url())
    worker.on('close', () => workers.delete(worker))
  })
  await page.goto('split/')
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic-large-archive.pdf', mimeType: 'application/pdf',
    buffer: Buffer.from(await source.save()),
  })
  await page.getByRole('textbox', { name: 'Ranges (comma separated)' }).fill(
    Array.from({ length: count }, (_, i) => String(i + 1)).join(', '),
  )
  const run = page.getByRole('button', { name: 'Split PDF', exact: true })
  await expect(run).toBeEnabled()
  await page.evaluate(() => {
    const timing = { ticks: 0, maxGap: 0, last: performance.now(), timer: 0 }
    timing.timer = window.setInterval(() => {
      const now = performance.now()
      timing.maxGap = Math.max(timing.maxGap, now - timing.last)
      timing.last = now
      timing.ticks++
    }, 20)
    Object.assign(window, { ptImp009ArchiveTiming: timing })
  })
  await run.click()
  const result = page.getByRole('region', { name: 'Results', exact: true })
  await expect(result).toBeVisible()
  const pending = page.waitForEvent('download')
  await result.getByRole('button', { name: /^Download / }).first().click()
  const download = await pending
  const timing = await page.evaluate(() => {
    const t = (window as unknown as { ptImp009ArchiveTiming: { ticks: number; maxGap: number; last: number; timer: number } }).ptImp009ArchiveTiming
    clearInterval(t.timer)
    return { ticks: t.ticks, maxGap: Math.max(t.maxGap, performance.now() - t.last) }
  })
  expect(timing.ticks).toBeGreaterThan(0)
  // Generous CI watchdog, not a native-device performance certification.
  expect(timing.maxGap).toBeLessThan(2000)
  const entries = Object.entries(unzipSync(await readFile((await download.path())!)))
  expect(entries).toHaveLength(count)
  const widths: number[] = []
  for (const [name, bytes] of entries) {
    expect(name).toMatch(/\.pdf$/i)
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
    expect(pdf.getPageCount()).toBe(1)
    widths.push(pdf.getPage(0).getWidth())
  }
  expect(widths.sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => 300 + i))
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  await expect(result).toHaveCount(0)
  await expect.poll(() => workers.size, { timeout: 10_000 }).toBe(0)
  expect(origins.filter(url => !url.includes('/assets/pdf.worker.min.mjs'))).toEqual([])
  console.log('PT-IMP-009 larger archive heartbeat', timing)
})

test('PT-IMP-009 images-to-pdf: repeated verified downloads and reset release local resources', async ({ page }) => {
  await page.addInitScript(() => {
    const active = new Set<string>()
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); active.add(url); return url }
    URL.revokeObjectURL = url => { active.delete(url); revoke(url) }
    Object.assign(window, { ptImp009ImageUrls: () => active.size })
  })
  const workers = new Set<import('@playwright/test').Worker>()
  page.on('worker', worker => { workers.add(worker); worker.on('close', () => workers.delete(worker)) })
  const requests: Array<{ url: string; method: string }> = []
  const errors: string[] = []
  const logs: string[] = []
  const sockets: string[] = []
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }))
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => logs.push(message.text()))
  page.on('websocket', socket => sockets.push(socket.url()))
  await page.goto('images-to-pdf/')
  const original = page.url()
  const origin = new URL(original).origin
  const bytes = await readFile('e2e/images-engine/corners.jpg')
  const urlCount = () => page.evaluate(() => (window as unknown as { ptImp009ImageUrls(): number }).ptImp009ImageUrls())
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('input[type=file]').setInputFiles({
      name: `pt-imp009-image-private-${cycle}.jpg`, mimeType: 'image/jpeg', buffer: bytes,
    })
    await expect(page.locator('.file-row')).toHaveCount(1)
    const run = page.getByRole('button', { name: 'Create PDF', exact: true })
    await expect(run).toBeEnabled()
    await run.click()
    const result = page.getByRole('region', { name: 'Results', exact: true })
    await expect(result).toBeVisible()
    const pending = page.waitForEvent('download')
    await result.getByRole('button', { name: /^Download / }).first().click()
    const download = await pending
    const pdf = await PDFDocument.load(await readFile((await download.path())!), { updateMetadata: false })
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getPage(0).getWidth()).toBeGreaterThan(0)
    expect(pdf.getPage(0).getHeight()).toBeGreaterThan(0)
    if (cycle < 2) await page.getByRole('button', { name: 'Start over', exact: true }).click()
    else {
      await page.goto(new URL('../de/', original).href)
      await page.goBack()
      await expect(page).toHaveURL(original)
    }
    await expect(page.locator('.file-row')).toHaveCount(0)
    await expect(result).toHaveCount(0)
    await expect.poll(urlCount).toBe(0)
    await expect.poll(() => workers.size).toBe(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  }
  expect(requests.filter(r => !['GET', 'HEAD'].includes(r.method) ||
    (/^https?:/.test(r.url) && new URL(r.url).origin !== origin) ||
    /pt-imp009-image-private/i.test(r.url))).toEqual([])
  expect(logs.filter(log => /pt-imp009-image-private/i.test(log))).toEqual([])
  expect(errors).toEqual([])
  expect(sockets).toEqual([])
})

test('PT-IMP-009 pdf-to-text: repeated UTF-8 exports and abandoned results release resources', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    const active = new Set<string>()
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); active.add(url); return url }
    URL.revokeObjectURL = url => { active.delete(url); revoke(url) }
    Object.assign(window, { ptImp009TextUrls: () => active.size })
  })
  const workers = new Set<import('@playwright/test').Worker>()
  page.on('worker', worker => { workers.add(worker); worker.on('close', () => workers.delete(worker)) })
  const requests: Array<{ url: string; method: string }> = []
  const errors: string[] = [], leaks: string[] = [], sockets: string[] = []
  const marker = 'PT-IMP009-SYNTHETIC-TEXT'
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }))
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.text().includes(marker)) leaks.push(message.text()) })
  page.on('websocket', socket => sockets.push(socket.url()))
  const source = await PDFDocument.create()
  // Keep the full marker inside the PDF page at the default font size.
  source.addPage([600, 400]).drawText(marker, { x: 20, y: 350, size: 12 })
  const buffer = Buffer.from(await source.save())
  await page.goto('pdf-to-text/')
  const original = page.url(), origin = new URL(original).origin
  const report = page.getByRole('region', { name: 'Text extraction report', exact: true })
  const downloadButton = page.getByRole('button', { name: /^Download .*\.txt/ })
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('input[type=file]').setInputFiles({ name: marker + '.pdf', mimeType: 'application/pdf', buffer })
    await expect(page.locator('.file-row')).toHaveCount(1)
    await page.getByRole('button', { name: 'Export text', exact: true }).click()
    await expect(report).toBeVisible()
    await expect(downloadButton).toBeVisible()
    const pending = page.waitForEvent('download')
    await downloadButton.click()
    const result = await pending
    expect(new TextDecoder('utf-8', { fatal: true }).decode(await readFile((await result.path())!))).toContain(marker)
    if (cycle < 2) await page.getByRole('button', { name: 'Start over', exact: true }).click()
    else {
      await page.goto(new URL('../de/', original).href)
      await page.goBack()
      await expect(page).toHaveURL(original)
    }
    await expect(page.locator('.file-row')).toHaveCount(0)
    await expect(report).toHaveCount(0)
    await expect(downloadButton).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => (window as unknown as { ptImp009TextUrls(): number }).ptImp009TextUrls())).toBe(0)
    await expect.poll(() => workers.size).toBe(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  }
  expect(requests.filter(r => !['GET', 'HEAD'].includes(r.method) ||
    (/^https?:/.test(r.url) && new URL(r.url).origin !== origin) ||
    r.url.includes(marker))).toEqual([])
  expect(leaks).toEqual([])
  expect(errors).toEqual([])
  expect(sockets).toEqual([])
})


for (const format of ['png', 'jpg'] as const) {
  test(`PT-IMP-009 pdf-to-${format}: repeated raster exports and history release resources`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.addInitScript(() => {
      const urls = new Set<string>()
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url }
      URL.revokeObjectURL = url => { urls.delete(url); revoke(url) }
      Object.assign(window, { rasterLifecycleUrls: () => urls.size })
    })
    const workers = new Set<import('@playwright/test').Worker>()
    page.on('worker', worker => { workers.add(worker); worker.on('close', () => workers.delete(worker)) })
    const marker = 'pt-imp009-private-raster'
    const requests: Array<{ url: string; method: string }> = []
    const leaks: string[] = [], errors: string[] = [], sockets: string[] = []
    page.on('request', request => requests.push({ url: request.url(), method: request.method() }))
    page.on('console', message => { if (message.text().includes(marker)) leaks.push(message.text()) })
    page.on('pageerror', error => errors.push(error.message))
    page.on('websocket', socket => sockets.push(socket.url()))
    const source = await PDFDocument.create()
    source.addPage([72, 36]).drawText('Synthetic', { x: 2, y: 10, size: 8 })
    const buffer = Buffer.from(await source.save())
    await page.goto(`pdf-to-${format}/`)
    const original = page.url(), origin = new URL(original).origin
    const result = page.getByRole('region', { name: 'Results' })
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.locator('input[type=file]').setInputFiles({ name: marker + '.pdf', mimeType: 'application/pdf', buffer })
      await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toBeVisible()
      await page.getByRole('combobox', { name: 'Resolution', exact: true }).selectOption('96')
      await page.getByRole('button', { name: 'Create images', exact: true }).click()
      await expect(result).toBeVisible()
      await expect.poll(() => result.locator('.page-placeholder').count()).toBe(0)
      const pending = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Download all as ZIP', exact: true }).click()
      const file = await pending
      const entries = Object.entries(unzipSync(new Uint8Array(await readFile((await file.path())!))))
      expect(entries).toHaveLength(1)
      expect(entries[0][0]).toBe(`${marker}-page-1.${format}`)
      const metadata = readImageMetadata(entries[0][1])
      expect(metadata).toMatchObject({ kind: format === 'jpg' ? 'jpeg' : 'png', width: 96, height: 48 })
      if (cycle < 2) await page.getByRole('button', { name: 'Start over', exact: true }).click()
      else {
        await page.goto(new URL('../de/', original).href)
        await page.goBack()
        await expect(page).toHaveURL(original)
      }
      await expect(result).toHaveCount(0)
      await expect(page.locator('.file-row')).toHaveCount(0)
      await expect(page.locator('canvas')).toHaveCount(0)
      await expect.poll(() => page.evaluate(() => (window as unknown as { rasterLifecycleUrls(): number }).rasterLifecycleUrls())).toBe(0)
      await expect.poll(() => workers.size).toBe(0)
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
    }
    expect(requests.filter(r => !['GET', 'HEAD'].includes(r.method) ||
      (/^https?:/.test(r.url) && new URL(r.url).origin !== origin) || r.url.includes(marker))).toEqual([])
    expect(leaks).toEqual([])
    expect(errors).toEqual([])
    expect(sockets).toEqual([])
  })
}


test('PT-IMP-009 reader: repeated viewing and abandoned workspace release resources', async ({ page }) => {
  await page.addInitScript(() => {
    const urls = new Set<string>()
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url }
    URL.revokeObjectURL = url => { urls.delete(url); revoke(url) }
    Object.assign(window, { readerLifecycleUrls: () => urls.size })
  })
  const workers = new Set<import('@playwright/test').Worker>()
  page.on('worker', worker => { workers.add(worker); worker.on('close', () => workers.delete(worker)) })
  const marker = 'pt-imp009-reader-private'
  const requests: Array<{ url: string; method: string }> = []
  const leaks: string[] = [], errors: string[] = [], sockets: string[] = []
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }))
  page.on('console', message => { if (message.text().includes(marker)) leaks.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  page.on('websocket', socket => sockets.push(socket.url()))
  const source = await PDFDocument.create()
  source.addPage([600, 400]).drawText(marker, { x: 20, y: 350, size: 12 })
  const buffer = Buffer.from(await source.save())
  await page.goto('reader/')
  const original = page.url(), origin = new URL(original).origin
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('input[type=file]').setInputFiles({ name: marker + '.pdf', mimeType: 'application/pdf', buffer })
    await expect(page.locator('.file-row')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeEnabled()
    const canvas = page.locator('.reader-viewport canvas')
    await expect(canvas).toBeVisible()
    await expect.poll(() => canvas.evaluate(element => {
      const c = element as HTMLCanvasElement
      return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data.some((value, i) => i % 4 !== 3 && value < 200)
    })).toBe(true)
    await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open print dialog', exact: true })).toBeVisible()
    if (cycle < 2) await page.getByRole('button', { name: 'Start over', exact: true }).click()
    else {
      await page.goto(new URL('../de/', original).href)
      await page.goBack()
      await expect(page).toHaveURL(original)
    }
    await expect(page.locator('.file-row')).toHaveCount(0)
    await expect(page.locator('.reader-viewport')).toHaveCount(0)
    await expect(page.locator('.reader-print-frame')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => (window as unknown as { readerLifecycleUrls(): number }).readerLifecycleUrls())).toBe(0)
    await expect.poll(() => workers.size).toBe(0)
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  }
  expect(requests.filter(r => !['GET', 'HEAD'].includes(r.method) ||
    (/^https?:/.test(r.url) && new URL(r.url).origin !== origin) || r.url.includes(marker))).toEqual([])
  expect(leaks).toEqual([])
  expect(errors).toEqual([])
  expect(sockets).toEqual([])
})
