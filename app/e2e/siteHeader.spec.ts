import { test, expect } from '@playwright/test'
import { CATEGORIES, TOOLS } from '../src/registry'

// Synthetic empty workspaces only; no document fixtures or external requests.
test('header reflows with usable targets and theme-aware local brand assets', async ({ page }) => {
  await page.goto('./')
  const header = page.locator('header')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      const menu = header.getByRole('button', { name: 'Menu' })
      if (await menu.isVisible()) await menu.click()
      const categories = header.locator('summary')
      if (!(await header.locator('details').evaluate(el => (el as HTMLDetailsElement).open))) await categories.click()
      await expect(header.getByRole('link', { name: 'Merge PDF', exact: true })).toBeVisible()
      const clipped = await header.locator('a,button,summary').evaluateAll(elements => elements.filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && (r.width < 44 || r.height < 44 || r.left < 0 || r.right > innerWidth)
      }).map(el => el.textContent))
      expect(clipped).toEqual([])
      const image = header.locator('img')
      await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true)
      expect(await image.evaluate(el => (el as HTMLImageElement).currentSrc)).toContain(`brand/logo-${colorScheme}.svg`)
      for (const category of CATEGORIES) await expect(header.getByRole('heading', { name: category.title, exact: true })).toBeVisible()
      await categories.click()
      const close = header.getByRole('button', { name: 'Close' })
      if (await close.isVisible()) await close.click()
    }
  }
})

test('mobile keyboard disclosure closes in order and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('./')
  const header = page.locator('header')
  const menu = header.getByRole('button', { name: 'Menu' })
  await menu.focus()
  await menu.press('Enter')
  await expect(header.getByRole('button', { name: 'Close' })).toHaveAttribute('aria-expanded', 'true')
  const categories = header.locator('summary')
  await categories.focus()
  await categories.press('Enter')
  await header.getByRole('link', { name: 'Merge PDF', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(categories).toBeFocused()
  await expect(header.locator('details')).not.toHaveAttribute('open')
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  expect(await menu.evaluate(el => getComputedStyle(el).outlineWidth)).toBe('3px')
  await menu.click()
  await page.locator('h1').click()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await menu.click()
  await header.getByRole('link', { name: 'PDF Tools home' }).click()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
})

test('working-tool navigation and shared header survive routes and history', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('./')
  const header = page.locator('header')
  await header.locator('summary').click()
  const links = header.locator('.folio-categories a')
  expect(await links.count()).toBe(TOOLS.filter(tool => tool.implemented).length + CATEGORIES.length)
  for (const tool of TOOLS.filter(tool => tool.implemented)) {
    await expect(header.getByRole('link', { name: tool.title, exact: true })).toHaveAttribute('href', `/pdf-tools${tool.route}`)
  }
  for (const tool of TOOLS.filter(tool => !tool.implemented)) {
    await expect(header.getByRole('link', { name: tool.title, exact: true })).toHaveCount(0)
  }
  await header.getByRole('link', { name: 'Merge PDF', exact: true }).click()
  await expect(page).toHaveURL(/\/pdf-tools\/merge$/)
  await expect(header.locator('details')).not.toHaveAttribute('open')
  await header.locator('summary').click()
  await expect(header.getByRole('link', { name: 'Merge PDF', exact: true })).toHaveAttribute('aria-current', 'page')
  await header.getByRole('link', { name: 'PDF Tools home' }).click()
  await expect(header.getByRole('link', { name: 'All tools', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await expect(page).toHaveURL(/\/merge$/)
  await expect(header.locator('details')).not.toHaveAttribute('open')
  await page.goto('missing-header-test')
  await expect(header.getByRole('link', { name: 'PDF Tools home' })).toBeVisible()
  await expect(header.getByRole('link', { name: /Privacy/ })).toHaveAttribute('href', '/pdf-tools/privacy/')
  await expect(header.getByRole('link', { name: /Source/ })).toHaveAttribute('href', 'https://github.com/Akshat4112/pdf-tools')
})

test('PDF Tools brand name and document favicon match the public identity', async ({ page, request }) => {
  await page.goto('./')
  await expect(page.getByRole('link', { name: 'PDF Tools home', exact: true })).toBeVisible()
  await expect(page.locator('main')).toContainText('with PDF Tools')
  await expect(page.locator('body')).not.toContainText(/folio\s?local/i)
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'PDF Tools')
  const iconPath = await page.locator('link[rel="icon"]').getAttribute('href')
  const icon = await request.get(new URL(iconPath!, page.url()).href)
  expect(icon.ok()).toBe(true)
  expect(await icon.text()).toContain('<title id="title">PDF Tools</title>')
  for (const file of ['logo-light.svg', 'logo-dark.svg', 'wordmark.svg', 'social-card.svg']) {
    const asset = await request.get(`/pdf-tools/brand/${file}`)
    expect(asset.ok()).toBe(true)
    expect(await asset.text()).toContain('PDF Tools')
    expect(await asset.text()).not.toMatch(/folio\s?local/i)
  }
})
