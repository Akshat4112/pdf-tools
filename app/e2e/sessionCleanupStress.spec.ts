import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { unzipSync } from 'fflate'

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
    let sharedZipWorkerUrl: string | undefined
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
      // zip.js lazily creates a module-level worker script URL for Split ZIP exports.
      // Allow only one *stable* worker URL; generated PDF/download URLs must be revoked.
      // A growing set of worker URLs is still a failure, not an accepted baseline.
      await expect.poll(async () => {
        const details = await page.evaluate(() => (window as unknown as {
          ptImp009UrlDetails(): Array<{ url: string; type: string; size: number; stack: string }>
        }).ptImp009UrlDetails())
        const unexpected = details.filter(item => !(
          route === 'split' && item.type === 'text/javascript' &&
          item.stack.includes('workerURI') && item.stack.includes('zip.js')
        ))
        if (unexpected.length) console.log(`PT-IMP-009 ${route} cycle ${cycle} unexpected URLs: ${JSON.stringify(unexpected)}`)
        if (unexpected.length) return false
        const workerUrls = details.filter(item => item.stack.includes('workerURI') && item.stack.includes('zip.js'))
        if (route === 'split' && workerUrls.length === 1) {
          if (sharedZipWorkerUrl && sharedZipWorkerUrl !== workerUrls[0].url) return false
          sharedZipWorkerUrl = workerUrls[0].url
        }
        return workerUrls.length <= (route === 'split' ? 1 : 0) && details.length <= baseline + (route === 'split' ? 1 : 0)
      }, { timeout: 10_000, intervals: [250, 1000, 2000] }).toBe(true)
      // After Start over, PDF.js job workers must terminate in the same document.
      // zip.js may retain one shared worker for subsequent Split ZIP operations;
      // do not mistake that known shared worker for an accumulating job worker.
      await expect.poll(() => liveWorkers.size, {
        timeout: 10_000, intervals: [100, 250, 1000],
      }).toBeLessThanOrEqual(route === 'split' ? 1 : 0)
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
    // per cycle plus two initial workers, one being zip.js's shared Blob worker.
    // These workers terminate (peak <=2); cumulative creation alone is not a leak.
    // Keep a bounded per-cycle regression guard rather than the unsupported 2/cycle cap.
    const maxWorkersPerCycle = route === 'merge' ? 3 : 4
    const startupAllowance = route === 'split' ? 2 : 0
    expect(workersCreated, `Unexpected ${route} worker churn`).toBeLessThanOrEqual(cycleCount * maxWorkersPerCycle + startupAllowance)
    for (let i = 1; i < workerCycleSamples.length; i++) {
      const createdThisCycle = workerCycleSamples[i].created - workerCycleSamples[i - 1].created
      expect(createdThisCycle, `Unexpected worker churn in ${route} cycle ${i + 1}`).toBeLessThanOrEqual(maxWorkersPerCycle)
    }
    const unexpectedWorkerOrigins = [...workerOrigins.keys()].filter(url =>
      !url.includes('/assets/pdf.worker.min.mjs') && !(route === 'split' && url.startsWith('blob:'))
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
    expect(pageErrors, 'PDF workflows must not raise uncaught browser exceptions').toEqual([])
    expect(filenameUrlLeaks, 'Input filenames must not appear in any network URL, including same-origin GETs').toEqual([])
    expect(outboundWrites, 'PDF workflows must not upload data via network writes').toEqual([])
    expect(observedHttpRequests.filter(request => new URL(request.url).origin !== appOrigin), 'Initial loading and PDF processing must not send even read-only requests to third-party origins').toEqual([])
    // Exercise browser history after repeated processing: returning to the tool must
    // not resurrect selected files, generated results or private browser storage.
    const toolUrl = page.url()
    const homeUrl = new URL('../', toolUrl).href
    await page.goto(homeUrl)
    // zip.js keeps a single module-scoped worker script URL while the Split tool
    // document is alive. Independently verify that document navigation releases
    // that URL: a Blob URL retained by the old document must not remain fetchable.
    // This checks document-unload revocation, not same-document Start over cleanup.
    if (sharedZipWorkerUrl) {
      const workerUrl = sharedZipWorkerUrl
      await expect.poll(async () => page.evaluate(async url => {
        try {
          const response = await fetch(url)
          return response.ok
        } catch {
          return false
        }
      }, workerUrl), { timeout: 10_000 }).toBe(false)
    }
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
), '')
    for (const localePath of [`de/${route}/`, `${route}/`]) {
      await page.goto(`${origin}${basePath}${localePath}`)
      await expect(page.locator('input[type=file]')).toHaveCount(1)
      await expect(page.locator('.file-row')).toHaveCount(0)
      await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
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
    expect(pageErrors, 'Reload must not raise uncaught browser exceptions').toEqual([])
  })
}
