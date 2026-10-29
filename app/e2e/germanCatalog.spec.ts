import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { SITE_URL } from '../src/lib/pageMetadata'

test('PT-SEO-010: German catalog is statically served and is the only indexed German page', async ({ page, request }) => {
  const response = await request.get('de/')
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('<html lang="de">')
  expect(html).toContain(`<link rel="canonical" href="${SITE_URL}de/"`)
  expect(html).toContain(`hreflang="en" href="${SITE_URL}"`)
  expect(html).toContain(`hreflang="de" href="${SITE_URL}de/"`)
  expect(html).toContain('Verfügbare PDF-Werkzeuge')
  expect(html).toContain('<noscript>')

  const enHtml = await (await request.get('./')).text()
  expect(enHtml).toContain(`hreflang="de" href="${SITE_URL}de/"`)
  expect(enHtml).toContain(`<link rel="canonical" href="${SITE_URL}"`)
  const sitemap = await (await request.get('sitemap.xml')).text()
  expect(sitemap).toContain(`<loc>${SITE_URL}de/</loc>`)
  expect(sitemap).not.toContain(`${SITE_URL}de/merge/`)

  await page.goto('de/')
  await expect(page.getByRole('heading', { name: 'PDF-Tools direkt im Browser verwenden' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('select[aria-label="Sprache"]')).toHaveValue('de')
  await expect(page.locator('.hub-tool-list a')).toHaveCount(14)
  await page.locator('select[aria-label="Sprache"]').selectOption('en')
  await expect(page).toHaveURL('http://127.0.0.1:4178/pdf-tools/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('PT-SEO-010: English tool entries remain canonical; German aliases are absent', async ({ request, page }) => {
  // The Vite preview can serve its SPA fallback with HTTP 200; the actual
  // GitHub Pages contract is that no physical German tool page is emitted.
  expect(existsSync('dist/de/merge/index.html')).toBe(false)
  const enMerge = await request.get('merge/')
  expect(enMerge.ok()).toBe(true)
  const enHtml = await enMerge.text()
  expect(enHtml).toContain(`<link rel="canonical" href="${SITE_URL}merge/"`)
  expect(enHtml).not.toContain('hreflang="de"')
  await page.goto('./')
  await page.locator('select[aria-label="Language"]').selectOption('de')
  await expect(page).toHaveURL('http://127.0.0.1:4178/pdf-tools/de/')
  await expect(page.getByRole('heading', { name: 'PDF-Tools direkt im Browser verwenden' })).toBeVisible()
})
