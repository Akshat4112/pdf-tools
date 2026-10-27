/**
 * PT-BQA-001: integrated branded release gate for public claims and routes.
 * Synthetic PDFs only. This complements rather than replaces unit, privacy,
 * output, accessibility and cross-engine checks tracked elsewhere.
 */
import { test, expect } from '@playwright/test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { readFile } from 'node:fs/promises'
import { PUBLIC_PAGES, SITE_URL } from '../src/lib/pageMetadata'
import { TOOLS } from '../src/registry'

test('release contract: 14 advertised tools have real canonical HTML and one index entry', async ({ request }) => {
  test.setTimeout(120_000)
  const implemented = TOOLS.filter(tool => tool.implemented)
  expect(implemented).toHaveLength(14)
  const paths = new Set(PUBLIC_PAGES.map(page => page.canonical))
  expect(paths.size).toBe(PUBLIC_PAGES.length)
  const sitemap = await (await request.get('sitemap.xml')).text()
  expect((sitemap.match(/<loc>/g) || [])).toHaveLength(PUBLIC_PAGES.length)
  const home = await (await request.get('./')).text()
  expect(home).toContain('PDF Tools')
  expect(home).toContain('fl-site-footer')
  for (const tool of implemented) {
    const route = `${tool.route.slice(1)}/`
    const canonical = `${SITE_URL}${route}`
    expect(paths.has(canonical), tool.id).toBe(true)
    const response = await request.get(route)
    expect(response.ok(), tool.id).toBe(true)
    const body = await response.text()
    expect(body).toContain(`<link rel="canonical" href="${canonical}"`)
    expect(body).toContain('id="main-content"')
    expect(body).toContain('href="#main-content"')
    expect(sitemap).toContain(`<loc>${canonical}</loc>`)
    expect(body).not.toContain('noindex,nofollow')
  }
})

test('release contract: help, privacy, trust, limitations and 404 have truthful boundaries', async ({ request }) => {
  const pages = ['help', 'privacy', 'trust', 'limitations']
  for (const dir of pages) {
    const response = await request.get(`${dir}/`)
    expect(response.ok()).toBe(true)
    const body = await response.text()
    expect(body).toContain('<noscript>')
    expect(body).toContain(`<link rel="canonical" href="${SITE_URL}${dir}/"`)
    expect(body).toContain('class="fl-site-footer"')
    expect(body).toContain('href="/pdf-tools/trust/"')
  }
  const privacy = await (await request.get('privacy/')).text()
  for (const detail of ['GitHub Pages', 'IP address', 'browser memory', 'not']) expect(privacy).toContain(detail)
  const limitations = await (await request.get('limitations/')).text()
  for (const detail of ['50 MiB', '300 pages', 'OCR', 'redaction', 'signatures']) expect(limitations.toLowerCase()).toContain(detail.toLowerCase())
  const trust = await (await request.get('trust/')).text()
  for (const evidence of ['blob/main/LICENSE', 'PT-SEC-002-local-processing-audit.md', 'not an independent audit', 'Never attach private']) expect(trust).toContain(evidence)
  const missing = await (await request.get('404.html')).text()
  expect(missing).toContain('noindex')
  expect(missing).toContain('PDF Tools')
})

test('release contract: synthetic select→process→download→reset does not leak document data to network or metadata', async ({page}) => {
  test.setTimeout(90000)
  const source = await PDFDocument.create()
  const font = await source.embedFont(StandardFonts.Helvetica)
  source.addPage([310, 410]).drawText('PT-BQA-001 synthetic sentinel', {x:18,y:370,size:12,font})
  const buffer = Buffer.from(await source.save())
  const outbound: string[] = []
  page.on('request', req => {
    const url = new URL(req.url())
    if (url.origin !== 'http://127.0.0.1:4178') outbound.push(req.url())
  })
  await page.goto('merge/')
  await page.locator('input[type=file]').setInputFiles([
    {name:'synthetic-qa-canary-01.pdf',mimeType:'application/pdf',buffer},
    {name:'synthetic-qa-canary-02.pdf',mimeType:'application/pdf',buffer},
  ])
  await expect(page.locator('.file-row')).toHaveCount(2)
  await page.getByRole('button',{name:'Merge PDFs',exact:true}).click()
  const results = page.getByRole('region',{name:'Results',exact:true})
  await expect(results).toBeVisible()
  const download = page.waitForEvent('download')
  await results.getByRole('button',{name:/^Download /}).click()
  const file = await download
  const output = await readFile((await file.path())!)
  expect((await PDFDocument.load(output)).getPageCount()).toBe(2)
  const before = await page.locator('head').innerHTML()
  expect(before).not.toContain('synthetic-qa-canary')
  expect(before).not.toContain('PT-BQA-001 synthetic sentinel')
  expect(outbound).toEqual([])
  await page.getByRole('button',{name:'Start over',exact:true}).click()
  await expect(page.locator('.file-row')).toHaveCount(0)
  await expect(results).toHaveCount(0)
  expect(await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }))).toEqual({local:[],session:[]})
  await page.goto('trust/')
  expect(await page.locator('head').innerHTML()).not.toContain('synthetic-qa-canary')
  expect(outbound).toEqual([])
})
