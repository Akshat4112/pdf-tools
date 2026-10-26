import { test, expect, type Locator } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { TOOLS } from '../src/registry'

const representative = new Set(['merge', 'organize', 'images-to-pdf', 'pdf-to-png', 'reader', 'watermark', 'doc-info'])
async function boundaryContrast(fields: Locator) {
  const values = await fields.evaluateAll(elements => elements.filter(el => !(el as HTMLInputElement).disabled).map(el => {
    const luminance = (color: string) => {
      const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 })
      return r * .2126 + g * .7152 + b * .0722
    }
    const ratio = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
    const style = getComputedStyle(el)
    return { border: ratio(style.borderTopColor, style.backgroundColor), text: ratio(style.color, style.backgroundColor) }
  }))
  for (const value of values) { expect(value.border).toBeGreaterThanOrEqual(3); expect(value.text).toBeGreaterThanOrEqual(4.5) }
}

test('PT-UI-005 workspaces: all shipped tools share responsive chrome, help and theme', async ({ page }, info) => {
  test.setTimeout(180_000)
  for (const width of [320, 1440]) for (const colorScheme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    for (const tool of TOOLS.filter(tool => tool.implemented)) {
      await page.goto(`${tool.route.slice(1)}/`)
      const main = page.getByRole('main'), crumb = main.getByRole('navigation', { name: 'Breadcrumb', exact: true })
      await expect(main).toHaveCount(1)
      await expect(main.locator('input[type=file]')).toHaveCount(1)
      await expect(main.getByRole('heading', { name: tool.title, level: 1, exact: true })).toBeVisible()
      await expect(crumb.locator('[aria-current="page"]')).toHaveText(tool.title)
      await expect(crumb.getByRole('link', { name: 'All PDF tools', exact: true })).toHaveAttribute('href', '/pdf-tools/')
      const help = main.locator('.workspace-help'), summary = help.locator('summary')
      await summary.focus(); await summary.press('Enter'); await expect(help).toHaveAttribute('open')
      await expect(help).toContainText('processed in this browser'); await expect(help.locator('p').first()).not.toHaveText('')
      await summary.press('Enter')
      expect(await summary.evaluate(el => getComputedStyle(el).outlineWidth)).toBe('3px')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const clipped = await main.locator('button,a,summary').evaluateAll(elements => elements.filter(el => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && (rect.width < 44 || rect.height < 44 || rect.left < 0 || rect.right > innerWidth + 1)
      }).map(el => el.textContent))
      expect(clipped, `${tool.id} at ${width}px in ${colorScheme}`).toEqual([])
      const palette = await main.evaluate(root => {
        const style = getComputedStyle(root), picker = getComputedStyle(root.querySelector('.dropzone')!), header = getComputedStyle(document.querySelector('.folio-header')!)
        return { accent: style.getPropertyValue('--accent').trim().toLowerCase(), brand: style.getPropertyValue('--fl-accent').trim().toLowerCase(), picker: picker.backgroundColor, header: header.backgroundColor }
      })
      expect(palette.accent).toBe(palette.brand); expect(palette.picker).toBe(palette.header)
      // Only capture empty public chrome; no selected file, document name or canvas.
      if (process.env.PDF_TOOLS_WORKSPACE_VISUAL_DIR && representative.has(tool.id)) {
        await expect(main.locator('.file-row,canvas')).toHaveCount(0)
        expect(await main.locator('input[type="file"]').evaluate(el => (el as HTMLInputElement).files?.length)).toBe(0)
        await mkdir(process.env.PDF_TOOLS_WORKSPACE_VISUAL_DIR, { recursive: true })
        await page.locator('.shell').screenshot({ path: join(process.env.PDF_TOOLS_WORKSPACE_VISUAL_DIR, `empty-${tool.id}-${info.project.name}-${width}-${colorScheme}.png`), animations: 'disabled' })
      }
    }
  }
})

test('PT-UI-005 workspaces: populated controls stay usable and PDF rendering keeps its geometry', async ({ page }) => {
  test.setTimeout(180_000)
  const buffer = await readFile('../fixtures/pdf/F-001-plain-text-3p.pdf')
  const pdf = await PDFDocument.load(buffer), expectedRatio = pdf.getPage(0).getWidth() / pdf.getPage(0).getHeight()
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' }); await page.setViewportSize({ width: 320, height: 1000 })
    for (const route of ['merge', 'organize', 'pdf-to-png', 'reader', 'watermark', 'doc-info']) {
      await page.goto(`${route}/`)
      await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-long-document-name-for-layout.pdf', mimeType: 'application/pdf', buffer })
      const main = page.getByRole('main'); await expect(main.locator('.file-row')).toHaveCount(1)
      if (route === 'organize') await expect(main.locator('.organize-card')).toHaveCount(3)
      if (route === 'reader') {
        await expect(main.getByRole('button', { name: 'Go', exact: true })).toBeEnabled()
        const canvas = main.locator('.pdfViewer canvas').first(); await expect(canvas).toBeVisible()
        await expect.poll(() => canvas.evaluate((el, ratio) => { const rect = el.getBoundingClientRect(); return Math.abs(rect.width / rect.height - ratio) }, expectedRatio)).toBeLessThan(.02)
        const geometry = await canvas.evaluate(el => {
          const canvas = el as HTMLCanvasElement, rect = canvas.getBoundingClientRect()
          return { width: canvas.width, height: canvas.height, ratio: rect.width / rect.height, filter: getComputedStyle(canvas).filter }
        })
        expect(geometry.width).toBeGreaterThan(0); expect(geometry.height).toBeGreaterThan(0)
        expect(Math.abs(geometry.ratio - expectedRatio)).toBeLessThan(.02); expect(geometry.filter).toBe('none')
      }
      await boundaryContrast(main.locator('input[type=number]:visible,input[type=text]:visible,select:visible'))
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true)
      for (const button of await main.locator('.file-actions button').all()) {
        const box = await button.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44)
      }
      await main.getByRole('link', { name: 'All PDF tools', exact: true }).click()
      await expect(page.getByRole('region', { name: 'Tool catalog' })).toBeVisible()
    }
  }
})
