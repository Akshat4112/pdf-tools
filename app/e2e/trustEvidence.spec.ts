/** PT-TRUST-002: synthetic/public-only evidence and no misleading trust badges. */
import { test, expect } from '@playwright/test'
import { INFO_PAGE_META, SITE_URL } from '../src/lib/pageMetadata'

test('PT-TRUST-002 trust evidence route is prerendered, crawlable and linked from homepage', async ({ page, request }) => {
  expect(INFO_PAGE_META.some(p => p.dir === 'trust')).toBe(true)
  const html = await (await request.get('trust/')).text()
  expect(html).toContain('<noscript>')
  expect(html).toContain('<h1>Trust and transparency</h1>')
  expect(html).toContain(`<link rel="canonical" href="${SITE_URL}trust/"`)
  expect(html).toContain('local-processing-audit.md')
  await page.goto('./')
  const link = page.getByRole('link', { name: 'View trust evidence' })
  await expect(link).toHaveAttribute('href', '/pdf-tools/trust/')
  await link.click()
  await expect(page.getByRole('heading', { name: 'Trust and transparency', level: 1 })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${SITE_URL}trust/`)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'PDF tools that work in your browser.', level: 1 })).toBeVisible()
})

test('PT-TRUST-002 evidence links and limitations are clear, without confidential uploads', async ({ page }) => {
  await page.goto('trust/')
  const content = page.locator('.public-info')
  await expect(content.getByRole('link', { name: 'MIT license' })).toHaveAttribute('href', /\/blob\/main\/LICENSE$/)
  await expect(content.getByRole('link', { name: 'all-tool local-processing audit' })).toHaveAttribute('href', /PT-SEC-002-local-processing-audit\.md$/)
  await expect(content.getByRole('link', { name: 'Privacy and local processing' })).toHaveAttribute('href', '/pdf-tools/privacy/')
  await expect(content.getByRole('link', { name: 'supported features and limitations' })).toHaveAttribute('href', '/pdf-tools/limitations/')
  await expect(content.getByText(/not an independent audit/)).toBeVisible()
  await expect(content.getByText(/Never attach private/)).toBeVisible()
  await expect(content.getByText(/not a confidential security inbox/)).toBeVisible()
  for (const link of await content.locator('a[href^="https://"]').all()) {
    await expect(link).toHaveAttribute('rel', /noopener/)
  }
  await expect(content.locator('input[type=file],form')).toHaveCount(0)
})

test('PT-TRUST-002 link is visible and keyboard-accessible on mobile and in German UI', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('./')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const link = page.getByRole('link', { name: 'View trust evidence' })
    const bounds = await link.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
    await link.focus()
    await expect(link).toBeFocused()
    await link.press('Enter')
    await expect(page).toHaveURL(/\/pdf-tools\/trust\/?$/)
    await page.goBack()
  }
  await page.locator('.folio-language select').selectOption('de')
  await expect(page.getByRole('link', { name: 'Nachweise ansehen' })).toBeVisible()
})
