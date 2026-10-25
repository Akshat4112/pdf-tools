import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { CATALOG_META, NOT_FOUND_META, PUBLIC_PAGES, SHARE_IMAGE, pageMetaTags, toolMetaById, type PageMeta } from '../src/lib/pageMetadata'

async function checkHead(page: Page, meta: PageMeta) {
  await expect(page).toHaveTitle(meta.title)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', meta.canonical)
  for (const tag of pageMetaTags(meta)) {
    const locator = page.locator(`meta[${tag.attribute}="${tag.key}"]`)
    await expect(locator).toHaveCount(1)
    await expect(locator).toHaveAttribute('content', tag.content)
  }
}

test('PT-SEO-005 metadata: every built route has useful static metadata and working image/icon assets', async ({ request, page }) => {
  // Inspect the response before JavaScript can replace its head.
  for (const meta of [...PUBLIC_PAGES, { dir: '404.html', ...NOT_FOUND_META }]) {
    const path = meta.dir === '.' ? './' : meta.dir === '404.html' ? '404.html' : `${meta.dir}/`
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).toContain(`<title>${meta.title}</title>`)
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    expect(html).toContain(`href="${meta.canonical}"`)
    for (const tag of pageMetaTags(meta)) {
      expect(html.match(new RegExp(`${tag.attribute}="${tag.key}"`, 'g'))).toHaveLength(1)
      expect(html).toContain(`<meta ${tag.attribute}="${tag.key}" content="${tag.content}" />`)
    }
  }
  const image = await request.get(new URL(SHARE_IMAGE.url).pathname)
  expect(image.ok()).toBe(true)
  expect(image.headers()['content-type']).toContain('image/png')
  const png = await image.body()
  expect(png.readUInt32BE(16)).toBe(1200)
  expect(png.readUInt32BE(20)).toBe(630)
  await page.goto('./')
  for (const rel of ['icon', 'apple-touch-icon']) {
    const asset = await page.locator(`link[rel="${rel}"]`).getAttribute('href')
    expect((await request.get(new URL(asset!, page.url()).href)).ok()).toBe(true)
  }
  await checkHead(page, CATALOG_META)
})

test('PT-SEO-005 metadata: SPA/history, unknown routes and selected documents keep public metadata', async ({ page }) => {
  await page.goto('./')
  await checkHead(page, CATALOG_META)
  await page.locator('.fl-quick-card').filter({ hasText: 'Merge PDF' }).click()
  await checkHead(page, toolMetaById('merge'))
  const before = await page.locator('head').innerHTML()
  const sentinel = 'private-customer-canary-829.pdf'
  const buffer = await readFile('../fixtures/pdf/F-001-plain-text-3p.pdf')
  await page.locator('input[type="file"]').setInputFiles({ name: sentinel, mimeType: 'application/pdf', buffer })
  await expect(page.locator('.file-row')).toHaveCount(1)
  expect(await page.locator('head').innerHTML()).toBe(before)
  expect(await page.locator('head').innerHTML()).not.toContain(sentinel)
  await page.goBack()
  await checkHead(page, CATALOG_META)
  await page.goForward()
  await checkHead(page, toolMetaById('merge'))
  await page.goto('missing-seo-route?document=private-customer-canary-829#secret')
  await checkHead(page, NOT_FOUND_META)
  expect(await page.locator('head').innerHTML()).not.toContain('private-customer-canary-829')
})
