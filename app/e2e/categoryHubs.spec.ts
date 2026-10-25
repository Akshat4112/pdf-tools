import { test, expect } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { HUBS, hubPath, hubTools, publicHref } from '../src/lib/categoryHubs'
import { PUBLIC_PAGES, SITE_URL, hubPageMeta } from '../src/lib/pageMetadata'

test('PT-SEO-004 hubs: static link graph has no orphaned or broken public routes', async ({ request, browser }) => {
  test.setTimeout(120_000)
  const paths = new Set(PUBLIC_PAGES.map(p => new URL(p.canonical).pathname))
  const graph = new Map<string, string[]>()
  for (const meta of PUBLIC_PAGES) {
    const path = new URL(meta.canonical).pathname
    const response = await request.get(path); expect(response.ok(), path).toBe(true)
    const html = await response.text()
    const links: string[] = []
    for (const [, raw] of html.matchAll(/href="([^"]+)"/g)) {
      const url = new URL(raw, new URL(path, SITE_URL))
      if (url.origin !== new URL(SITE_URL).origin || !url.pathname.startsWith('/pdf-tools/') || /\.[a-z0-9]+$/i.test(url.pathname)) continue
      expect(url.search).toBe(''); expect(url.hash).toBe('')
      expect(paths.has(url.pathname), `${path} links to ${url.pathname}`).toBe(true)
      links.push(url.pathname)
    }
    graph.set(path, links)
  }
  const reachable = new Set<string>(), queue = ['/pdf-tools/']
  while (queue.length) { const path = queue.shift()!; if (reachable.has(path)) continue; reachable.add(path); queue.push(...graph.get(path)!) }
  expect([...reachable].sort()).toEqual([...paths].sort())
  const xml = await (await request.get('sitemap.xml')).text()
  for (const path of paths) expect(xml).toContain(`<loc>${new URL(path, SITE_URL).href}</loc>`)
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  for (const hub of HUBS) {
    await page.goto(`http://127.0.0.1:4178${publicHref(hubPath(hub))}`)
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: hub.title, exact: true, level: 1 })).toBeVisible()
    for (const tool of hubTools(hub)) await expect(page.getByRole('region', { name: 'Choose a tool' }).getByRole('link', { name: tool.title, exact: true })).toHaveAttribute('href', publicHref(tool.route))
  }
  await context.close()
})

test('PT-SEO-004 hubs: keyboard routes, history, related links and clean state', async ({ page }, info) => {
  test.setTimeout(180_000)
  for (const width of [320, 1440]) for (const colorScheme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme })
    for (const hub of HUBS) {
      await page.goto(`tools/${hub.id}/`)
      await expect(page).toHaveTitle(hubPageMeta(hub).title)
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', hubPageMeta(hub).canonical)
      await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).locator('[aria-current=page]')).toHaveText(hub.title)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (process.env.PDF_TOOLS_WORKSPACE_VISUAL_DIR) {
        await expect(page.locator('input[type=file],canvas,.file-row')).toHaveCount(0)
        await mkdir(process.env.PDF_TOOLS_WORKSPACE_VISUAL_DIR, { recursive: true })
        await page.locator('.shell').screenshot({ path: join(process.env.PDF_TOOLS_WORKSPACE_VISUAL_DIR, `empty-hub-${hub.id}-${info.project.name}-${width}-${colorScheme}.png`) })
      }
      const tool = hubTools(hub)[0]
      const link = page.getByRole('region', { name: 'Choose a tool' }).getByRole('link', { name: tool.title, exact: true })
      await link.focus(); await link.press('Enter')
      await expect(page.getByRole('heading', { level: 1, name: tool.title, exact: true })).toBeVisible()
      const crumb = page.getByRole('navigation', { name: 'Breadcrumb', exact: true })
      await expect(crumb.getByRole('link', { name: hub.title, exact: true })).toHaveAttribute('href', publicHref(hubPath(hub)))
      await page.goBack(); await expect(page).toHaveTitle(hubPageMeta(hub).title)
      await page.goForward(); await expect(page.getByRole('navigation', { name: 'Related PDF tools' })).toBeVisible()
    }
  }
  await page.goto('merge/')
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-private-sentinel.pdf', mimeType: 'application/pdf', buffer: await readFile('../fixtures/pdf/F-001-plain-text-3p.pdf') })
  await expect(page.locator('.file-row')).toHaveCount(1)
  await page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link', { name: HUBS[0].title, exact: true }).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  expect(await page.locator('head').innerHTML()).not.toContain('synthetic-private-sentinel')
  await page.goBack(); await expect(page.locator('.file-row')).toHaveCount(0)
})
