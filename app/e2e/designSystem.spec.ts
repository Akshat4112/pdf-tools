import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// Reference-only regressions: no files, processing or production CSS mutation.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1') throw new Error(`Unexpected reference request: ${url.origin}`)
    return route.continue()
  })
})

test('design reference reflows in both themes without loading engines', async ({ page }, info) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('design-system/')
  await expect(page.getByRole('heading', { name: 'Useful tools. Considered details.' })).toBeVisible()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const dark of [false, true]) {
      const toggle = page.getByRole('button', { name: 'Dark theme', exact: true })
      if ((await toggle.getAttribute('aria-pressed')) !== String(dark)) await toggle.click()
      await expect(page.locator('body')).toHaveAttribute('data-fl-theme', dark ? 'dark' : 'light')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      const clipped = await page.locator('button,input,select,a,.fl-panel').evaluateAll(elements => elements.filter(element => {
        const r = element.getBoundingClientRect()
        return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)
      }).map(element => element.tagName + ':' + element.textContent?.slice(0, 40)))
      expect(clipped).toEqual([])
      const columns = await page.locator('.fl-tool-layout').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
      expect(columns).toBe(width > 900 ? 2 : 1)
      const primary = page.getByRole('link', { name: 'Primary action', exact: true })
      const contrast = await primary.evaluate(element => {
        const style = getComputedStyle(element)
        function luminance(color: string) {
          const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
          return channels.reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
        }
        const [low, high] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => a - b)
        return (high + .05) / (low + .05)
      })
      expect(contrast).toBeGreaterThanOrEqual(4.5)
      if (process.env.PDF_TOOLS_VISUAL_DIR && [390, 1440].includes(width)) {
        await mkdir(process.env.PDF_TOOLS_VISUAL_DIR, { recursive: true })
        for (const section of ['homepage', 'workspace']) await page.locator(`#${section}`).screenshot({ path: `${process.env.PDF_TOOLS_VISUAL_DIR}/design-${section}-${width}-${dark ? 'dark' : 'light'}-${info.project.name}.png` })
      }
    }
  }
  expect(requests.some(url => /assets\/.*\.(mjs|wasm)|pdf\.worker|fontkit|overlayFont/.test(url))).toBe(false)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow')
})

test('reference controls support keyboard theme, selection, reset and disclosure', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('design-system/')
  const theme = page.getByRole('button', { name: 'Dark theme', exact: true })
  await expect(theme).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to design reference' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(theme).toBeFocused()
  expect(await theme.evaluate(element => getComputedStyle(element).outlineWidth)).toBe('3px')
  await theme.press('Space')
  await expect(theme).toHaveAttribute('aria-pressed', 'false')
  const firstPage = page.getByRole('button', { name: 'Page 1 · Not selected', exact: true })
  await firstPage.focus()
  await firstPage.press('Space')
  await expect(page.locator('#selection-status')).toHaveText('2 example pages selected')
  await page.getByRole('button', { name: 'Reset page selection' }).click()
  await expect(page.locator('#selection-status')).toHaveText('0 example pages selected')
  await expect(page.locator('#selection-example button').first()).toBeFocused()
  await page.getByText('Supported files and limits', { exact: true }).press('Enter')
  await expect(page.locator('details')).toHaveAttribute('open', '')
  await expect(page.getByLabel('Page range — invalid specimen', { exact: true })).toHaveAttribute('aria-describedby', 'invalid-help')
})
