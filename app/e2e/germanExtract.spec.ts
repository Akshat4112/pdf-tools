import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { SITE_URL } from '../src/lib/pageMetadata'

test('PT-SEO-010: German Extract has an indexable standalone no-JS route and paired metadata', async ({ request, browser }) => {
  const res = await request.get('de/extract-pages/')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('<html lang="de">')
  expect(html).toContain(`rel="canonical" href="${SITE_URL}de/extract-pages/"`)
  expect(html).toContain(`hreflang="en" href="${SITE_URL}extract-pages/"`)
  for (const s of ['JavaScript', '50 MiB', 'von dir angegebenen Reihenfolge', 'keine sichere Schwärzung']) expect(html).toContain(s)
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('de/extract-pages/')
    await expect(page.getByRole('heading', { level: 1, name: 'Ausgewählte PDF-Seiten extrahieren' })).toBeVisible()
  } finally { await context.close() }
})

test('PT-SEO-010: German Extract produces verified selected pages without data egress or persistence', async ({ page }) => {
  test.setTimeout(120_000)
  const doc = await PDFDocument.create()
  for (const width of [300, 310, 320, 330]) doc.addPage([width, 400])
  const input = Buffer.from(await doc.save())
  const outgoing: string[] = []
  page.on('request', req => { if (new URL(req.url()).origin !== 'http://127.0.0.1:4178') outgoing.push(req.url()) })
  await page.goto('de/extract-pages/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.locator('input[type=file]').setInputFiles({ name: 'PRIVATE-EXTRACT-SYNTHETIC.pdf', mimeType: 'application/pdf', buffer: input })
  await expect(page.locator('.page-pick')).toHaveCount(4)
  const button = page.getByRole('button', { name: 'Ausgewählte Seiten extrahieren' })
  await expect(button).toBeDisabled()
  await page.locator('#page-selection').fill('4, 2')
  await expect(page.getByText('Reihenfolge im Ergebnis: 4, 2')).toBeVisible()
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.getByRole('region', { name: 'Ergebnisse' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Herunterladen / }).click()
  const file = await download
  const output = await PDFDocument.load(await readFile((await file.path())!))
  expect(output.getPageCount()).toBe(2)
  expect(output.getPage(0).getWidth()).toBe(330)
  expect(output.getPage(1).getWidth()).toBe(310)
  expect(await page.locator('head').innerHTML()).not.toContain('PRIVATE-EXTRACT-SYNTHETIC')
  expect(outgoing).toEqual([])
  await page.getByRole('button', { name: 'Neu beginnen' }).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
})
