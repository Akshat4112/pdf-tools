import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts, degrees, PDFName, PDFString } from 'pdf-lib'

async function demo() {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 3; i++) {
    const page = pdf.addPage([300, 400])
    page.drawText(`Local reader page ${i + 1}: banana ${i === 1 ? 'BANANA' : 'banana'}`, { x: 20, y: 300, size: 14, font })
    if (i === 1) page.setRotation(degrees(90))
  }
  pdf.catalog.set(PDFName.of('OpenAction'), pdf.context.obj({ S: 'JavaScript', JS: PDFString.of('window.readerScriptRan=true;') }))
  return Buffer.from(await pdf.save())
}
async function choose(page: Page, buffer: Buffer, name = 'local.pdf') {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: 'application/pdf', buffer })
  await expect(page.locator('.file-row .file-name')).toHaveText(name)
  await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeEnabled()
  await expect.poll(() => page.locator('.reader-viewport canvas').count()).toBeGreaterThan(0)
  await expect(page.getByRole('status', { name: 'Page text status' })).not.toHaveText('Checking page text…')
}
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1' && !['blob:', 'data:', 'about:'].includes(url.protocol)) throw new Error(`External request: ${url.origin}`)
    return route.continue()
  })
})

test('print guards memory and cancellation discards delayed renders while retaining the source', async ({ page }) => {
  await page.addInitScript(() => {
    const schedule = requestAnimationFrame.bind(window)
    const state = { hold: false, waiting: [] as FrameRequestCallback[] }
    Object.assign(window, { readerRenderGate: state })
    window.requestAnimationFrame = callback => {
      if (state.hold && document.querySelector('.reader-print-frame')) { state.waiting.push(callback); return -1 }
      return schedule(callback)
    }
  })
  await page.goto('reader/'); await choose(page, await demo())
  await page.evaluate(() => { (window as unknown as { readerRenderGate: { hold: boolean } }).readerRenderGate.hold = true })
  await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { readerRenderGate: { waiting: unknown[] } }).readerRenderGate.waiting.length)).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Cancel print preparation', exact: true }).click()
  await page.evaluate(() => {
    const gate = (window as unknown as { readerRenderGate: { hold: boolean; waiting: FrameRequestCallback[] } }).readerRenderGate
    gate.hold = false; gate.waiting.splice(0).forEach(callback => requestAnimationFrame(callback))
  })
  await expect(page.locator('.reader-print-frame')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open print dialog', exact: true })).toHaveCount(0)
  await expect(page.locator('.file-row .file-name')).toHaveText('local.pdf')
  await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open print dialog', exact: true })).toBeVisible()
  const oversized = await PDFDocument.create(); oversized.addPage([3001, 3001])
  await choose(page, Buffer.from(await oversized.save()), 'huge-page.pdf')
  await expect(page.locator('.reader-print-frame')).toHaveCount(0)
  await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Print status' })).toContainText('64 MB print pixel budget')
  await expect(page.locator('.reader-print-frame')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Prepare print pages', exact: true })).toBeEnabled()
})

test('print prepares actual ordered rotated pages, opens the browser dialog and clears raster copies', async ({ page }) => {
  await page.goto('reader/'); await choose(page, await demo())
  await page.getByLabel('Pages to print', { exact: true }).fill('3, 2, 1, 3')
  await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open print dialog', exact: true })).toBeVisible()
  const prepared = await page.locator('.reader-print-frame').evaluate(element => {
    const frame = element as HTMLIFrameElement
    return Array.from(frame.contentDocument!.querySelectorAll('section')).map(section => {
      const canvas = section.querySelector('canvas')!
      return { page: section.dataset.sourcePage, width: canvas.width, height: canvas.height,
        ink: canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 !== 3 && value < 240) }
    })
  })
  expect(prepared).toEqual([{ page: '3', width: 400, height: 534, ink: true }, { page: '2', width: 534, height: 400, ink: true }, { page: '1', width: 400, height: 534, ink: true }])
  await page.locator('.reader-print-frame').evaluate(element => {
    const frame = element as HTMLIFrameElement
    frame.contentWindow!.print = () => { Object.assign(parent, { printDialogCalled: true }) }
  })
  await page.getByRole('button', { name: 'Open print dialog', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { printDialogCalled?: boolean }).printDialogCalled)).toBe(true)
  expect(await page.locator('.reader-print-frame').getAttribute('sandbox')).toBe('allow-same-origin allow-modals')
  await page.getByRole('button', { name: 'Clear print copy', exact: true }).click()
  await expect(page.locator('.reader-print-frame')).toHaveCount(0)
  await page.getByLabel('Pages to print', { exact: true }).fill('9')
  await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Print status' })).toContainText(/page|range/i)
  await expect(page.getByRole('button', { name: 'Open print dialog', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Use current page', exact: true }).click()
  await expect(page.getByLabel('Pages to print', { exact: true })).toHaveValue('1')
  await page.getByRole('button', { name: 'Prepare print pages', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open print dialog', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start over', exact: true }).click()
  await expect(page.locator('.reader-print-frame')).toHaveCount(0)
  await expect(page.locator('.reader-viewport')).toHaveCount(0)
})

test('launch corpus opens with text/scan honesty, password and malformed recovery, replacement resets state', async ({ page }) => {
  await page.goto('reader/')
  const corpus = ['F-001-plain-text-3p', 'F-002-plain-text-30p', 'F-003-mixed-sizes', 'F-004-rotated-pages', 'F-005-form-acroform', 'F-006-annotations', 'F-007-image-page', 'F-008-scan-like', 'F-009-signed-marker', 'F-014-outline', 'F-015-pages-60p']
  for (const name of corpus) {
    await page.locator('input[type="file"]').setInputFiles(`../fixtures/pdf/${name}.pdf`)
    await expect(page.locator('.file-row .file-name')).toHaveText(`${name}.pdf`)
    await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeEnabled()
    await expect.poll(() => page.locator('.reader-viewport canvas').count()).toBeGreaterThan(0)
    await expect(page.getByRole('status', { name: 'Page text status' })).not.toHaveText('Checking page text…')
    if (name === 'F-015-pages-60p') {
      await page.getByLabel('Search this PDF', { exact: true }).fill('PACKING-BOX')
      await expect(page.getByRole('status', { name: 'Search results' })).toContainText('of 60 matches')
      await expect(page.getByRole('group', { name: 'Search match list' }).getByRole('button', { name: /Page/ })).toHaveCount(20)
      await page.getByRole('button', { name: 'Next results', exact: true }).click()
      await page.getByRole('button', { name: 'Page 21, match 1: PACKING-BOX', exact: true }).click()
      await expect(page.getByLabel('Page', { exact: true })).toHaveValue('21')
      await page.getByRole('button', { name: 'Next match', exact: true }).click()
      await expect(page.getByRole('status', { name: 'Search results' })).toContainText('22 of 60 matches')
    }
    if (name === 'F-008-scan-like') await expect(page.getByRole('status', { name: 'Page text status' })).toContainText('need OCR')
  }
  await page.locator('input[type="file"]').setInputFiles('../fixtures/pdf/F-010-encrypted-aes256.pdf')
  await expect(page.getByRole('alert')).toContainText('password-protected')
  await page.locator('input[type="file"]').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-broken') })
  await expect(page.getByRole('alert')).toContainText('could not be read')
  await choose(page, await demo(), 'replacement.pdf')
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('1')
  await expect(page.getByRole('combobox', { name: 'Zoom', exact: true })).toHaveValue('page-width')
  await expect(page.getByLabel('Search this PDF', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('2')
  await page.getByRole('button', { name: 'Back to all tools', exact: true }).click()
  await expect(page.locator('.reader-viewport')).toHaveCount(0)
})

test('reader navigates, zooms, searches, selects text and retains rotated geometry', async ({ page }, info) => {
  await page.goto('reader/'); await choose(page, await demo())
  await expect(page.locator('.textLayer')).toContainText('Local reader page 1')
  const copied = await page.locator('.textLayer').evaluate(layer => {
    const range = document.createRange(); range.selectNodeContents(layer)
    const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range)
    return selection.toString()
  })
  expect(copied).toContain('banana')
  await page.getByLabel('Search this PDF', { exact: true }).fill('banana')
  await expect(page.getByRole('status', { name: 'Search results' })).toContainText('of 6 matches')
  await expect(page.getByRole('group', { name: 'Search match list' }).getByRole('button', { name: /Page/ })).toHaveCount(6)
  await page.getByRole('button', { name: 'Page 2, match 2: banana', exact: true }).click()
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('2')
  await expect(page.getByRole('status', { name: 'Search results' })).toContainText('4 of 6 matches')
  await page.getByRole('button', { name: 'Next match', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Search results' })).toContainText('5 of 6 matches')
  await page.getByRole('button', { name: 'Page 1, match 1: banana', exact: true }).click()
  await page.getByRole('button', { name: 'Previous match', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Search results' })).toContainText('6 of 6 matches · Wrapped around')
  await page.getByRole('button', { name: 'Next match', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Search results' })).toContainText('1 of 6 matches')
  await page.getByRole('region', { name: 'PDF pages', exact: true }).focus()
  await page.keyboard.press('Control+f')
  await expect(page.getByLabel('Search this PDF', { exact: true })).toBeFocused()
  await page.getByLabel('Match case', { exact: true }).check()
  await expect(page.getByRole('status', { name: 'Search results' })).toContainText('of 5 matches')
  await page.getByLabel('Search this PDF', { exact: true }).fill('page 3')
  await expect(page.getByRole('status', { name: 'Search results' })).toContainText('1 of 1 matches')
  await expect(page.getByLabel('Page', { exact: true })).toHaveValue('3')
  await expect(page.locator('.textLayer .highlight.selected')).toBeVisible()
  await page.getByLabel('Search this PDF', { exact: true }).fill('absent-word')
  await expect(page.getByRole('status', { name: 'Search results' })).toContainText('No matches')
  await page.getByLabel('Page', { exact: true }).fill('99'); await page.getByRole('button', { name: 'Go', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Choose a page from 1 to 3.')
  await page.getByLabel('Page', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Go', exact: true }).click()
  await page.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('1')
  // Zoom describes document content; PDF.js adds its decorative page border outside it.
  await expect.poll(() => page.locator('.reader-viewport .page .canvasWrapper').evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(533, -1)
  await page.getByRole('combobox', { name: 'Zoom', exact: true }).selectOption('page-fit')
  await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => (window as unknown as { readerScriptRan?: boolean }).readerScriptRan)).toBeUndefined()
  const fits = await page.locator('.reader-toolbar button, .reader-toolbar input, .reader-search input, .reader-search button').evaluateAll(elements => elements.every(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth }))
  expect(fits).toBe(true)
  if (process.env.PDF_TOOLS_VISUAL_DIR) await page.screenshot({ path: `${process.env.PDF_TOOLS_VISUAL_DIR}/reader-${info.project.name}.png`, fullPage: true })
})
