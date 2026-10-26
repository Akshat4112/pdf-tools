/** PT-REL-001 — public pages only, no private document fixtures or screenshots. */
import { expect, test } from '@playwright/test'
import { INFO_PAGE_META, PUBLIC_PAGES } from '../src/lib/pageMetadata'

test('PT-REL-001: real static help/privacy/limitations pages with useful canonical metadata', async ({ page, request }) => {
  for (const info of INFO_PAGE_META) {
    const path = `${info.dir}/`
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).toContain(`<link rel="canonical" href="https://akshat4112.github.io/pdf-tools/${info.dir}/"`)
    expect(html).toContain('<noscript>')
    expect(html).toContain('<h1>')
    expect(html).toContain('All PDF tools')
    expect(html).not.toContain('file=private')
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: info.title, exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).locator('[aria-current="page"]')).toHaveText(info.title)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://akshat4112.github.io/pdf-tools/${info.dir}/`)
    expect(await page.locator('main').locator('script').count()).toBe(0)
  }
  expect(PUBLIC_PAGES.filter(p => INFO_PAGE_META.some(info => p.dir === info.dir))).toHaveLength(3)
})

test('PT-REL-001: help navigation resolves to the shipped catalog/tools, safe issue guidance and privacy notice', async ({ page }) => {
  await page.goto('help/')
  await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible()
  await expect(page.getByText('Never post personal', { exact: false })).toBeVisible()
  const issue = page.getByRole('link', { name: 'public GitHub issue' })
  await expect(issue).toHaveAttribute('href', 'https://github.com/Akshat4112/pdf-tools/issues/new')
  await expect(page.getByRole('link', { name: 'Merge PDFs' })).toHaveAttribute('href', '/pdf-tools/merge/')
  await page.getByRole('link', { name: 'privacy notice' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy and local processing' })).toBeVisible()
  await expect(page.getByText('GitHub Pages hosts', { exact: false })).toBeVisible()
  await expect(page.getByText('does not', { exact: false }).first()).toBeVisible()
  await page.getByRole('link', { name: 'limitations', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Supported features and limitations' })).toBeVisible()
  await expect(page.getByText('50 MiB', { exact: false })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy and local processing' })).toBeVisible()
})

test('PT-REL-001: public text never asks for document upload and external links are marked safe', async ({ page }) => {
  for (const url of ['help/', 'privacy/', 'limitations/']) {
    await page.goto(url)
    expect(await page.locator('input[type=file],form').count()).toBe(0)
    for (const href of await page.locator('.public-info a[href^="http"]').all()) {
      await expect(href).toHaveAttribute('rel', /noopener/)
    }
  }
})
