import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const fixture = (name: string) => path.resolve('../fixtures/pdf', name)
const THREE = 'F-001-plain-text-3p.pdf'
const THIRTY = 'F-002-plain-text-30p.pdf'

async function choose(page: Page, route: string, file = THREE) {
  await page.goto(route)
  const chooser = page.waitForEvent('filechooser')
  // The shared picker also labels its native file input; target the visible button.
  await page.locator('button').filter({ hasText: /^Choose files$/ }).click()
  await (await chooser).setFiles(fixture(file))
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toBeVisible()
}

async function outputTexts(page: Page, suffix: string) {
  await expect(page.getByRole('region', { name: 'Results' })).toBeVisible()
  const received = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Download / }).click()
  const download = await received
  expect(download.suggestedFilename().endsWith(suffix)).toBe(true)
  const bytes = new Uint8Array(await readFile((await download.path())!))
  const loading = getDocument({ data: bytes, standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' })
  const doc = await loading.promise
  try {
    const texts: string[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      texts.push((await page.getTextContent()).items.map((item) => 'str' in item ? item.str : '').join(' '))
    }
    return texts
  } finally { await loading.destroy() }
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => { throw error })
  // Fail closed if a local document flow attempts an external request.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'blob:' && url.protocol !== 'data:') {
      throw new Error(`Unexpected external request: ${url.origin}`)
    }
    return route.continue()
  })
})

test('custom ranges and keyboard thumbnails produce exactly the preview order', async ({ page }) => {
  await page.addInitScript(() => {
    const live = new Set<string>()
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      const url = create(blob)
      if (blob instanceof Blob && blob.type === 'application/pdf') live.add(url)
      return url
    }
    URL.revokeObjectURL = (url) => { live.delete(url); revoke(url) }
    Object.assign(window, { pdfDownloadUrls: live })
  })
  await choose(page, 'extract-pages/')
  const input = page.locator('#page-selection')
  await page.locator('#page-selection').fill('3, 1')
  await expect(page.getByRole('button', { name: 'Page 3', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const second = page.getByRole('button', { name: 'Page 2', exact: true })
  await second.focus()
  await page.keyboard.press('Space')
  await expect(input).toHaveValue('3, 1, 2')
  await page.getByRole('button', { name: 'Page 1', exact: true }).click()
  await expect(page.locator('#page-selection')).toHaveValue('3, 2')
  await expect(page.getByText('Output order: 3, 2', { exact: true })).toBeVisible()
  await expect.poll(() => page.locator('.page-placeholder').count()).toBe(0)
  await page.getByRole('button', { name: 'Extract pages', exact: true }).click()
  const texts = await outputTexts(page, '-extracted.pdf')
  expect(texts).toHaveLength(2)
  expect(texts[0]).toContain('PACKING-BOX-0003')
  expect(texts[1]).toContain('PACKING-BOX-0002')
  expect(await page.evaluate(() => (window as unknown as { pdfDownloadUrls: Set<string> }).pdfDownloadUrls.size)).toBe(1)
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { pdfDownloadUrls: Set<string> }).pdfDownloadUrls.size)).toBe(0)
  await expect(page.locator('.page-grid')).toHaveCount(0)
  await expect(page.getByText('No files selected yet.')).toBeVisible()
})

test('deletion requires fresh confirmation and downloads the exact remaining pages', async ({ page }) => {
  await choose(page, 'delete-pages/')
  await page.getByRole('button', { name: 'Page 2', exact: true }).click()
  const submit = page.getByRole('button', { name: 'Create copy without selected pages' })
  const confirm = page.getByRole('checkbox')
  await expect(page.getByText('Output order: 1, 3', { exact: true })).toBeVisible()
  await expect(submit).toBeDisabled()
  await confirm.check()
  await expect(submit).toBeEnabled()
  await page.locator('#page-selection').fill('3')
  await expect(confirm).not.toBeChecked()
  await expect(submit).toBeDisabled()
  await expect(page.getByText('Output order: 1, 2', { exact: true })).toBeVisible()
  await confirm.check()
  await submit.click()
  const texts = await outputTexts(page, '-pages-removed.pdf')
  expect(texts).toHaveLength(2)
  expect(texts[0]).toContain('PACKING-BOX-0001')
  expect(texts[1]).toContain('PACKING-BOX-0002')
})

test('empty invalid and all-delete selections cannot create an output', async ({ page }) => {
  await choose(page, 'delete-pages/')
  const submit = page.getByRole('button', { name: 'Create copy without selected pages' })
  await expect(submit).toBeDisabled()
  for (const value of ['4', '3-1', 'nonsense']) {
    await page.locator('#page-selection').fill(value)
    await expect(page.locator('#page-selection')).toHaveAttribute('aria-invalid', 'true')
    await expect(submit).toBeDisabled()
  }
  await page.getByRole('button', { name: 'Select all pages', exact: true }).click()
  await expect(page.getByText(/Deleting every page would leave an empty document/)).toBeVisible()
  await expect(page.locator('.page-pick[aria-pressed=true]')).toHaveCount(3)
  await expect(submit).toBeDisabled()
  await page.getByRole('button', { name: 'Page 1', exact: true }).click()
  await expect(page.getByText('Output order: 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
})

test('pagination bounds canvases and source replacement resets selection and review', async ({ page }) => {
  await choose(page, 'delete-pages/', THIRTY)
  await page.locator('#page-selection').fill('30, 1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Next pages', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Page 9', exact: true })).toBeVisible()
  await expect(page.locator('.page-grid canvas')).toHaveCount(8)
  await expect(page.locator('#page-selection')).toHaveValue('30, 1')
  await page.locator('input[type=file]').setInputFiles(fixture(THREE))
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toBeVisible()
  await expect(page.locator('.page-grid canvas')).toHaveCount(3)
  await expect(page.locator('#page-selection')).toHaveValue('')
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create copy without selected pages' })).toBeDisabled()
  await page.locator('#page-selection').fill('1')
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('button', { name: 'Clear files', exact: true }).click()
  await expect(page.locator('.page-grid')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.locator('a[href="/pdf-tools/extract-pages"]')).toBeVisible()
  await expect(page.locator('a[href="/pdf-tools/delete-pages"]')).toBeVisible()
})

test('only-page deletion is blocked and route changes discard document data', async ({ page }) => {
  const doc = await PDFDocument.create()
  doc.addPage()
  const bytes = Buffer.from(await doc.save())
  await page.goto('delete-pages/')
  await page.locator('input[type=file]').setInputFiles({ name: 'one.pdf', mimeType: 'application/pdf', buffer: bytes })
  await page.getByRole('button', { name: 'Page 1', exact: true }).click()
  await expect(page.getByText(/Deleting every page would leave an empty document/)).toBeVisible()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.locator('a[href="/pdf-tools/extract-pages"]').click()
  await expect(page.getByText('No files selected yet.')).toBeVisible()
  await expect(page.locator('.page-grid')).toHaveCount(0)
})

test('read errors recover and thumbnails fit the viewport', async ({ page }) => {
  await page.goto('extract-pages/')
  await page.locator('input[type=file]').setInputFiles(fixture('F-010-encrypted-aes256.pdf'))
  await expect(page.getByText(/password-protected|encrypted/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Extract pages', exact: true })).toBeDisabled()
  await page.locator('input[type=file]').setInputFiles(fixture('F-011-malformed-truncated.pdf'))
  await expect(page.getByText(/could not be read|invalid|malformed/i).first()).toBeVisible()
  await choose(page, 'extract-pages/')
  await expect.poll(() => page.locator('.page-placeholder').count()).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('cancelling a pending job cannot show a late result after reset', async ({ page }) => {
  await choose(page, 'extract-pages/')
  await page.locator('#page-selection').fill('3, 1')
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/assets/pdf.worker.min.mjs', async (route) => {
    await gate
    await route.continue()
  })
  await page.getByRole('button', { name: 'Extract pages', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Cancelled', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  release()
  await page.unroute('**/assets/pdf.worker.min.mjs')
  await expect(page.getByText('No files selected yet.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Results' })).toHaveCount(0)
  // A fresh job after cancellation must still finish with its own output.
  await page.locator('input[type=file]').setInputFiles(fixture(THREE))
  await page.getByRole('button', { name: 'Page 2', exact: true }).click()
  await page.getByRole('button', { name: 'Extract pages', exact: true }).click()
  const texts = await outputTexts(page, '-extracted.pdf')
  expect(texts).toHaveLength(1)
  expect(texts[0]).toContain('PACKING-BOX-0002')
})
