import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

// PT-IMP-009: synthetic browser lifecycle stress, complementary to FileSession unit stress.
// Keep this bounded in CI; extended 100-cycle/memory profiling is a separate acceptance gate.
const fixture = () => readFile('../fixtures/pdf/F-001-plain-text-3p.pdf')

for (const route of ['merge', 'split'] as const) {
  test(`PT-IMP-009 ${route}: repeated processing, download and reset leave no retained URLs or storage`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.addInitScript(() => {
      const create = URL.createObjectURL.bind(URL)
      const revoke = URL.revokeObjectURL.bind(URL)
      const active = new Map<string, { type: string; size: number; stack: string }>()
      URL.createObjectURL = blob => { const url = create(blob); active.set(url, { type: blob instanceof Blob ? blob.type : 'MediaSource', size: blob instanceof Blob ? blob.size : 0, stack: new Error().stack?.slice(0, 1200) ?? '' }); return url }
      URL.revokeObjectURL = url => { active.delete(url); revoke(url) }
      Object.assign(window, { ptImp009ActiveUrls: () => active.size, ptImp009UrlDetails: () => [...active.entries()].map(([url, detail]) => ({ url, ...detail })) })
    })
    await page.goto(`${route}/`)
    const bytes = await fixture()
    const baseline = await page.evaluate(() => (window as unknown as { ptImp009ActiveUrls(): number }).ptImp009ActiveUrls())
    let sharedZipWorkerUrl: string | undefined
    const run = page.getByRole('button', { name: route === 'merge' ? 'Merge PDFs' : 'Split PDF', exact: true })
    for (let cycle = 0; cycle < 12; cycle++) {
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
      expect((await readFile((await download.path())!)).byteLength).toBeGreaterThan(0)
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
      expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
    }
    await page.reload()
    await expect(page.locator('.file-row')).toHaveCount(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  })
}
