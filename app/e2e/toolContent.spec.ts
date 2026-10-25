import { test, expect } from '@playwright/test'
import { TOOLS } from '../src/registry'
import { TOOL_CONTENT } from '../src/lib/toolContent'

for (const javaScriptEnabled of [true, false]) {
  test(`PT-SEO-003 public guides with JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, async ({ browser }) => {
    test.setTimeout(120_000)
    const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 320, height: 900 } })
    const page = await context.newPage()
    for (const tool of TOOLS.filter(tool => tool.implemented)) {
      await page.goto(`http://127.0.0.1:4178/pdf-tools${tool.route}/`)
      const article = page.getByRole('region', { name: `${tool.title} guide`, exact: true })
      await expect(article).toHaveCount(1)
      await expect(article.getByRole('heading', { name: `About ${tool.title}`, exact: true })).toBeVisible()
      const content = TOOL_CONTENT[tool.id]
      for (const text of [content.intro, content.formats, content.limit, content.example, content.faq.answer, ...content.steps]) await expect(article).toContainText(text)
      await expect(page.getByRole('main')).toHaveCount(1)
      if (javaScriptEnabled) {
        const utility = page.locator('.tool-screen')
        expect((await utility.boundingBox())!.y).toBeLessThan((await article.boundingBox())!.y)
        await expect(page.locator('input[type=file]')).toHaveCount(1)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      } else {
        await expect(page.getByRole('main'), tool.id).toContainText('JavaScript is required')
      }
    }
    await context.close()
  })
}
