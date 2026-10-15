import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument, StandardFonts, PDFName, PDFString } from 'pdf-lib'

const unicodeText = 'Grüße café Ελληνικά 中文 😀'
async function mixedPdf() {
  const pdf = await PDFDocument.create(), page = pdf.addPage([400, 400])
  const words = Array.from(unicodeText)
  const hex = (word: string) => Array.from({ length: word.length }, (_, index) => word.charCodeAt(index).toString(16).padStart(4, '0')).join('')
  // Explicit ToUnicode mapping tests actual PDF.js Unicode extraction, including surrogate pairs.
  const cmap = pdf.context.register(pdf.context.flateStream(`/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /UnicodeTest def /CMapType 2 def 1 begincodespacerange <0000> <ffff> endcodespacerange ${words.length} beginbfchar ${words.map((word, index) => `<${(index + 1).toString(16).padStart(4, '0')}> <${hex(word)}>`).join('\n')} endbfchar endcmap CMapName currentdict /CMap defineresource pop end end`))
  const descriptor = pdf.context.register(pdf.context.obj({ Type: 'FontDescriptor', FontName: 'UnicodeTestFont', Flags: 4, FontBBox: [0, -200, 1000, 1000], ItalicAngle: 0, Ascent: 800, Descent: -200, CapHeight: 700, StemV: 80 }))
  const cid = pdf.context.register(pdf.context.obj({ Type: 'Font', Subtype: 'CIDFontType2', BaseFont: 'UnicodeTestFont', CIDSystemInfo: { Registry: PDFString.of('Adobe'), Ordering: PDFString.of('Identity'), Supplement: 0 }, FontDescriptor: descriptor, DW: 500, CIDToGIDMap: 'Identity' }))
  const font = pdf.context.register(pdf.context.obj({ Type: 'Font', Subtype: 'Type0', BaseFont: 'UnicodeTestFont', Encoding: 'Identity-H', DescendantFonts: [cid], ToUnicode: cmap }))
  page.node.set(PDFName.of('Resources'), pdf.context.obj({ Font: { UnicodeTest: font } }))
  page.node.addContentStream(pdf.context.register(pdf.context.flateStream(`BT /UnicodeTest 14 Tf 20 350 Td <${words.map((_, index) => (index + 1).toString(16).padStart(4, '0')).join('')}> Tj ET`)))
  pdf.addPage([400, 400])
  const columns = pdf.addPage([400, 400]), standard = await pdf.embedFont(StandardFonts.Helvetica)
  columns.drawText('Right column stored first', { x: 200, y: 350, font: standard, size: 12 })
  columns.drawText('Left column stored second', { x: 20, y: 350, font: standard, size: 12 })
  columns.drawText('<script>alert(1)</script>', { x: 20, y: 300, font: standard, size: 12 })
  const scanned = await PDFDocument.load(await readFile('../fixtures/pdf/F-008-scan-like.pdf'))
  for (const item of await pdf.copyPages(scanned, [0])) pdf.addPage(item)
  return Buffer.from(await pdf.save())
}
async function choose(page: Page, buffer?: Buffer, name = 'paper.pdf') {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: 'application/pdf', buffer: buffer ?? await mixedPdf() })
  await expect(page.locator('.file-row .file-name')).toHaveText(name)
}
async function convert(page: Page) {
  await page.getByRole('button', { name: 'Export text', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Text extraction report', exact: true })).toBeVisible()
}
async function download(page: Page) {
  const waiting = page.waitForEvent('download'); await page.getByRole('button', { name: /^Download .*\.txt/ }).click()
  const result = await waiting
  return { name: result.suggestedFilename(), bytes: await readFile((await result.path())!) }
}
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route('**/*', route => { const url = new URL(route.request().url()); if (url.hostname !== '127.0.0.1' && !['blob:', 'data:'].includes(url.protocol)) throw new Error(`Unexpected external request: ${url.origin}`); return route.continue() })
})

test('Unicode, column order, missing pages and UTF-8 download match the visible report', async ({ page }, info) => {
  await page.goto('pdf-to-text/'); await choose(page); await convert(page)
  await expect(page.getByText('2 of 4 pages contain text.', { exact: true })).toBeVisible()
  await page.getByText('Pages without text', { exact: true }).click(); await expect(page.locator('.text-missing-pages')).toHaveText('2, 4')
  await page.getByText('Preview extracted text', { exact: true }).click()
  await expect(page.locator('.text-export-preview')).toContainText(unicodeText)
  await expect(page.locator('.text-export-preview')).toContainText('<script>alert(1)</script>')
  await expect(page.locator('.text-export-preview script')).toHaveCount(0)
  const result = await download(page), text = new TextDecoder('utf-8', { fatal: true }).decode(result.bytes), parts = text.split('\f')
  expect(result.name).toBe('paper.txt'); expect(parts).toHaveLength(4)
  expect(parts[0]).toBe(unicodeText); expect(parts[1]).toBe(''); expect(parts[3]).toBe('')
  expect(parts[2].indexOf('Right column')).toBeLessThan(parts[2].indexOf('Left column'))
  const fit = await page.locator('.result-row button, .text-export-preview').evaluateAll(items => items.every(item => { const rect = item.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth }))
  expect(fit).toBe(true)
  if (process.env.PDF_TOOLS_VISUAL_DIR) await page.screenshot({ path: `${process.env.PDF_TOOLS_VISUAL_DIR}/text-export-${info.project.name}.png`, fullPage: true })
})

test('scan-only PDFs produce an OCR notice without a blank file; invalid sources recover', async ({ page }) => {
  await page.goto('pdf-to-text/'); await choose(page, await readFile('../fixtures/pdf/F-008-scan-like.pdf'), 'scan.pdf')
  await page.getByRole('button', { name: 'Export text', exact: true }).click()
  await expect(page.getByRole('status', { name: 'OCR needed' })).toContainText('No text layer found')
  await expect(page.getByRole('button', { name: /^Download/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose another PDF', exact: true }).click()
  await choose(page, await readFile('../fixtures/pdf/F-010-encrypted-aes256.pdf'), 'encrypted.pdf')
  await expect(page.getByRole('alert')).toContainText('password-protected')
  await expect(page.getByRole('button', { name: 'Export text', exact: true })).toBeDisabled()
  await choose(page, Buffer.from('%PDF-broken'), 'broken.pdf')
  await page.getByRole('button', { name: 'Export text', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('could not be read')
  await page.getByRole('button', { name: 'Try again', exact: true }).click(); await choose(page); await convert(page)
})

test('download URLs are reused, revoked on retry/reset/exit and long text preview is bounded', async ({ page }) => {
  await page.addInitScript(() => {
    const live = new Set<string>(), create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = blob => { const url = create(blob); if (blob instanceof Blob && blob.type.startsWith('text/plain')) live.add(url); return url }
    URL.revokeObjectURL = url => { live.delete(url); revoke(url) }; Object.assign(window, { textUrls: live })
  })
  const count = () => page.evaluate(() => (window as unknown as { textUrls: Set<string> }).textUrls.size)
  await page.goto('pdf-to-text/'); await choose(page, await readFile('../fixtures/pdf/F-002-plain-text-30p.pdf'), 'long.pdf'); await convert(page)
  await page.getByText('Preview extracted text (first 8,000 characters)', { exact: true }).click()
  expect((await page.locator('.text-export-preview').textContent())!.length).toBeLessThan(8400)
  const text = new TextDecoder().decode((await download(page)).bytes); expect(text).toContain('PACKING-BOX-0030')
  await download(page); expect(await count()).toBe(1)
  await page.getByRole('button', { name: 'Run again with other files', exact: true }).click(); expect(await count()).toBe(0)
  await convert(page); await download(page); await page.getByRole('button', { name: 'Start over', exact: true }).click(); expect(await count()).toBe(0)
  await choose(page); await convert(page); await download(page)
  await page.getByRole('button', { name: 'Continue to another tool', exact: true }).click(); expect(await count()).toBe(0)
})

for (const action of ['GetDocRequest', 'GetTextContent']) test(`cancelling pending ${action} terminates loading/text work and discards late output`, async ({ page }) => {
  await page.addInitScript(action => {
    const send = Worker.prototype.postMessage
    const gate = { hold: false, pending: [] as (() => void)[], terminated: 0 }
    const terminate = Worker.prototype.terminate
    Worker.prototype.terminate = function() { gate.terminated++; terminate.call(this) }
    Object.assign(window, { textWorkerGate: gate })
    Worker.prototype.postMessage = function(message: unknown, transfer?: Transferable[] | StructuredSerializeOptions) {
      const forward = () => { Reflect.apply(send, this, [message, transfer]) }
      if (gate.hold && (message as { action?: string })?.action === action) gate.pending.push(forward)
      else forward()
    }
  }, action)
  await page.goto('pdf-to-text/'); await choose(page)
  await page.evaluate(() => { (window as unknown as { textWorkerGate: { hold: boolean } }).textWorkerGate.hold = true })
  await page.getByRole('button', { name: 'Export text', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { textWorkerGate: { pending: unknown[] } }).textWorkerGate.pending.length)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { textWorkerGate: { terminated: number } }).textWorkerGate.terminated)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Adjust settings', exact: true }).click()
  await expect(page.locator('.file-row .file-name')).toHaveText('paper.pdf')
  await page.evaluate(() => { const gate = (window as unknown as { textWorkerGate: { hold: boolean; pending: (() => void)[] } }).textWorkerGate; gate.hold = false; gate.pending.splice(0).forEach(send => send()) })
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toHaveCount(0)
  await convert(page)
  expect(new TextDecoder().decode((await download(page)).bytes)).toContain('Right column stored first')
})
