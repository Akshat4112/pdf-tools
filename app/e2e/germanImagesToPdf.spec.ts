import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { png } from '../src/__tests__/imageFixtures'
import { SITE_URL } from '../src/lib/pageMetadata'

test('PT-SEO-010 German Images-to-PDF: static, accessible no-JS route and reciprocal metadata', async ({ request, browser }) => {
  const res = await request.get('de/images-to-pdf/')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('<html lang="de">')
  expect(html).toContain(`rel="canonical" href="${SITE_URL}de/images-to-pdf/"`)
  expect(html).toContain(`hreflang="en" href="${SITE_URL}images-to-pdf/"`)
  for (const phrase of ['JPG-', 'PNG-', '50 MiB', '25,6 Millionen', 'JavaScript', 'GitHub Pages']) expect(html).toContain(phrase)
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('de/images-to-pdf/')
    await expect(page.getByRole('heading', { level: 1, name: 'JPG und PNG in PDF umwandeln' })).toBeVisible()
  } finally { await context.close() }
})

test('PT-SEO-010 German Images-to-PDF: keyboard reordering, verified PDF download and no data egress', async ({ page }) => {
  test.setTimeout(120_000)
  const outgoing: string[] = []
  page.on('request', req => {
    if (new URL(req.url()).origin !== 'http://127.0.0.1:4178') outgoing.push(req.url())
  })
  await page.goto('de/images-to-pdf/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'PRIVATE-IMAGE-A.png', mimeType: 'image/png', buffer: Buffer.from(png(80, 40)) },
    { name: 'PRIVATE-IMAGE-B.png', mimeType: 'image/png', buffer: Buffer.from(png(96, 48)) },
  ])
  await expect(page.locator('.image-preview-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Früher platzieren: PRIVATE-IMAGE-B.png' }).press('Enter')
  await expect(page.locator('.file-row').first()).toContainText('PRIVATE-IMAGE-B.png')
  await page.getByRole('combobox', { name: 'Seitengröße' }).selectOption('original')
  await page.getByRole('combobox', { name: 'Originalgröße (DPI)' }).selectOption('96')
  await page.getByLabel('Seitenränder (Punkte)').fill('0')
  await expect(page.getByRole('button', { name: 'PDF erstellen' })).toBeEnabled()
  await page.getByRole('button', { name: 'PDF erstellen' }).click()
  await expect(page.getByRole('region', { name: 'Ergebnisse' })).toBeVisible()
  const next = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Herunterladen / }).click()
  const download = await next
  const pdfBytes = await readFile((await download.path())!)
  const written = await PDFDocument.load(pdfBytes)
  expect(written.getPageCount()).toBe(2)
  expect(written.getPages().map(p => Math.round(p.getWidth()))).toEqual([72, 60])
  expect(written.getPages().map(p => Math.round(p.getHeight()))).toEqual([36, 30])
  // Input filenames must not be embedded in exported PDF metadata or object streams.
  for (const marker of ['PRIVATE-IMAGE-A', 'PRIVATE-IMAGE-B']) {
    expect(pdfBytes.includes(Buffer.from(marker))).toBe(false)
    expect(written.getTitle() ?? '').not.toContain(marker)
    expect(written.getSubject() ?? '').not.toContain(marker)
    expect(written.getKeywords() ?? '').not.toContain(marker)
  }
  expect(outgoing).toEqual([])
  expect(await page.locator('head').innerHTML()).not.toContain('PRIVATE-IMAGE-')
  await page.getByRole('button', { name: 'Neu beginnen' }).click()
  await expect(page.locator('.image-preview-card')).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
})
