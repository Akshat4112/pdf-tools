import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PUBLIC_PAGES, pageStructuredData, STRUCTURED_DATA_ID, NOT_FOUND_META } from '../src/lib/pageMetadata'

test('PT-SEO-006 schema: static and client graphs match all visible public routes', async ({ request, page }) => {
  test.setTimeout(120_000)
  for (const meta of [...PUBLIC_PAGES, { dir: '404.html', ...NOT_FOUND_META }]) {
    const path = meta.dir === '.' ? './' : meta.dir === '404.html' ? meta.dir : `${meta.dir}/`
    const html = await (await request.get(path)).text()
    const blocks = [...html.matchAll(/<script id="public-structured-data" type="application\/ld\+json">(.*?)<\/script>/g)]
    const expected = pageStructuredData(meta.canonical)
    expect(blocks).toHaveLength(expected ? 1 : 0)
    if (expected) expect(JSON.parse(blocks[0][1])).toEqual(expected)
    await page.goto(path)
    const script = page.locator(`#${STRUCTURED_DATA_ID}`)
    await expect(script).toHaveCount(expected ? 1 : 0)
    if (!expected) continue
    expect(JSON.parse((await script.textContent())!)).toEqual(expected)
    const crumb = expected['@graph'].find(n => n['@type'] === 'BreadcrumbList')
    if (crumb) {
      const items = crumb.itemListElement as { name: string; item: string }[]
      const visible = page.getByRole('navigation', { name: 'Breadcrumb', exact: true })
      for (const item of items) await expect(visible).toContainText(item.name)
      await expect(visible.locator('[aria-current=page]')).toHaveText(items.at(-1)!.name)
    }
    for (const app of expected['@graph'].filter(n => n['@type'] === 'WebApplication')) {
      if (meta.dir !== '.') await expect(page.getByRole('heading', { level: 1, name: app.name as string, exact: true })).toBeVisible()
      await expect(page.locator('.folio-trust')).toContainText('Free forever')
    }
  }
})

test('PT-SEO-006 schema: SPA, history, selected files and unknown routes stay isolated', async ({ page }) => {
  await page.goto('./')
  const schema = page.locator(`#${STRUCTURED_DATA_ID}`)
  await page.locator('.fl-quick-card').filter({ hasText: 'Merge PDF' }).click()
  const before = await schema.textContent()
  await page.locator('input[type=file]').setInputFiles({ name: 'private-schema-canary.pdf', mimeType: 'application/pdf', buffer: await readFile('../fixtures/pdf/F-001-plain-text-3p.pdf') })
  await expect(page.locator('.file-row')).toHaveCount(1)
  expect(await schema.textContent()).toBe(before)
  await page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link', { name: 'Organize PDF pages', exact: true }).click()
  await expect(schema).not.toHaveText(before!)
  expect(await schema.textContent()).not.toContain('private-schema-canary')
  await page.goBack(); await expect(schema).toHaveText(before!)
  await page.goBack(); await expect(schema).toContainText('WebSite')
  await page.goto('missing-schema-route?file=private-schema-canary.pdf#private')
  await expect(schema).toHaveCount(0)
})
