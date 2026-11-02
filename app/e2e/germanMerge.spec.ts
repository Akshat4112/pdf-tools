import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const origin = 'http://127.0.0.1:4178'
const canonical = 'https://akshat4112.github.io/pdf-tools/de/merge/'

async function syntheticPdf(marker: string): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.addPage([310, 410]).drawText(marker, { x: 20, y: 370, size: 12, font })
  return Buffer.from(await pdf.save())
}

async function selectPdfs(page: Page): Promise<void> {
  await page.locator('input[type=file]').setInputFiles([
    { name: 'de-canary-A.pdf', mimeType: 'application/pdf', buffer: await syntheticPdf('PT_DE_A_PRIVATE') },
    { name: 'de-canary-B.pdf', mimeType: 'application/pdf', buffer: await syntheticPdf('PT_DE_B_PRIVATE') },
  ])
  await expect(page.locator('.file-row')).toHaveCount(2)
}

test('German Merge: direct/static/no-JS content has the exact approved language pair', async ({ page, request, browser }) => {
  const response = await request.get('de/merge/')
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('<html lang="de">')
  expect(html).toContain(`rel="canonical" href="${canonical}"`)
  expect(html).toContain('hreflang="en" href="https://akshat4112.github.io/pdf-tools/merge/"')
  expect(html).not.toContain('id="public-structured-data"')
  for (const phrase of ['50 MiB', '300 Seiten', 'Originale', 'digitale Signaturen', 'JavaScript']) expect(html.toLowerCase()).toContain(phrase.toLowerCase())
  await page.goto('de/merge/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PDF zusammenfügen')
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', canonical)
  await expect(page.getByRole('button', { name: 'Dateien auswählen', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PDFs zusammenfügen', exact: true })).toBeDisabled()
  await expect(page.locator('.fl-footer-logo')).toHaveAttribute('href', '/pdf-tools/de/')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Sprache', exact: true })).toHaveValue('de')
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const staticPage = await context.newPage()
    await staticPage.goto(`${origin}/pdf-tools/de/merge/`)
    await expect(staticPage.getByRole('heading', { level: 1 })).toHaveText('PDF-Dateien zusammenfügen')
    await expect(staticPage.getByRole('main')).toContainText('Aktiviere JavaScript')
    await expect(staticPage.getByRole('contentinfo').getByRole('link', { name: 'PDFs zusammenfügen', exact: true })).toHaveAttribute('href', '/pdf-tools/de/merge/')
    await expect(staticPage.getByRole('contentinfo').getByRole('link', { name: 'Datenschutzhinweise (Englisch)', exact: true })).toHaveAttribute('href', '/pdf-tools/privacy/')
  } finally { await context.close() }
})

test('German Merge: reordered download survives locale/history switches and reset stays local', async ({ page }) => {
  test.setTimeout(90_000)
  const unexpected: string[] = []
  page.on('request', request => {
    if (!request.url().startsWith('http')) return
    if (new URL(request.url()).origin !== origin || request.method() !== 'GET' || /de-canary|PT_DE_[AB]_PRIVATE/.test(request.url() + (request.postData() ?? ''))) unexpected.push(request.url())
  })
  await page.goto('de/merge/')
  await selectPdfs(page)
  await page.getByRole('button', { name: 'Nach oben verschieben: de-canary-B.pdf', exact: true }).click()
  const order = ['de-canary-B.pdf', 'de-canary-A.pdf']
  await expect(page.locator('.file-row .file-name')).toHaveText(order)
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en')
  await expect(page).toHaveURL(/\/pdf-tools\/merge\/$/)
  await expect(page.locator('.file-row .file-name')).toHaveText(order)
  await page.goBack()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('.file-row .file-name')).toHaveText(order)
  await page.goForward()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('de')
  await page.getByRole('button', { name: 'PDFs zusammenfügen', exact: true }).click()
  const results = page.getByRole('region', { name: 'Ergebnisse', exact: true })
  await expect(results).toBeVisible()
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en')
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('de')
  await expect(results).toBeVisible()
  const receiving = page.waitForEvent('download')
  await results.getByRole('button', { name: /^Herunterladen / }).click()
  const path = (await (await receiving).path())!
  execFileSync('qpdf', ['--check', path], { stdio: 'pipe' })
  expect(execFileSync('qpdf', ['--show-npages', path], { encoding: 'utf8' }).trim()).toBe('2')
  // Independent qpdf readback of the synthetic page streams verifies B → A.
  const pages = execFileSync('qpdf', ['--show-pages', path], { encoding: 'utf8' })
  const contentIds = [...pages.matchAll(/page \d+: \d+ \d+ R\s+content:\s+(\d+) \d+ R/g)].map(match => match[1])
  expect(contentIds).toHaveLength(2)
  for (const [index, marker] of ['PT_DE_B_PRIVATE', 'PT_DE_A_PRIVATE'].entries()) {
    const stream = execFileSync('qpdf', [`--show-object=${contentIds[index]}`, '--filtered-stream-data', path], { encoding: 'utf8' })
    expect(stream.toLowerCase()).toContain(Buffer.from(marker).toString('hex'))
  }
  expect(await page.locator('head').innerHTML()).not.toMatch(/de-canary|PT_DE_[AB]_PRIVATE/)
  await results.getByRole('button', { name: 'Neu beginnen', exact: true }).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  await expect(results).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  expect(unexpected).toEqual([])
  await page.getByRole('button', { name: 'Zurück', exact: true }).click()
  await expect(page).toHaveURL(/\/pdf-tools\/de\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})

test('German Merge: malformed input has translated recovery and no download', async ({ page }) => {
  await page.goto('de/merge/')
  await selectPdfs(page)
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nnot a PDF body\n%%EOF') })
  await page.getByRole('button', { name: 'PDFs zusammenfügen', exact: true }).click()
  const failure = page.getByRole('alert', { name: 'Etwas ist schiefgelaufen', exact: true })
  await expect(failure).toContainText('Die Verarbeitung wurde unerwartet beendet.')
  await expect(failure).toContainText('Für diesen Versuch ist kein Download verfügbar.')
  await expect(page.locator('.btn-download')).toHaveCount(0)
  await failure.getByRole('button', { name: 'Einstellungen überprüfen', exact: true }).click()
  await page.getByRole('button', { name: 'Diese Datei entfernen: broken.pdf', exact: true }).click()
  await expect(page.locator('.file-row')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'PDFs zusammenfügen', exact: true })).toBeEnabled()
})

test('German Merge: cancellation preserves files through a language switch and discards late work', async ({ page }) => {
  await page.goto('de/merge/')
  await selectPdfs(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let blocked = 0
  await page.route('**/assets/pdf.worker.min.mjs', async route => { blocked++; await gate; await route.continue() })
  try {
    await page.getByRole('button', { name: 'PDFs zusammenfügen', exact: true }).click()
    await expect.poll(() => blocked).toBeGreaterThan(0)
    await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en')
    await expect(page.getByRole('region', { name: 'Processing', exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('de')
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Abgebrochen', exact: true })).toContainText('Es steht kein Teilergebnis')
  } finally { release() }
  await page.unrouteAll({ behavior: 'wait' })
  await page.getByRole('button', { name: 'Einstellungen anpassen', exact: true }).click()
  await expect(page.locator('.file-row')).toHaveCount(2)
  await expect(page.locator('.btn-download')).toHaveCount(0)
})

test('German Merge: a failed guidance chunk leaves the workspace usable', async ({ page }) => {
  const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))
  await page.route(`**/${manifest['src/components/GermanMergeGuide.tsx'].file}`, route => route.abort('failed'))
  await page.goto('de/merge/')
  await expect(page.getByRole('alert')).toContainText('Das Werkzeug bleibt verfügbar.')
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Anleitung neu laden', exact: true })).toHaveCount(0)
  await selectPdfs(page)
  await expect(page.getByRole('button', { name: 'PDFs zusammenfügen', exact: true })).toBeEnabled()
})
