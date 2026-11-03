import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const origin = 'http://127.0.0.1:4178'
const site = 'https://akshat4112.github.io/pdf-tools/'
const sourceName = 'de-split-canary.pdf'

async function syntheticPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let page = 1; page <= 5; page++) doc.addPage([310, 410]).drawText(`PT_DE_SPLIT_${page}_PRIVATE`, { x: 20, y: 370, size: 12, font })
  return Buffer.from(await doc.save())
}

async function selectPdf(page: Page): Promise<void> {
  await page.locator('input[type=file]').setInputFiles({ name: sourceName, mimeType: 'application/pdf', buffer: await syntheticPdf() })
  await expect(page.locator('.file-row .file-name')).toHaveText(sourceName)
}

async function configureRanges(page: Page, expression = '5, 1-2, 2'): Promise<void> {
  await page.goto('de/split/')
  await selectPdf(page)
  await page.getByRole('textbox', { name: 'Seitenbereiche (kommagetrennt)', exact: true }).fill(expression)
  await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeEnabled()
}

/** Read the downloaded archive and each PDF through independent native tools. */
async function verifyDownload(page: Page, groups: readonly (readonly number[])[]): Promise<void> {
  const results = page.getByRole('region', { name: 'Ergebnisse', exact: true })
  await expect(results).toBeVisible()
  const receiving = page.waitForEvent('download')
  await results.getByRole('button', { name: /^Herunterladen / }).click()
  const download = await receiving
  expect(download.suggestedFilename()).toBe('de-split-canary-split.zip')
  const archive = (await download.path())!
  const names = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n')
  expect(names).toEqual(groups.map((_, index) => `de-split-canary-${index + 1}.pdf`))
  const directory = mkdtempSync(join(tmpdir(), 'pt-de-split-'))
  try {
    for (const [index, group] of groups.entries()) {
      const path = join(directory, `${index}.pdf`)
      writeFileSync(path, execFileSync('unzip', ['-p', archive, names[index]]))
      execFileSync('qpdf', ['--check', path], { stdio: 'pipe' })
      expect(execFileSync('qpdf', ['--show-npages', path], { encoding: 'utf8' }).trim()).toBe(String(group.length))
      const pages = execFileSync('qpdf', ['--show-pages', path], { encoding: 'utf8' })
      const ids = [...pages.matchAll(/page \d+: \d+ \d+ R\s+content:\s+(\d+) \d+ R/g)].map(match => match[1])
      expect(ids).toHaveLength(group.length)
      for (const [pageIndex, sourcePage] of group.entries()) {
        const stream = execFileSync('qpdf', [`--show-object=${ids[pageIndex]}`, '--filtered-stream-data', path], { encoding: 'utf8' })
        expect(stream.toLowerCase()).toContain(Buffer.from(`PT_DE_SPLIT_${sourcePage}_PRIVATE`).toString('hex'))
      }
    }
  } finally { rmSync(directory, { recursive: true, force: true }) }
}

test('German Split: direct/static/no-JS page has reciprocal metadata and localized navigation', async ({ page, request, browser }) => {
  for (const path of ['split/', 'de/split/']) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain(`rel="canonical" href="${site}${path}"`)
    for (const [language, suffix] of [['en', 'split/'], ['de', 'de/split/'], ['x-default', 'split/']]) expect(html).toContain(`hreflang="${language}" href="${site}${suffix}"`)
  }
  await page.goto('de/split/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('PDF teilen')
  await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeDisabled()
  await expect(page.locator('#public-structured-data')).toHaveCount(0)
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'PDF teilen', exact: true })).toHaveAttribute('href', '/pdf-tools/de/split/')
  await expect(page.getByRole('link', { name: 'PDF-Seiten extrahieren (Englisch)', exact: true })).toHaveAttribute('href', '/pdf-tools/extract-pages/')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Sprache', exact: true })).toHaveValue('de')
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const staticPage = await context.newPage()
    await staticPage.goto(`${origin}/pdf-tools/de/split/`)
    await expect(staticPage.getByRole('heading', { level: 1 })).toHaveText('PDF in mehrere Dateien aufteilen')
    await expect(staticPage.getByRole('main')).toContainText('Aktiviere JavaScript')
    for (const text of ['50 MiB', '300 Seiten', 'ZIP-Datei', 'überschneiden', 'Digitale Signaturen']) await expect(staticPage.getByRole('main')).toContainText(text)
    await expect(staticPage.getByRole('contentinfo').getByRole('link', { name: 'PDF teilen', exact: true })).toHaveAttribute('href', '/pdf-tools/de/split/')
  } finally { await context.close() }
})

test('German Split: custom range ZIP preserves overlap/order through locale/history, results and reset', async ({ page }) => {
  test.setTimeout(90_000)
  const unexpected: string[] = []
  page.on('request', request => {
    if (!request.url().startsWith('http')) return
    if (new URL(request.url()).origin !== origin || request.method() !== 'GET' || /de-split-canary|PT_DE_SPLIT_/.test(request.url() + (request.postData() ?? ''))) unexpected.push(request.url())
  })
  await configureRanges(page)
  await expect(page.getByRole('region', { name: 'Vorschau', exact: true })).toContainText('Teile: 5, 1–2, 2')
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en')
  await expect(page).toHaveURL(/\/pdf-tools\/split\/$/)
  await expect(page.getByRole('textbox', { name: 'Ranges (comma separated)', exact: true })).toHaveValue('5, 1-2, 2')
  await page.goBack()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.goForward()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('de')
  await expect(page.locator('.file-row .file-name')).toHaveText(sourceName)
  await page.getByRole('button', { name: 'PDF teilen', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Ergebnisse', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en')
  await expect(page.getByRole('region', { name: 'Results', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('de')
  await verifyDownload(page, [[5], [1, 2], [2]])
  expect(await page.locator('head').innerHTML()).not.toMatch(/de-split-canary|PT_DE_SPLIT_/)
  await page.getByRole('button', { name: 'Neu beginnen', exact: true }).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  await expect(page.locator('.btn-download')).toHaveCount(0)
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []])
  expect(unexpected).toEqual([])
  await page.getByRole('button', { name: 'Zurück', exact: true }).click()
  await expect(page).toHaveURL(/\/pdf-tools\/de\/$/)
})

for (const mode of ['every', 'single'] as const) test(`German Split: ${mode} downloads independently verified complete page groups`, async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('de/split/')
  await selectPdf(page)
  await page.getByRole('radio', { name: mode === 'every' ? /Alle N Seiten/ : /Eine Datei pro Seite/ }).check()
  if (mode === 'every') {
    await page.getByRole('spinbutton', { name: 'Seiten pro Datei', exact: true }).fill('5')
    await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeEnabled()
    await page.getByRole('spinbutton', { name: 'Seiten pro Datei', exact: true }).fill('2')
    await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en')
    await expect(page.getByRole('spinbutton', { name: 'Pages per file', exact: true })).toHaveValue('2')
    await expect(page.getByRole('radio', { name: /Every N pages/ })).toBeChecked()
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('de')
  }
  await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'PDF teilen', exact: true }).click()
  await verifyDownload(page, mode === 'every' ? [[1, 2], [3, 4], [5]] : [[1], [2], [3], [4], [5]])
})

test('German Split: invalid configuration stays translated, escaped and blocked', async ({ page }) => {
  await configureRanges(page)
  const ranges = page.getByRole('textbox', { name: 'Seitenbereiche (kommagetrennt)', exact: true })
  const preview = page.getByRole('region', { name: 'Vorschau', exact: true })
  for (const [expression, message] of [['', 'Wähle mindestens einen Seitenbereich'], ['1-2', 'Ein Seitenbereich ergibt eine einzelne Datei'], ['5-2', "Der Bereich '5-2' verläuft rückwärts"], ['6, 1', "Der Bereich '6' ist für ein Dokument mit 5 Seiten ungültig"], ['<script>window.deSplitExecuted=true</script>', 'ist keine gültige Seite oder kein gültiger Seitenbereich']]) {
    await ranges.fill(expression)
    await expect(preview).toContainText(message)
    await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeDisabled()
  }
  expect(await page.evaluate(() => 'deSplitExecuted' in window)).toBe(false)
  await expect(preview.locator('script')).toHaveCount(0)
  await page.getByRole('radio', { name: /Alle N Seiten/ }).check()
  for (const [value, message] of [['1.5', 'positive ganze Zahl'], ['6', 'größer als das Dokument mit 5 Seiten']]) {
    await page.getByRole('spinbutton', { name: 'Seiten pro Datei', exact: true }).fill(value)
    await expect(preview).toContainText(message)
    await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeDisabled()
  }
})

test('German Split: malformed source cannot run and replacing it recovers the preview', async ({ page }) => {
  await page.goto('de/split/')
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nnot a PDF body\n%%EOF') })
  await expect(page.getByRole('region', { name: 'Vorschau', exact: true })).toContainText('Diese Datei konnte nicht als PDF gelesen werden.')
  await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeDisabled()
  await expect(page.locator('.btn-download')).toHaveCount(0)
  await selectPdf(page)
  await page.getByRole('textbox', { name: 'Seitenbereiche (kommagetrennt)', exact: true }).fill('1, 2-5')
  await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeEnabled()
})

test('German Split: cancellation retains configuration and a fresh run produces its own output', async ({ page }) => {
  await configureRanges(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let blocked = 0
  await page.route('**/assets/pdf.worker.min.mjs', async route => { blocked++; await gate; await route.continue() })
  try {
    await page.getByRole('button', { name: 'PDF teilen', exact: true }).click()
    await expect.poll(() => blocked).toBeGreaterThan(0)
    await page.getByRole('combobox', { name: 'Sprache', exact: true }).selectOption('en')
    await expect(page.getByRole('region', { name: 'Processing', exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('de')
    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Abgebrochen', exact: true })).toContainText('Es steht kein Teilergebnis')
  } finally { release() }
  await page.unrouteAll({ behavior: 'wait' })
  await page.getByRole('button', { name: 'Einstellungen anpassen', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Seitenbereiche (kommagetrennt)', exact: true })).toHaveValue('5, 1-2, 2')
  await expect(page.locator('.file-row')).toHaveCount(1)
  await expect(page.locator('.btn-download')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeEnabled()
  await page.getByRole('textbox', { name: 'Seitenbereiche (kommagetrennt)', exact: true }).fill('1-2, 3-5')
  await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'PDF teilen', exact: true }).click()
  await verifyDownload(page, [[1, 2], [3, 4, 5]])
})

test('German Split: job failure has translated recovery without losing the selected configuration', async ({ page }) => {
  await configureRanges(page)
  await page.route('**/assets/pdf.worker.min.mjs', route => route.abort('failed'))
  await page.getByRole('button', { name: 'PDF teilen', exact: true }).click()
  const failure = page.getByRole('alert', { name: 'Etwas ist schiefgelaufen', exact: true })
  await expect(failure).toContainText('Diese Datei konnte nicht als PDF gelesen werden.')
  await expect(failure).toContainText('Für diesen Versuch ist kein Download verfügbar.')
  await expect(page.locator('.btn-download')).toHaveCount(0)
  await page.unrouteAll({ behavior: 'wait' })
  await failure.getByRole('button', { name: 'Einstellungen überprüfen', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Seitenbereiche (kommagetrennt)', exact: true })).toHaveValue('5, 1-2, 2')
  await expect(page.getByRole('button', { name: 'PDF teilen', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'PDF teilen', exact: true }).click()
  await verifyDownload(page, [[5], [1, 2], [2]])
})

test('German Split: missing guidance remains isolated from the usable workspace', async ({ page }) => {
  const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'))
  await page.route(`**/${manifest['src/components/GermanSplitGuide.tsx'].file}`, route => route.abort('failed'))
  await configureRanges(page)
  await expect(page.getByRole('alert')).toContainText('Das Werkzeug bleibt verfügbar.')
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Anleitung neu laden', exact: true })).toHaveCount(0)
})
