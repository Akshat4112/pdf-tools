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
    // Unhandled browser exceptions during a long session are a lifecycle regression,\n    // even when the visible result and download appear successful.\n    const pageErrors: string[] = []\n    page.on('pageerror', error => pageErrors.push(error.message))\n    const outboundWrites: Array<{ method: string; url: string }> = []
    page.on('request', request => {
      if (!['GET', 'HEAD'].includes(request.method())) {
        outboundWrites.push({ method: request.method(), url: request.url() })
      }
    })
    await page.goto(`${route}/`)
    // A read-only cross-origin request can still leak document details in its URL.
    // Monitor the processing phase separately from initial application asset loading.
    const appOrigin = new URL(page.url()).origin
    const crossOriginRequests: Array<{ method: string; url: string }> = []
    page.on('request', request => {
      const url = new URL(request.url())
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== appOrigin) {
        crossOriginRequests.push({ method: request.method(), url: request.url() })
      }
    })
    const bytes = await fixture()
    const baseline = await page.evaluate(() => (window as unknown as { ptImp009ActiveUrls(): number }).ptImp009ActiveUrls())
    let sharedZipWorkerUrl: string | undefined
    const run = page.getByRole('button', { name: route === 'merge' ? 'Merge PDFs' : 'Split PDF', exact: true })
    const heapSamples: Array<{ cycle: number; bytes: number }> = []
    // Include a pre-processing baseline; without it, cycle-one allocations are invisible.
    if (extended) {
      const initialHeap = await page.evaluate(() =>
        (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize ?? null)
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
      expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])\n      expect(pageErrors, `Uncaught browser exceptions after ${route} cycle ${cycle + 1}`).toEqual([])
      if (extended && (cycle === 0 || (cycle + 1) % 10 === 0)) {
        // Chromium-only experimental JS heap metric. This is diagnostic, not total process RSS.
        const bytesUsed = await page.evaluate(() => {
          const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory
          return memory?.usedJSHeapSize ?? null
        })
        if (bytesUsed !== null) heapSamples.push({ cycle: cycle + 1, bytes: bytesUsed })
      }
    }
    if (extended) {
      expect(heapSamples.length, 'Extended Chromium profiling must expose baseline and repeated JS heap samples').toBeGreaterThan(2)
      expect(heapSamples[0].cycle).toBe(0)
      expect(heapSamples.at(-1)?.cycle).toBe(100)
      expect(heapSamples.every(sample => Number.isFinite(sample.bytes) && sample.bytes > 0)).toBe(true)
      const first = heapSamples[0].bytes
      const last = heapSamples[heapSamples.length - 1].bytes
      const peak = Math.max(...heapSamples.map(sample => sample.bytes))
      console.log(`PT-IMP-009 ${route} 100-cycle Chromium JS heap profile (diagnostic, NOT a memory-safety pass): ${JSON.stringify({ baselineBytes: first, finalBytes: last, deltaBytes: last - first, peakBytes: peak, samples: heapSamples })}`)
    }
    expect(pageErrors, 'PDF workflows must not raise uncaught browser exceptions').toEqual([])\n    expect(outboundWrites, 'PDF workflows must not upload data via network writes').toEqual([])
    expect(crossOriginRequests, 'PDF processing must not send even read-only requests to third-party origins').toEqual([])
    await page.reload()
    await expect(page.locator('.file-row')).toHaveCount(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  })
}
