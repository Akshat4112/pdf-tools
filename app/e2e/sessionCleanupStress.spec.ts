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
      const active = new Set<string>()
      URL.createObjectURL = blob => { const url = create(blob); active.add(url); return url }
      URL.revokeObjectURL = url => { active.delete(url); revoke(url) }
      Object.assign(window, { ptImp009ActiveUrls: () => active.size })
    })
    await page.goto(`${route}/`)
    const bytes = await fixture()
    const baseline = await page.evaluate(() => (window as unknown as { ptImp009ActiveUrls(): number }).ptImp009ActiveUrls())
    const run = page.getByRole('button', { name: route === 'merge' ? 'Merge PDFs' : 'Split PDF', exact: true })
    for (let cycle = 0; cycle < 12; cycle++) {
      const file = { name: `synthetic-${cycle}.pdf`, mimeType: 'application/pdf', buffer: bytes }
      await page.locator('input[type=file]').setInputFiles(route === 'merge'
        ? [file, { ...file, name: `second-${cycle}.pdf` }] : file)
      await expect(page.locator('.file-row')).toHaveCount(route === 'merge' ? 2 : 1)
      if (route === 'split') await page.getByRole('textbox', { name: 'Ranges (comma separated)' }).fill('1-3')
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
      await expect.poll(() => page.evaluate(() => (window as unknown as { ptImp009ActiveUrls(): number }).ptImp009ActiveUrls())).toBe(baseline)
      expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
    }
    await page.reload()
    await expect(page.locator('.file-row')).toHaveCount(0)
    expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  })
}
