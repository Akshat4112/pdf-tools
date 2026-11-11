import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { SITE_URL } from '../src/lib/pageMetadata'

/** Synthetic documents only: German route, local selection, output and state lifecycle. */
test('PT-SEO-010: German Rotate has direct-load metadata and usable no-JS instructions', async ({ request, browser }) => {
  const response = await request.get('de/rotate/')
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('<html lang="de">')
  expect(html).toContain(`rel="canonical" href="${SITE_URL}de/rotate/"`)
  expect(html).toContain(`hreflang="en" href="${SITE_URL}rotate/"`)
  expect(html).toContain('PDF-Seiten')
  expect(html).toContain('Digitale Signaturen')
  const noJs = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await noJs.newPage()
    await page.goto('de/rotate/')
    await expect(page.getByRole('heading', { level: 1, name: 'PDF-Seiten drehen' })).toBeVisible()
    await expect(page.getByText('50 MiB', { exact: false })).toBeVisible()
  } finally { await noJs.close() }
})

test('PT-SEO-010: German Rotate makes a verified locally rotated PDF', async ({ page }) => {
  test.setTimeout(120_000)
  const doc = await PDFDocument.create()
  doc.addPage([300, 400])
  doc.addPage([400, 300])
  const input = Buffer.from(await doc.save())
  const outgoing: string[] = []
  page.on('request', req => { if (new URL(req.url()).origin !== 'http://127.0.0.1:4178') outgoing.push(req.url()) })
  await page.goto('de/rotate/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.locator('input[type=file]').setInputFiles({ name: 'PRIVATE-ROTATE-SYNTHETIC.pdf', mimeType: 'application/pdf', buffer: input })
  await expect(page.locator('.page-pick')).toHaveCount(2)
  await page.locator('.page-pick').first().click()
  await page.getByRole('button', { name: 'Ausgewählte nach rechts drehen' }).click()
  await expect(page.getByRole('button', { name: 'Gedrehte Kopie erstellen' })).toBeEnabled()
  await page.getByRole('button', { name: 'Gedrehte Kopie erstellen' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Herunterladen / }).click()
  const result = await download
  const output = await PDFDocument.load(await readFile((await result.path())!))
  expect(output.getPageCount()).toBe(2)
  expect(output.getPage(0).getRotation().angle).toBe(90)
  expect(output.getPage(1).getRotation().angle).toBe(0)
  expect(await page.locator('head').innerHTML()).not.toContain('PRIVATE-ROTATE-SYNTHETIC')
  expect(outgoing).toEqual([])
  await page.getByRole('button', { name: 'Neu beginnen' }).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
})
