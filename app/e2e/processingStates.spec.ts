import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function configure(page: Page, tool: 'merge' | 'split') {
  await page.goto(`${tool}/`)
  const buffer = await readFile('../fixtures/pdf/F-001-plain-text-3p.pdf')
  await page.locator('input[type="file"]').setInputFiles(tool === 'merge'
    ? [{ name: 'first.pdf', mimeType: 'application/pdf', buffer }, { name: 'second.pdf', mimeType: 'application/pdf', buffer }]
    : { name: 'source.pdf', mimeType: 'application/pdf', buffer })
  await expect(page.locator('.file-row')).toHaveCount(tool === 'merge' ? 2 : 1)
  if (tool === 'split') await page.getByRole('textbox', { name: 'Ranges (comma separated)' }).fill('1, 2-3')
  const run = page.getByRole('button', { name: tool === 'merge' ? 'Merge PDFs' : 'Split PDF', exact: true })
  await expect(run).toBeEnabled()
  return run
}

for (const tool of ['merge', 'split'] as const) {
  test(`PT-UI-006 ${tool}: cancel delayed work and discard late completion`, async ({ page }) => {
    const run = await configure(page, tool)
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let blocked = 0
    await page.route('**/assets/pdf.worker.min.mjs', async route => { blocked++; await gate; await route.continue() })
    try {
      await run.click()
      await expect.poll(() => blocked).toBeGreaterThan(0)
      const processing = page.getByRole('region', { name: 'Processing', exact: true })
      await expect(processing).toBeVisible()
      await expect(processing.getByRole('heading')).toBeFocused()
      await expect(processing.getByRole('progressbar')).toHaveAccessibleName(tool === 'merge' ? 'Merging your PDFs' : 'Splitting your PDF')
      await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(page.getByRole('status', { name: 'Cancelled', exact: true })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Cancelled', exact: true })).toBeFocused()
      await page.getByRole('button', { name: 'Adjust settings', exact: true }).click()
      await expect(page.locator('.file-row')).toHaveCount(tool === 'merge' ? 2 : 1)
      if (tool === 'split') await expect(page.getByRole('textbox', { name: 'Ranges (comma separated)' })).toHaveValue('1, 2-3')
      await expect(run).toBeEnabled()
    } finally { release() }
    await page.unroute('**/assets/pdf.worker.min.mjs')
    await run.click()
    const result = page.getByRole('region', { name: 'Results', exact: true })
    await expect(result).toBeVisible()
    await expect(result.getByRole('heading')).toBeFocused()
    await page.getByRole('button', { name: 'Start over', exact: true }).click()
    await expect(page.locator('.file-row')).toHaveCount(0)
    await expect(result).toHaveCount(0)
    await expect(run).toBeDisabled()
  })
}

test('PT-UI-006 split: invalidate old plan while a new preview loads', async ({ page }) => {
  const run = await configure(page, 'split')
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let blocked = 0
  await page.route('**/assets/pdf.worker.min.mjs', async route => { blocked++; await gate; await route.continue() })
  try {
    await page.getByRole('textbox', { name: 'Ranges (comma separated)' }).fill('1-2, 3')
    await expect.poll(() => blocked).toBeGreaterThan(0)
    await expect(run).toBeDisabled()
    await expect(page.getByRole('region', { name: 'Preview', exact: true })).toContainText('Reading the document')
    await expect(page.getByText('Parts: 1, 2–3', { exact: true })).toHaveCount(0)
  } finally { release() }
  await expect(run).toBeEnabled()
  await expect(page.getByText('Parts: 1–2, 3', { exact: true })).toBeVisible()
})

test('PT-UI-006 merge: recover from failure, show actual size and revoke reused URLs', async ({ page }) => {
  await page.addInitScript(() => {
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    const urls = new Set<string>()
    URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url }
    URL.revokeObjectURL = url => { urls.delete(url); revoke(url) }
    Object.assign(window, { testOutputUrls: () => urls.size })
  })
  const run = await configure(page, 'merge')
  await page.locator('input[type="file"]').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nnot a PDF body\n%%EOF') })
  await expect(page.locator('.file-row')).toHaveCount(3)
  await run.click()
  const failure = page.getByRole('alert', { name: 'Something went wrong', exact: true })
  await expect(failure).toBeVisible()
  await expect(failure.getByRole('heading')).toBeFocused()
  await expect(page.locator('.btn-download')).toHaveCount(0)
  await failure.getByRole('button', { name: 'Review settings', exact: true }).click()
  await expect(page.locator('.file-row')).toHaveCount(3)
  await page.getByRole('button', { name: 'Remove this file: broken.pdf', exact: true }).click()
  await expect(page.locator('.file-row')).toHaveCount(2)
  await run.click()
  const result = page.getByRole('region', { name: 'Results', exact: true })
  await expect(result).toBeVisible()
  const urls = () => page.evaluate(() => (window as unknown as { testOutputUrls(): number }).testOutputUrls())
  const before = await urls()
  for (let index = 0; index < 2; index++) {
    const received = page.waitForEvent('download')
    await result.getByRole('button', { name: /^Download / }).click()
    const download = await received
    const size = (await readFile((await download.path())!)).byteLength
    await expect(result.locator('.file-size')).toHaveAttribute('title', `${size.toLocaleString('en-US')} bytes`)
    expect(await urls()).toBe(before + 1)
  }
  await result.getByRole('button', { name: 'Adjust settings', exact: true }).click()
  expect(await urls()).toBe(before)
  await expect(result).toHaveCount(0)
  await expect(run).toBeEnabled()
})

test('PT-UI-006 result actions remain reachable at 320px in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const run = await configure(page, 'merge')
  await run.click()
  const result = page.getByRole('region', { name: 'Results', exact: true })
  await expect(result).toBeVisible()
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const button of await result.getByRole('button').all()) {
      await button.focus()
      await expect(button).toBeFocused()
      const box = await button.boundingBox()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  }
  await result.getByRole('button', { name: 'Back to all tools', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'PDF tools that work in your browser.' })).toBeVisible()
})
