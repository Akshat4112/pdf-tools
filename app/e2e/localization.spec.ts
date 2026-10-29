import { test, expect } from '@playwright/test'

test('PT-UX-005 / PT-SEO-010: catalog languages use URLs; tools retain in-memory switching', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('de')
  await expect(page).toHaveURL(/\/pdf-tools\/de\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('heading', { level: 1, name: 'PDF-Tools direkt im Browser verwenden' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Verfügbare PDF-Werkzeuge' })).toBeVisible()
  await expect(page.locator('.hub-tool-list a')).toHaveCount(14)
  // German tool entries aren't published until their UI is fully translated.
  // This link goes to the existing English tool canonical.
  await page.locator('.hub-tool-list a[href="/pdf-tools/merge/"]').click()
  // SPA navigation uses the established slashless tool path; static Pages
  // loads may add a trailing slash. Both must retain the English canonical.
  await expect(page).toHaveURL(/\/pdf-tools\/merge\/?$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://akshat4112.github.io/pdf-tools/merge/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('de')
  await expect(page.getByRole('heading', { level: 1, name: 'PDF zusammenfügen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dateien auswählen' })).toBeVisible()
  await expect(page.locator('.folio-navigation > a').first()).toHaveText('Alle Tools')
  await page.getByRole('combobox', { name: 'Sprache' }).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1, name: 'Merge PDF' })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([])
})

test('PT-SEO-010: the German catalog English-version link resets the UI locale', async ({ page }) => {
  await page.goto('de/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await page.getByRole('link', { name: 'English version', exact: true }).click()
  await expect(page).toHaveURL(/\/pdf-tools\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en')
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3)
})

test('PT-UX-005: language control is reachable by keyboard at narrow and zoomed layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  const select = page.locator('.folio-language select')
  await select.focus()
  await expect(select).toBeFocused()
  await select.press('d')
  await select.selectOption('de')
  await expect(page).toHaveURL(/\/pdf-tools\/de\/$/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  const rect = await select.boundingBox()
  expect(rect!.height).toBeGreaterThanOrEqual(44)
  expect(rect!.width).toBeGreaterThanOrEqual(44)
  await page.evaluate(() => { document.body.style.zoom = '2' })
  await expect(select).toBeVisible()
})
