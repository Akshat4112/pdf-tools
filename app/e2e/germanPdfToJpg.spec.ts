import { test, expect } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js'
import { readImageMetadata } from '../src/engines/imageMetadata'
import { SITE_URL } from '../src/lib/pageMetadata'

test('PT-SEO-010: German PDF to JPG static route, SEO and no-JS guidance', async ({ request, browser }) => {
  const response = await request.get('de/pdf-to-jpg/')
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('<html lang="de">')
  expect(html).toContain(`rel="canonical" href="${SITE_URL}de/pdf-to-jpg/"`)
  expect(html).toContain(`hreflang="en" href="${SITE_URL}pdf-to-jpg/"`)
  for (const word of ['JPG', '50 MiB', '8192', 'JavaScript', 'Reihenfolge']) expect(html).toContain(word)
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('de/pdf-to-jpg/')
    await expect(page.getByRole('heading', { level: 1, name: 'PDF-Seiten als JPG exportieren' })).toBeVisible()
  } finally { await context.close() }
})

test('PT-SEO-010: German JPG conversion preserves selected page order, local-only export and reset', async ({ page }) => {
  test.setTimeout(120_000)
  const pdf = await PDFDocument.create()
  for (const width of [72, 144, 216]) pdf.addPage([width, 36])
  const network: string[] = []
  page.on('request', r => { if (new URL(r.url()).origin !== 'http://127.0.0.1:4178') network.push(r.url()) })
  await page.goto('de/pdf-to-jpg/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.locator('input[type=file]').setInputFiles({ name: 'PRIVATE-GERMAN-JPG-SYNTHETIC.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) })
  await page.getByRole('textbox', { name: 'Umzuwandelnde Seiten' }).fill('3, 1')
  await page.getByRole('combobox', { name: 'Auflösung' }).selectOption('96')
  await page.getByLabel('JPG-Qualität (%)').fill('90')
  await expect(page.getByText('Ausgabereihenfolge: 3, 1')).toBeVisible()
  await page.getByRole('button', { name: 'JPG-Bilder erstellen' }).click()
  await expect(page.getByRole('region', { name: 'Ergebnisse' })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Alle als ZIP herunterladen' }).click()
  const file = await download
  const zip = new Uint8Array(await readFile((await file.path())!))
  const archive = new ZipReader(new Uint8ArrayReader(zip))
  try {
    const entries = await archive.getEntries()
    expect(entries.map(x => x.filename)).toEqual(['PRIVATE-GERMAN-JPG-SYNTHETIC-page-3.jpg', 'PRIVATE-GERMAN-JPG-SYNTHETIC-page-1.jpg'])
    const sizes = []
    for (const entry of entries) {
      if (!('getData' in entry) || !entry.getData) throw new Error(`Expected ZIP file entry: ${entry.filename}`)
      const bytes = await entry.getData(new Uint8ArrayWriter(), { checkSignature: true })
      const image = readImageMetadata(bytes)
      expect(image.kind).toBe('jpeg')
      sizes.push([image.width, image.height])
    }
    expect(sizes).toEqual([[288, 48], [96, 48]])
  } finally { await archive.close() }
  expect(network).toEqual([])
  expect(await page.locator('head').innerHTML()).not.toContain('PRIVATE-GERMAN-JPG-SYNTHETIC')
  await page.getByRole('button', { name: 'Neu beginnen' }).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
})

test('PT-IMP-003: standard font request failure preserves a usable JPG conversion', async ({ page }) => {
  test.setTimeout(120_000)
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Symbol)
  pdf.addPage([216, 72]).drawText('\u0391\u0392\u0393', { font, size: 24, x: 12, y: 24 })
  const buffer = Buffer.from(await pdf.save())
  let failed = 0
  let requests = 0
  await page.route('**/assets/standard_fonts/**', async route => {
    requests++
    if (failed === 0) {
      failed++
      await route.abort('failed')
    } else await route.continue()
  })
  try {
    await page.goto('de/pdf-to-jpg/')
    const timeOrigin = await page.evaluate(() => performance.timeOrigin)
    await page.locator('input[type=file]').setInputFiles({ name: 'font-fault.pdf', mimeType: 'application/pdf', buffer })
    await page.getByRole('textbox', { name: 'Umzuwandelnde Seiten' }).fill('1')
    await page.getByRole('combobox', { name: 'Auflösung' }).selectOption('96')
    await page.getByLabel('JPG-Qualität (%)').fill('90')
    await page.getByRole('button', { name: 'JPG-Bilder erstellen' }).click()
    await expect(page.getByRole('region', { name: 'Ergebnisse' })).toBeVisible()
    expect(failed).toBe(1)
    expect(requests).toBeLessThanOrEqual(4)
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
    const receiving = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Alle als ZIP herunterladen' }).click()
    const download = await receiving
    const zip = new Uint8Array(await readFile((await download.path())!))
    const archive = new ZipReader(new Uint8ArrayReader(zip))
    const bytes = await (async () => {
      try {
        const entries = await archive.getEntries()
        expect(entries.map(entry => entry.filename)).toEqual(['font-fault-page-1.jpg'])
        const entry = entries[0]
        if (!('getData' in entry) || !entry.getData) throw new Error('Expected JPG entry')
        return await entry.getData(new Uint8ArrayWriter(), { checkSignature: true })
      } finally { await archive.close() }
    })()
    const metadata = readImageMetadata(bytes)
    expect(metadata.kind).toBe('jpeg')
    expect([metadata.width, metadata.height]).toEqual([288, 96])
    // Decode the actual output, not just its metadata: a blank page is not recovery.
    const ink = await page.evaluate(async encoded => {
      const image = new Image()
      image.src = 'data:image/jpeg;base64,' + encoded
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(image, 0, 0)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let count = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100) count++
      }
      return count
    }, Buffer.from(bytes).toString('base64'))
    expect(ink).toBeGreaterThan(20)
  } finally {
    await page.unrouteAll({ behavior: 'wait' })
  }
})
