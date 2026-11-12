import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { SITE_URL } from '../src/lib/pageMetadata'

test('PT-SEO-010: Delete Pages German direct route, no-JS content and canonical pair', async ({ request, browser }) => {
  const res = await request.get('de/delete-pages/')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('<html lang="de">')
  expect(html).toContain(`rel="canonical" href="${SITE_URL}de/delete-pages/"`)
  expect(html).toContain(`hreflang="en" href="${SITE_URL}delete-pages/"`)
  for (const word of ['50 MiB', '300 Seiten', 'keine sichere Schwärzung', 'JavaScript']) expect(html).toContain(word)
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('de/delete-pages/')
    await expect(page.getByRole('heading', { level: 1, name: 'Seiten aus einem PDF entfernen' })).toBeVisible()
  } finally { await context.close() }
})

test('PT-SEO-010: German Delete requires confirmation and saves only remaining PDF pages', async ({ page }) => {
  test.setTimeout(120_000)
  const source = await PDFDocument.create()
  for (let n = 0; n < 3; n++) source.addPage([300 + n * 10, 400])
  const bytes = Buffer.from(await source.save())
  const outbound: string[] = []
  page.on('request', req => { if (new URL(req.url()).origin !== 'http://127.0.0.1:4178') outbound.push(req.url()) })
  await page.goto('de/delete-pages/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.locator('input[type=file]').setInputFiles({ name: 'SYNTHETIC-PRIVATE.pdf', mimeType: 'application/pdf', buffer: bytes })
  await expect(page.locator('.page-pick')).toHaveCount(3)
  await page.locator('#page-selection').fill('2')
  const run = page.getByRole('button', { name: 'Kopie ohne markierte Seiten erstellen' })
  await expect(run).toBeDisabled()
  await page.locator('.page-delete-confirmation input[type=checkbox]').check()
  await expect(run).toBeEnabled()
  await run.click()
  await expect(page.getByRole('region', { name: 'Ergebnisse' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Herunterladen / }).click()
  const saved = await download
  const result = await PDFDocument.load(await readFile((await saved.path())!))
  expect(result.getPageCount()).toBe(2)
  expect(result.getPage(0).getWidth()).toBe(300)
  expect(result.getPage(1).getWidth()).toBe(320)
  expect(await page.locator('head').innerHTML()).not.toContain('SYNTHETIC-PRIVATE')
  expect(outbound).toEqual([])
  await page.getByRole('button', { name: 'Neu beginnen' }).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
})
