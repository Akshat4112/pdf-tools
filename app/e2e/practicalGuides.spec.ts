import { test, expect, type Page } from '@playwright/test'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PDFDocument } from 'pdf-lib'
import { GUIDES, guidePath, guideByPath } from '../src/lib/guideCatalog'
import { guideHtml } from '../src/lib/guideContent'
import { guidePageMeta, GUIDE_INDEX_META } from '../src/lib/pageMetadata'

test('PT-SEO-009 guides: complete static articles and examples work without JavaScript', async ({ request, browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }), page = await context.newPage()
  for (const [path, title] of [['/guides', 'Practical PDF guides'], ...GUIDES.map(g => [guidePath(g), g.title])]) {
    const route = `/pdf-tools${path}/`, response = await request.get(route), html = await response.text()
    expect(response.ok()).toBe(true)
    expect(html).toContain(guideHtml(path))
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    const meta = path === '/guides' ? GUIDE_INDEX_META : guidePageMeta(guideByPath(path)!)
    expect(html).toContain(`<meta property="og:type" content="${meta.ogType}"`)
    await page.goto(`http://127.0.0.1:4178${route}`)
    await expect(page.getByRole('main')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible()
    for (const anchor of await page.locator('main a[download]').all()) {
      const href = await anchor.getAttribute('href')
      expect(href).toMatch(/^\/pdf-tools\/examples\/[a-z-]+\.(pdf|png)$/)
      const sample = await request.get(href!); expect(sample.ok()).toBe(true)
      expect((await sample.body()).length).toBeGreaterThan(100)
    }
  }
  await context.close()
})

test('PT-SEO-009 guides: responsive reading, keyboard links and SPA history stay public', async ({ page }, info) => {
  test.setTimeout(120_000)
  for (const width of [320, 1440]) for (const colorScheme of ['light','dark'] as const) {
    await page.setViewportSize({ width, height:900 }); await page.emulateMedia({ colorScheme, reducedMotion:'reduce' })
    for (const guide of GUIDES) {
      await page.goto(`guides/${guide.id}/`)
      await expect(page.locator('.guide-content')).toBeVisible()
      await expect(page).toHaveTitle(guidePageMeta(guide).title)
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href',guidePageMeta(guide).canonical)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const invalid = await page.locator('main a').evaluateAll(elements => elements.filter(el => { const r=el.getBoundingClientRect(); return r.width>0 && (r.width<44 || r.height<44 || r.left<0 || r.right>innerWidth+1) }).map(el=>el.textContent))
      expect(invalid).toEqual([])
      if (process.env.PDF_TOOLS_GUIDE_VISUAL_DIR && guide === GUIDES[1]) {
        // Public editorial content and links only; no selected documents, names or canvases.
        await expect(page.locator('input[type=file],canvas,.file-row')).toHaveCount(0)
        await mkdir(process.env.PDF_TOOLS_GUIDE_VISUAL_DIR,{recursive:true})
        await page.screenshot({path:join(process.env.PDF_TOOLS_GUIDE_VISUAL_DIR,`guide-${info.project.name}-${width}-${colorScheme}.png`),fullPage:true})
      }
    }
  }
  await page.goto('guides/')
  await expect(page.locator('.guide-directory')).toBeVisible()
  await expect(page).toHaveTitle(GUIDE_INDEX_META.title)
  const first = page.locator('main').getByRole('link',{name:GUIDES[0].title,exact:true})
  await first.focus(); await first.press('Enter')
  await expect(page.locator('.guide-content')).toBeVisible()
  await page.locator('main').getByRole('navigation',{name:'Tools used in this guide'}).getByRole('link',{name:'Merge PDF',exact:true}).click()
  await page.locator('input[type=file]').setInputFiles({name:'PRIVATE_GUIDE_SENTINEL.pdf',mimeType:'application/pdf',buffer:await readFile('dist/examples/cover.pdf')})
  await expect(page.locator('.file-row')).toHaveCount(1)
  const menu = page.locator('.folio-header').getByRole('button',{name:'Menu',exact:true})
  if (await menu.isVisible()) await menu.click()
  await page.locator('.folio-header').getByRole('link',{name:'Guides',exact:true}).click()
  await expect(page.locator('.guide-directory')).toBeVisible()
  expect(await page.locator('head').innerHTML()).not.toContain('PRIVATE_GUIDE_SENTINEL')
  await expect(page.locator('.file-row')).toHaveCount(0)
  await page.goBack(); await expect(page.locator('input[type=file]')).toHaveCount(1)
  await expect(page.locator('.file-row')).toHaveCount(0)
  await page.goBack(); await expect(page).toHaveTitle(guidePageMeta(GUIDES[0]).title)
  await page.goto('guides/unpublished-topic/')
  await expect(page.getByRole('heading',{name:"This page doesn't exist.",exact:true})).toBeVisible()
})

async function download(page: Page) {
  await expect(page.getByRole('region',{name:'Results',exact:true})).toBeVisible()
  const waiting = page.waitForEvent('download')
  await page.getByRole('button',{name:/^Download /}).first().click()
  const file = await waiting
  return new Uint8Array(await readFile((await file.path())!))
}
async function textPages(bytes: Uint8Array) {
  const task = getDocument({data:bytes.slice(),standardFontDataUrl:resolve('node_modules/pdfjs-dist/standard_fonts')+'/'})
  const doc = await task.promise
  try { return await Promise.all(Array.from({length:doc.numPages},async(_,i)=>(await (await doc.getPage(i+1)).getTextContent()).items.map(item=>'str' in item?item.str:'').join(' '))) }
  finally { await task.destroy() }
}

test('PT-SEO-009 guides: all four documented examples produce the stated results', async ({ page }) => {
  test.setTimeout(120_000)
  page.on('pageerror', error => { throw error })
  await page.route('**/*', route => { const url=new URL(route.request().url()); if(url.hostname!=='127.0.0.1'&&!['blob:','data:'].includes(url.protocol)) throw Error('Unexpected external request in guide example'); return route.continue() })
  await page.goto('merge/')
  await page.locator('input[type=file]').setInputFiles(['dist/examples/cover.pdf','dist/examples/appendix.pdf'])
  await page.getByRole('button',{name:'Merge PDFs',exact:true}).click()
  const merged = await textPages(await download(page))
  expect(merged).toHaveLength(3)
  for (const [i, marker] of ['SYNTHETIC_COVER','SYNTHETIC_APPENDIX_1','SYNTHETIC_APPENDIX_2'].entries()) expect(merged[i]).toContain(marker)

  await page.goto('extract-pages/')
  await page.locator('input[type=file]').setInputFiles('dist/examples/pages.pdf')
  await expect(page.getByRole('button',{name:'Page 1',exact:true})).toBeVisible()
  await page.getByRole('textbox',{name:'Pages to extract',exact:true}).fill('3, 1')
  await page.getByRole('button',{name:'Extract pages',exact:true}).click()
  const extracted = await textPages(await download(page))
  expect(extracted).toHaveLength(2); expect(extracted[0]).toContain('SYNTHETIC_PAGE_3'); expect(extracted[1]).toContain('SYNTHETIC_PAGE_1')

  await page.goto('images-to-pdf/')
  await page.locator('input[type=file]').setInputFiles(['dist/examples/landscape.png','dist/examples/portrait.png'])
  await page.getByRole('combobox',{name:'Page size',exact:true}).selectOption('original')
  await page.getByRole('combobox',{name:'Original size DPI',exact:true}).selectOption('96')
  await page.getByLabel('Margins (points)',{exact:true}).fill('0')
  await page.getByRole('button',{name:'Create PDF',exact:true}).click()
  const images = await PDFDocument.load(await download(page))
  expect(images.getPages().map(p=>[p.getWidth(),p.getHeight()])).toEqual([[480,300],[300,480]])

  await page.goto('pdf-to-text/')
  await page.locator('input[type=file]').setInputFiles('dist/examples/pages.pdf')
  await page.getByRole('button',{name:'Export text',exact:true}).click()
  const text = new TextDecoder('utf-8',{fatal:true}).decode(await download(page))
  for (const [i,part] of text.split('\f').entries()) { expect(part).toContain(`SYNTHETIC_PAGE_${i+1}`); expect(part).toContain('Invented sample sentence') }
  expect(text.split('\f')).toHaveLength(3)
  const scanText = await textPages(new Uint8Array(await readFile('dist/examples/scan.pdf')))
  expect(scanText).toEqual([''])
  await page.getByRole('button',{name:'Start over',exact:true}).click()
  await page.locator('input[type=file]').setInputFiles('dist/examples/scan.pdf')
  await page.getByRole('button',{name:'Export text',exact:true}).click()
  await expect(page.getByText(/No extractable text|No text|no text layer/i).first()).toBeVisible()
  await expect(page.getByRole('button',{name:/^Download /})).toHaveCount(0)
})
