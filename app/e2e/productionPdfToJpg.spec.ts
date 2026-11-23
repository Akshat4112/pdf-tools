import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js'
import { readImageMetadata } from '../src/engines/imageMetadata'

test('PT-IMP-003: English and German deployed PDF-to-JPG conversion', async ({ page }) => {
  test.setTimeout(120_000)
  for (const [route, labels] of [
    ['pdf-to-jpg/', { pages: 'Pages to convert', create: 'Create images', results: 'Results', zip: 'Download all as ZIP' }],
    ['de/pdf-to-jpg/', { pages: 'Umzuwandelnde Seiten', create: 'JPG-Bilder erstellen', results: 'Ergebnisse', zip: 'Alle als ZIP herunterladen' }],
  ] as const) {
    const pdf = await PDFDocument.create()
    pdf.addPage([72, 36]).drawRectangle({ x: 10, y: 10, width: 30, height: 12 })
    await page.goto(route)
    await page.locator('input[type=file]').setInputFiles({
      name: 'synthetic-production-smoke.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()),
    })
    await page.getByRole('textbox', { name: labels.pages }).fill('1')
    await page.getByRole('button', { name: labels.create }).click()
    await expect(page.getByRole('region', { name: labels.results })).toBeVisible()
    const receiving = page.waitForEvent('download')
    await page.getByRole('button', { name: labels.zip }).click()
    const downloaded = await receiving
    const archive = new ZipReader(new Uint8ArrayReader(new Uint8Array(await readFile((await downloaded.path())!))))
    try {
      const entries = await archive.getEntries()
      expect(entries.map(e => e.filename)).toEqual(['synthetic-production-smoke-page-1.jpg'])
      const entry = entries[0]
      if (!('getData' in entry) || !entry.getData) throw new Error('Expected JPEG entry')
      const bytes = await entry.getData(new Uint8ArrayWriter(), { checkSignature: true })
      const metadata = readImageMetadata(bytes)
      expect(metadata.kind).toBe('jpeg')
      expect(metadata.width).toBeGreaterThan(0)
      expect(metadata.height).toBeGreaterThan(0)
    } finally {
      await archive.close()
    }
  }
})
