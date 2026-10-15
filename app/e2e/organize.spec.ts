import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const fixture = (name: string) => path.resolve('../fixtures/pdf', name)
const THREE = 'F-001-plain-text-3p.pdf'
const choose = async (page: Page, route = 'organize/', file = THREE) => {
  await page.goto(route)
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Choose files', exact: true }).press('Enter')
  await (await chooser).setFiles(fixture(file))
  await expect(page.getByRole('button', { name: 'Output page 1, source page 1', exact: true })).toBeVisible()
}
const submit = (page: Page) => page.getByRole('button', { name: 'Create organized copy', exact: true })
const pick = (page: Page, position: number, source: number) => page.getByRole('button', { name: `Output page ${position}, source page ${source}`, exact: true })
const order = (page: Page, sources: number[]) => expect(page.getByText(`Output source order: ${sources.join(', ')}`, { exact: true })).toBeVisible()

async function download(page: Page) {
  await expect(page.getByRole('region', { name: 'Results' })).toBeVisible()
  const received = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Download / }).click()
  const file = await received
  const bytes = new Uint8Array(await readFile((await file.path())!))
  const written = await PDFDocument.load(bytes)
  const loading = getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: path.resolve('node_modules/pdfjs-dist/standard_fonts') + '/' })
  const document = await loading.promise
  const texts: string[] = []
  try {
    for (let i = 1; i <= document.numPages; i++) {
      const p = await document.getPage(i)
      texts.push((await p.getTextContent()).items.map(it => 'str' in it ? it.str : '').join(' '))
      p.cleanup()
    }
  } finally { await loading.destroy() }
  return { written, texts, name: file.suggestedFilename() }
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname !== '127.0.0.1' && url.protocol !== 'blob:' && url.protocol !== 'data:') throw new Error(`Unexpected external request: ${url.origin}`)
    return route.continue()
  })
})

test('keyboard reorder, independent duplicate rotation, deletion review and exact export', async ({ page }) => {
  await choose(page)
  await expect(submit(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Move earlier at position 3', exact: true }).press('Enter')
  await order(page, [1, 3, 2])
  await page.getByRole('button', { name: 'Duplicate at position 2', exact: true }).click()
  await order(page, [1, 3, 3, 2])
  await page.getByRole('button', { name: 'Rotate right at position 3', exact: true }).click()
  await expect(page.getByText('Final rotations: 0°, 0°, 90°, 0°', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete at position 1', exact: true }).click()
  await order(page, [3, 3, 2])
  await expect(submit(page)).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(submit(page)).toBeEnabled()
  await page.getByRole('button', { name: 'Rotate right at position 1', exact: true }).click()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('checkbox').check()
  await expect.poll(() => page.locator('.page-placeholder').count()).toBe(0)
  // The duplicated page's actual preview canvas rotates to landscape.
  expect(await pick(page, 2, 3).locator('canvas').evaluate(c => (c as HTMLCanvasElement).width > (c as HTMLCanvasElement).height)).toBe(true)
  await submit(page).click()
  const out = await download(page)
  expect(out.name).toBe('F-001-plain-text-3p-organized.pdf')
  expect(out.texts).toHaveLength(3)
  expect(out.texts.map(t => t.match(/PACKING-BOX-\d+/)?.[0])).toEqual(['PACKING-BOX-0003','PACKING-BOX-0003','PACKING-BOX-0002'])
  expect(out.written.getPages().map(p => p.getRotation().angle)).toEqual([0,90,0])
})

test('undo restores every edit; pointer drag uses the same order plan', async ({ page, isMobile }) => {
  await choose(page)
  await page.getByRole('button', { name: 'Rotate right at position 1', exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate at position 1', exact: true }).click()
  await page.getByRole('button', { name: 'Delete at position 4', exact: true }).click()
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await order(page, [1,2,3])
  await expect(page.getByText('Final rotations: 0°, 0°, 0°', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  if (!isMobile) {
    await page.locator('.organize-drag').nth(2).dragTo(pick(page,1,1))
  } else {
    await page.getByRole('button', { name: 'Move earlier at position 3', exact: true }).tap()
    await order(page, [1,3,2])
    await page.getByRole('button', { name: 'Move earlier at position 2', exact: true }).tap()
    await order(page, [3,1,2])
    await page.getByRole('button', { name: 'Restore original pages', exact: true }).tap()
    await order(page, [1,2,3])
    const handle = page.locator('.organize-drag').nth(1)
    await handle.scrollIntoViewIfNeeded()
    const from = (await handle.boundingBox())!
    // Drop onto the visible bottom of the earlier card, rather than an offscreen thumbnail.
    const to = (await page.locator('.organize-card-actions').first().boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    const begin = { x: from.x + from.width / 2, y: from.y + from.height / 2, id: 1 }
    const end = { x: to.x + to.width / 2, y: to.y + to.height / 2, id: 1 }
    expect(end.y).toBeGreaterThanOrEqual(0)
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [begin] })
      for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, x: begin.x + (end.x - begin.x) * step / 6, y: begin.y + (end.y - begin.y) * step / 6 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      // The raw touch protocol has no Playwright input epilogue: settle its final frame.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      await order(page, [2,1,3])
      // Keep one touch input stream for the drag and the following Undo tap.
      const undo = page.getByRole('button', { name: 'Undo', exact: true })
      await undo.scrollIntoViewIfNeeded()
      // Raw CDP coordinates must be read after the scrolled viewport is painted.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      const box = (await undo.boundingBox())!
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await order(page, [1,2,3])
    } finally { await cdp.detach() }
    await page.getByRole('button', { name: 'Move earlier at position 3', exact: true }).press('Enter')
    await order(page, [1,3,2])
    await page.getByRole('button', { name: 'Move earlier at position 2', exact: true }).press('Enter')
  }
  await order(page,[3,1,2])
  await page.getByRole('button', { name: 'Restore original pages', exact: true }).click()
  await order(page,[1,2,3])
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await order(page,[3,1,2])
})

test('position move crosses pagination and source replacement resets edits and history', async ({ page }) => {
  await choose(page, 'organize/', 'F-002-plain-text-30p.pdf')
  await expect(page.locator('.organize-grid canvas')).toHaveCount(8)
  await pick(page,1,1).click()
  await page.getByLabel('Move one selected page to position').fill('31')
  await expect(page.getByRole('button', { name: 'Move selected page', exact: true })).toBeDisabled()
  await page.getByLabel('Move one selected page to position').fill('30')
  await page.getByRole('button', { name: 'Move selected page', exact: true }).click()
  await expect(pick(page,30,1)).toBeVisible()
  await expect(page.locator('.organize-grid canvas')).toHaveCount(6)
  await page.getByRole('button', { name: 'Delete at position 30', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.locator('input[type=file]').setInputFiles(fixture(THREE))
  await order(page,[1,2,3])
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(submit(page)).toBeDisabled()
  await expect(page.locator('.organize-grid canvas')).toHaveCount(3)
})

test('single-page/all-page deletion is blocked and duplication quota is explicit', async ({ page }) => {
  const doc = await PDFDocument.create()
  doc.addPage()
  await page.goto('organize/')
  await page.locator('input[type=file]').setInputFiles({ name:'one.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save()) })
  await expect(page.getByRole('button', { name: 'Delete at position 1', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Select all pages', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Delete selected pages', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Duplicate at position 1', exact: true }).click()
  await page.getByRole('button', { name: 'Delete at position 1', exact: true }).click()
  await expect(page.locator('.organize-grid canvas')).toHaveCount(1)
  const full=await PDFDocument.create()
  for(let i=0;i<300;i++) full.addPage()
  await page.locator('input[type=file]').setInputFiles({name:'full.pdf',mimeType:'application/pdf',buffer:Buffer.from(await full.save())})
  await expect(page.getByRole('button', { name: 'Duplicate at position 1', exact: true })).toBeDisabled()
  await expect(page.locator('.organize-grid canvas')).toHaveCount(8)
})

test('Rotate selected/all composes pre-rotated pages and exports the visible angles', async ({ page }) => {
  await choose(page,'rotate/','F-004-rotated-pages.pdf')
  await expect(page.getByText('Final rotations: 0°, 90°, 180°, 270°', { exact:true })).toBeVisible()
  await expect(page.getByRole('button', { name:'Duplicate at position 1',exact:true })).toHaveCount(0)
  await pick(page,2,2).press('Space')
  await page.getByRole('button', {name:'Rotate selected right',exact:true}).click()
  await expect(page.getByText('Final rotations: 0°, 180°, 180°, 270°', {exact:true})).toBeVisible()
  await page.getByRole('button', {name:'Select all pages',exact:true}).click()
  await page.getByRole('button', {name:'Rotate selected left',exact:true}).click()
  await expect(page.getByText('Final rotations: 270°, 90°, 90°, 180°', {exact:true})).toBeVisible()
  await expect.poll(()=> page.locator('.page-placeholder').count()).toBe(0)
  await page.getByRole('button', {name:'Create rotated copy',exact:true}).click()
  const out=await download(page)
  expect(out.name.endsWith('-rotated.pdf')).toBe(true)
  expect(out.written.getPages().map(p=>p.getRotation().angle)).toEqual([270,90,90,180])
  expect(out.texts.map(t=>t.match(/ROTATE-FIXTURE-PAGE-\d+/)?.[0])).toEqual([1,2,3,4].map(n=>`ROTATE-FIXTURE-PAGE-${n}`))
})

test('mixed geometry survives reordered rotation and rendered controls fit the viewport', async ({ page }) => {
  await choose(page,'organize/','F-003-mixed-sizes.pdf')
  await page.getByRole('button', {name:'Move earlier at position 4',exact:true}).click()
  await page.getByRole('button', {name:'Rotate right at position 3',exact:true}).click()
  await expect.poll(()=> page.locator('.page-placeholder').count()).toBe(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await submit(page).click()
  const out=await download(page)
  const src=await PDFDocument.load(await readFile(fixture('F-003-mixed-sizes.pdf')))
  expect(out.written.getPages().map(p=>p.getSize())).toEqual([0,1,3,2].map(i=>src.getPage(i).getSize()))
  expect(out.written.getPages().map(p=>p.getRotation().angle)).toEqual([0,0,90,0])
})

test('download/reset/exit revoke object URLs and clear edit state', async ({ page }) => {
  await page.addInitScript(()=>{
    const urls=new Set<string>()
    const create=URL.createObjectURL.bind(URL), revoke=URL.revokeObjectURL.bind(URL)
    URL.createObjectURL=blob=>{const url=create(blob); if(blob instanceof Blob && blob.type==='application/pdf') urls.add(url); return url}
    URL.revokeObjectURL=url=>{urls.delete(url);revoke(url)}
    Object.assign(window,{pdfDownloadUrls:urls})
  })
  await choose(page)
  await page.getByRole('button',{name:'Rotate right at position 1',exact:true}).click()
  await submit(page).click()
  await download(page)
  expect(await page.evaluate(()=>(window as unknown as {pdfDownloadUrls:Set<string>}).pdfDownloadUrls.size)).toBe(1)
  await page.getByRole('button',{name:'Start over',exact:true}).click()
  expect(await page.evaluate(()=>(window as unknown as {pdfDownloadUrls:Set<string>}).pdfDownloadUrls.size)).toBe(0)
  await expect(page.locator('.organize-grid')).toHaveCount(0)
  await page.getByRole('button',{name:'Back',exact:true}).click()
  await page.getByRole('link', { name: 'Open Organize PDF', exact: true }).click()
  await expect(page.getByText('No files selected yet.',{exact:true})).toBeVisible()
})

test('encrypted/malformed inputs recover and cancellation cannot leak a late output', async ({ page }) => {
  await page.goto('organize/')
  await page.locator('input[type=file]').setInputFiles(fixture('F-010-encrypted-aes256.pdf'))
  await expect(page.getByText(/password-protected|encrypted/i).first()).toBeVisible()
  await expect(submit(page)).toBeDisabled()
  await page.locator('input[type=file]').setInputFiles(fixture('F-011-malformed-truncated.pdf'))
  await expect(page.getByText(/could not be read|invalid|malformed/i).first()).toBeVisible()
  await choose(page)
  await page.getByRole('button',{name:'Rotate right at position 1',exact:true}).click()
  let release!:()=>void
  const gate=new Promise<void>(resolve=>{release=resolve})
  await page.route('**/assets/pdf.worker.min.mjs',async route=>{await gate;await route.continue()})
  await submit(page).click()
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Cancelled',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Start over',exact:true}).click()
  release()
  await page.unroute('**/assets/pdf.worker.min.mjs')
  await expect(page.getByRole('region',{name:'Results'})).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles(fixture(THREE))
  await pick(page,1,1).waitFor()
  await page.getByRole('button',{name:'Rotate right at position 2',exact:true}).click()
  await submit(page).click()
  expect((await download(page)).written.getPages().map(p=>p.getRotation().angle)).toEqual([0,90,0])
})
