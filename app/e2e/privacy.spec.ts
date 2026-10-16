import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, PDFDict, PDFName, StandardFonts } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { TOOLS } from '../src/registry'
import { png } from '../src/__tests__/imageFixtures'
import { installPrivacyAudit } from './helpers/privacyAudit'

const NAME = 'PRIVATE_FILE_72841', TEXT = 'PRIVATE_TEXT_72841', META = 'PRIVATE_META_72841'
async function documentBytes(unusualFont = false) {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.setTitle(META); pdf.setAuthor(META)
  for (let i = 0; i < 2; i++) pdf.addPage([240, 320]).drawText(`${TEXT} page ${i + 1}`, { x: 10, y: 260, size: 10, font })
  if (unusualFont) { await pdf.flush(); pdf.context.lookup(font.ref, PDFDict).set(PDFName.of('BaseFont'), PDFName.of(META)) }
  return Buffer.from(await pdf.save())
}
async function select(page: Page, route: string) {
  const image = route === 'images-to-pdf'
  const payload = { name: `${NAME}.${image ? 'png' : 'pdf'}`, mimeType: image ? 'image/png' : 'application/pdf', buffer: image ? Buffer.from(png()) : await documentBytes() }
  await page.locator('input[type=file]').setInputFiles(route === 'merge' ? [payload, { ...payload, name: `${NAME}_2.pdf` }] : payload)
  await expect(page.locator('.file-row')).toHaveCount(route === 'merge' ? 2 : 1)
}
async function run(page: Page, route: string) {
  if (route === 'reader') {
    await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeEnabled()
    await page.getByLabel('Search this PDF', { exact: true }).fill(TEXT)
    await expect(page.getByRole('status', { name: 'Search results' })).toContainText('of 2 matches')
    await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open print dialog', exact: true })).toBeVisible()
    return
  }
  if (route === 'doc-info') {
    await page.getByRole('button', { name: 'Inspect PDF', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Document metadata', exact: true })).toContainText(META)
    return
  }
  if (route === 'organize' || route === 'rotate') {
    await expect(page.getByRole('button', { name: 'Output page 1, source page 1', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Rotate right at position 1', exact: true }).click()
  }
  if (route === 'extract-pages' || route === 'delete-pages') {
    await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toBeVisible()
    await page.getByLabel(route === 'extract-pages' ? 'Pages to extract' : 'Pages to remove', { exact: true }).fill('1')
    if (route === 'delete-pages') await page.locator('.page-delete-confirmation input').check()
  }
  if (route === 'split') await page.getByLabel('Ranges (comma separated)', { exact: true }).fill('1, 2')
  if (route === 'watermark') await page.getByLabel('Watermark text', { exact: true }).fill(TEXT)
  if (route === 'watermark' || route === 'page-numbers') await expect(page.getByText('Preview ready', { exact: true })).toBeVisible()
  const actions: Record<string, string> = { merge: 'Merge PDFs', split: 'Split PDF', rotate: 'Create rotated copy', organize: 'Create organized copy',
    'extract-pages': 'Extract pages', 'delete-pages': 'Create copy without selected pages', 'images-to-pdf': 'Create PDF',
    'pdf-to-jpg': 'Create images', 'pdf-to-png': 'Create images', 'pdf-to-text': 'Export text', 'page-numbers': 'Apply page numbers', watermark: 'Apply watermark' }
  await expect(page.getByRole('button', { name: actions[route], exact: true })).toBeEnabled()
  await page.getByRole('button', { name: actions[route], exact: true }).click()
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toBeVisible()
  const waiting = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Download / }).first().click()
  const download = await waiting
  expect((await readFile((await download.path())!)).length).toBeGreaterThan(0)
}

for (const tool of TOOLS.filter(tool => tool.implemented)) test(`privacy lifecycle: ${tool.id}`, async ({ page, context }) => {
  test.setTimeout(90_000)
  const route = tool.route.slice(1), audit = await installPrivacyAudit(page, context, route)
  await page.goto(`${route}/`)
  const baseline = await audit.snapshot()
  await select(page, route)
  await run(page, route)
  await audit.assertPrivate(baseline)
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  await audit.assertClean()
  await expect(page.locator('body')).not.toContainText(NAME)
  await expect(page.locator('body')).not.toContainText(TEXT)
  await expect(page.locator('body')).not.toContainText(META)
  await select(page, route)
  await page.getByRole('button', { name: 'Clear files', exact: true }).click()
  await audit.assertClean()
  await audit.assertPrivate(baseline)
  await select(page, route)
  await page.locator('.folio-header').getByRole('link', { name: 'All tools', exact: true }).click()
  await audit.assertClean()
  await expect(page.locator('body')).not.toContainText(NAME)
  await page.goBack()
  await audit.assertClean()
  // Back uses the router's non-document state. Reload must also have no saved source/output.
  await page.reload()
  await audit.assertClean()
  expect(await audit.snapshot()).toEqual(baseline)
  expect(audit.requests.length).toBeGreaterThan(0)
})

test('failed, locked and unusual-font documents do not leak parser diagnostics or persist data', async ({ page, context }) => {
  const audit = await installPrivacyAudit(page, context, 'reader')
  await page.goto('reader/')
  const baseline = await audit.snapshot()
  for (const buffer of [Buffer.from(`%PDF-${META}-malformed`), await readFile('../fixtures/pdf/F-010-encrypted-aes256.pdf')]) {
    await page.locator('input[type=file]').setInputFiles({ name: `${NAME}.pdf`, mimeType: 'application/pdf', buffer })
    await expect(page.getByText(/could not be read|password-protected/).first()).toBeVisible()
    await audit.assertPrivate(baseline)
    await page.getByRole('button', { name: 'Start over', exact: true }).click()
    await audit.assertClean()
  }
  await page.locator('input[type=file]').setInputFiles({ name: `${NAME}.pdf`, mimeType: 'application/pdf', buffer: await documentBytes(true) })
  await expect(page.locator('.textLayer')).toContainText(TEXT)
  await audit.assertPrivate(baseline)
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  await audit.assertClean()
})

test('cancelled text extraction terminates workers and cannot expose held late output', async ({ page, context }) => {
  const audit = await installPrivacyAudit(page, context, 'pdf-to-text')
  await page.addInitScript(() => {
    const send = Worker.prototype.postMessage
    const gate = { pending: [] as (() => void)[] }
    Object.assign(window, { privacyGate: gate })
    Worker.prototype.postMessage = function(message: unknown, transfer?: Transferable[] | StructuredSerializeOptions) {
      const forward = () => Reflect.apply(send, this, [message, transfer])
      if ((message as { action?: string })?.action === 'GetTextContent') gate.pending.push(forward)
      else forward()
    }
  })
  await page.goto('pdf-to-text/')
  const baseline = await audit.snapshot()
  await select(page, 'pdf-to-text')
  await page.getByRole('button', { name: 'Export text', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { privacyGate: { pending: unknown[] } }).privacyGate.pending.length)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Cancelled' })).toBeVisible()
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  await audit.assertClean()
  await page.evaluate(() => { (window as unknown as { privacyGate: { pending: (() => void)[] } }).privacyGate.pending.splice(0).forEach(send => send()) })
  await audit.assertClean()
  await audit.assertPrivate(baseline)
})
