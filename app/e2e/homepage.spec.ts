import { test, expect } from '@playwright/test'
import { TOOLS } from '../src/registry'

test('homepage provides accurate tool-first messaging and working entry points', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'PDF tools that work in your browser.' })).toBeVisible()
  await expect(page.getByText('Free forever for local tools')).toBeVisible()
  await expect(page.getByText(/Loading the site and its assets still connects to GitHub Pages/)).toBeVisible()
  const links = page.locator('.fl-quick-card')
  expect(await links.count()).toBe(4)
  for (const id of ['merge', 'split', 'organize', 'images-to-pdf']) {
    const tool = TOOLS.find(t => t.id === id)!
    await expect(page.locator('.fl-quick-card', { hasText: tool.title })).toHaveAttribute('href', '/pdf-tools' + tool.route)
  }
  await page.getByRole('link', { name: /Explore all PDF tools/ }).click()
  await expect(page.locator('#tool-catalog')).toBeInViewport()
  await page.getByRole('searchbox', { name: 'Search tools' }).fill('merge')
  await expect(page.locator('.catalog').getByRole('link', { name: 'Open Merge PDF' })).toBeVisible()
  await page.locator('.fl-quick-card', { hasText: 'Merge PDF' }).click()
  await expect(page).toHaveURL(/\/pdf-tools\/merge\/?$/)
})

test('homepage reflows without horizontal overflow or inaccessible featured links', async ({ page }) => {
  await page.goto('./')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.getByRole('heading', { name: 'Popular PDF tasks' })).toBeVisible()
      for (const anchor of await page.locator('.fl-quick-card').all()) {
        const size = await anchor.boundingBox()
        expect(size).not.toBeNull()
        expect(size!.width).toBeGreaterThanOrEqual(44)
        expect(size!.height).toBeGreaterThanOrEqual(44)
        expect(size!.x).toBeGreaterThanOrEqual(0)
        expect(size!.x + size!.width).toBeLessThanOrEqual(width + 1)
      }
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.fl-hero')).toBeVisible()
})
