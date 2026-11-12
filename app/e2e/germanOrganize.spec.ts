import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { SITE_URL } from '../src/lib/pageMetadata'

test('PT-SEO-010 German Organize: static HTML, crawlable metadata and readable no-JS guide', async ({ request, browser }) => {
  const response = await request.get('de/organize/')
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('<html lang="de">')
  expect(html).toContain(`rel="canonical" href="${SITE_URL}de/organize/"`)
  expect(html).toContain(`hreflang="en" href="${SITE_URL}organize/"`)
  for (const text of ['Tastatur', 'Screenreader', 'Drag-and-drop', '50 MiB', 'keine sichere Schwärzung', 'JavaScript']) expect(html).toContain(text)
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('de/organize/')
    await expect(page.getByRole('heading', { level: 1, name: 'PDF-Seiten organisieren' })).toBeVisible()
  } finally { await context.close() }
})

test('PT-SEO-010 German Organize: accessible reorder, duplicate, rotate, remove, confirm and verified output', async ({ page }) => {
  test.setTimeout(150_000)
  const doc = await PDFDocument.create()
  for (const width of [300, 310, 320]) doc.addPage([width, 400])
  const bytes = Buffer.from(await doc.save())
  const outbound: string[] = []
  page.on('request', req => {
    if (new URL(req.url()).origin !== 'http://127.0.0.1:4178') outbound.push(req.url())
  })
  await page.goto('de/organize/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.locator('input[type=file]').setInputFiles({ name: 'PRIVATE-SYNTHETIC-ORGANIZE.pdf', mimeType: 'application/pdf', buffer: bytes })
  await expect(page.locator('.organize-card')).toHaveCount(3)
  await page.getByRole('button', { name: 'Seite an Position 3 früher platzieren' }).press('Enter')
  await page.getByRole('button', { name: 'Seite an Position 2 früher platzieren' }).click()
  await expect(page.getByText('Reihenfolge der Originalseiten: 3, 1, 2')).toBeVisible()
  await page.getByRole('button', { name: 'Seite an Position 2 duplizieren' }).click()
  await expect(page.locator('.organize-card')).toHaveCount(4)
  await page.getByRole('button', { name: 'Seite an Position 1 nach rechts drehen' }).click()
  await page.getByRole('button', { name: 'Seite an Position 4 entfernen' }).click()
  await expect(page.getByText('Zu entfernende Originalseiten: 2')).toBeVisible()
  const create = page.getByRole('button', { name: 'Organisierte PDF-Kopie erstellen' })
  await expect(create).toBeDisabled()
  await page.locator('.page-delete-confirmation input[type=checkbox]').check()
  await expect(create).toBeEnabled()
  await create.click()
  await expect(page.getByRole('region', { name: 'Ergebnisse' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Herunterladen / }).click()
  const file = await download
  const output = await PDFDocument.load(await readFile((await file.path())!))
  expect(output.getPageCount()).toBe(3)
  expect(output.getPages().map(p => p.getWidth())).toEqual([320, 300, 300])
  expect(output.getPages().map(p => p.getRotation().angle)).toEqual([90, 0, 0])
  expect(await page.locator('head').innerHTML()).not.toContain('PRIVATE-SYNTHETIC-ORGANIZE')
  expect(outbound).toEqual([])
  await page.getByRole('button', { name: 'Neu beginnen' }).click()
  await expect(page.locator('.organize-card')).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
})

test('PT-SEO-010 German Organize: mobile alternatives are reachable, named and finger-sized', async ({ page, isMobile }) => {
  const doc = await PDFDocument.create()
  for (let i = 0; i < 3; i++) doc.addPage()
  await page.goto('de/organize/')
  await page.locator('input[type=file]').setInputFiles({ name: 'MOBILE-SYNTHETIC.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) })
  await expect(page.locator('.organize-card')).toHaveCount(3)
  const earlier = page.getByRole('button', { name: 'Seite an Position 2 früher platzieren' })
  await expect(earlier).toBeEnabled()
  if (isMobile) {
    const box = await earlier.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await earlier.tap()
  } else {
    await earlier.press('Enter')
  }
  await expect(page.getByText('Reihenfolge der Originalseiten: 2, 1, 3')).toBeVisible()
  await page.locator('.organize-card').first().getByRole('button', { name: /Ausgabeseite 1, Originalseite 2/ }).click()
  await page.getByLabel('Eine ausgewählte Seite zu Position verschieben').fill('3')
  await page.getByRole('button', { name: 'Ausgewählte Seite verschieben' }).click()
  await expect(page.getByText('Reihenfolge der Originalseiten: 1, 3, 2')).toBeVisible()
})
