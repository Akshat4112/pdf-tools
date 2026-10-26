/**
 * PT-QA-002: synthetic-only browser compatibility smoke.
 * Five Playwright projects cover Chromium, Firefox, Linux WebKit, and
 * Android/iPhone viewport emulation. They do NOT stand in for physical devices.
 * No screenshots, traces, downloads or uploaded files are retained by CI.
 */
import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function fixture() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  doc.addPage([288, 432]).drawText('PT-QA-002 synthetic only', { x: 20, y: 380, size: 12, font })
  return Buffer.from(await doc.save())
}

async function pick(page: Page, files: Array<{ name: string; mimeType: string; buffer: Buffer }>) {
  await page.locator('input[type=file]').setInputFiles(files)
  await expect(page.locator('.file-row')).toHaveCount(files.length)
}

test('PT-QA-002: keyboard search, locale switch, zoom and responsive controls', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'PDF tools that work in your browser.' })).toBeVisible()
  const search = page.getByRole('searchbox', { name: 'Search tools' })
  await page.keyboard.press('/')
  await expect(search).toBeFocused()
  await search.fill('merge')
  await expect(page.getByRole('link', { name: 'Open Merge PDF', exact: true })).toBeVisible()

  const select = page.locator('.folio-language select')
  await select.focus()
  await expect(select).toBeFocused()
  await select.selectOption('de')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('searchbox', { name: 'Tools suchen' })).toBeVisible()
  await select.selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  // Browser zoom is simulated with CSS zoom; real 200% browser zoom must still
  // be checked manually in PT-QA-002's device matrix.
  await page.setViewportSize({ width: 640, height: 900 })
  await page.evaluate(() => { document.documentElement.style.zoom = '2' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search tools' })).toBeVisible()
  const dimensions = await select.evaluate(el => {
    const r = el.getBoundingClientRect()
    return { width: r.width, height: r.height }
  })
  expect(dimensions.width).toBeGreaterThanOrEqual(44)
  expect(dimensions.height).toBeGreaterThanOrEqual(44)
})

test('PT-QA-002: merge gives verified download and reset in each engine', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('merge/')
  const buffer = await fixture()
  await pick(page, [
    { name: 'synthetic-a.pdf', mimeType: 'application/pdf', buffer },
    { name: 'synthetic-b.pdf', mimeType: 'application/pdf', buffer },
  ])
  const run = page.getByRole('button', { name: 'Merge PDFs', exact: true })
  await expect(run).toBeEnabled()
  await run.click()
  const result = page.getByRole('region', { name: 'Results', exact: true })
  await expect(result).toBeVisible()
  const button = result.getByRole('button', { name: /^Download / })
  const pending = page.waitForEvent('download')
  await button.click()
  const download = await pending
  const bytes = await readFile((await download.path())!)
  const merged = await PDFDocument.load(bytes)
  expect(merged.getPageCount()).toBe(2)
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  await expect(result).toHaveCount(0)
  await expect(run).toBeDisabled()
})

test('PT-QA-002: selection quota and two-tab isolation', async ({ page, context }) => {
  test.setTimeout(90_000)
  await page.goto('merge/')
  // Playwright rejects in-memory uploads >50 MB. Use an ephemeral disk-backed
  // synthetic file and remove it even if the browser assertion fails.
  const directory = await mkdtemp(join(tmpdir(), 'pdf-tools-quota-'))
  const oversizedPath = join(directory, 'synthetic-oversize.pdf')
  try {
    const tooLarge = Buffer.alloc(50 * 1024 * 1024 + 1)
    tooLarge.set(Buffer.from('%PDF-'))
    await writeFile(oversizedPath, tooLarge)
    await page.locator('input[type=file]').setInputFiles(oversizedPath)
    await expect(page.getByRole('alert').first()).toContainText('exceeds 50 MB')
    // Rejected files remain visible for recovery; explicitly clear the list.
    await page.getByRole('button', { name: 'Clear files' }).click()
    await expect(page.locator('.file-row')).toHaveCount(0)
  } finally {
    await page.locator('input[type=file]').setInputFiles([])
    await rm(directory, { recursive: true, force: true })
  }

  const other = await context.newPage()
  try {
    await other.goto('merge/')
    await expect(other.locator('.file-row')).toHaveCount(0)
    const buffer = await fixture()
    await page.locator('input[type=file]').setInputFiles({
      name: 'synthetic-private-name.pdf', mimeType: 'application/pdf', buffer,
    })
    await expect(page.locator('.file-row')).toHaveCount(1)
    await expect(other.locator('.file-row')).toHaveCount(0)
    await page.reload()
    await expect(page.locator('.file-row')).toHaveCount(0)
    expect(await page.evaluate(() => ({
      local: Object.keys(localStorage), session: Object.keys(sessionStorage),
    }))).toEqual({ local: [], session: [] })
  } finally {
    await other.close()
  }
})
