import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js'
import { readImageMetadata } from '../src/engines/imageMetadata'
async function demo(count=3) {
  const pdf=await PDFDocument.create()
  for(let i=0;i<count;i++) {
    const p=pdf.addPage([72,36])
    p.drawRectangle({x:0,y:18,width:36,height:18,color:rgb(i===0?1:0,i===1?1:0,i>=2?1:0),opacity:i===2?0.5:1})
    if(i===1)p.setRotation(degrees(90))
  }
  return new Uint8Array(await pdf.save())
}
async function choose(page:Page,bytes:Uint8Array|undefined=undefined,name='demo.pdf') {
  await page.locator('input[type="file"]').setInputFiles({name,mimeType:'application/pdf',buffer:Buffer.from(bytes ?? await demo())})
  await expect(page.locator('.file-row .file-name')).toHaveText(name)
  await expect(page.getByRole('button',{name:'Page 1',exact:true})).toBeVisible()
}
async function create(page:Page) {
  await expect(page.getByRole('button',{name:'Create images',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'Create images',exact:true}).click()
  await expect(page.getByRole('region',{name:'Results'})).toBeVisible()
  await expect.poll(()=>page.getByRole('region',{name:'Results'}).locator('.page-placeholder').count()).toBe(0)
}
async function download(page:Page,name:string|RegExp) {
  const received=page.waitForEvent('download')
  await page.getByRole('button',{name,exact:typeof name==='string'}).click()
  const file=await received
  return {name:file.suggestedFilename(),bytes:new Uint8Array(await readFile((await file.path())!))}
}
async function archive(bytes:Uint8Array) {
  const reader=new ZipReader(new Uint8ArrayReader(bytes)),images=[]
  try {for(const entry of await reader.getEntries()) {if(entry.directory)throw new Error('Unexpected directory');const bytes=await entry.getData!(new Uint8ArrayWriter(),{checkSignature:true});images.push({name:entry.filename,bytes,meta:readImageMetadata(bytes)})}}finally{await reader.close()}
  return images
}
async function pixels(page:Page,selector:string) {
  return page.locator(selector).evaluate(element=>{
    const canvas=element as HTMLCanvasElement, context=canvas.getContext('2d')!
    return [[0.25,0.25],[0.75,0.75]].map(([x,y])=>Array.from(context.getImageData(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1).data))
  })
}

test.beforeEach(async({page})=>{
  page.on('pageerror',error=>{throw error})
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1' && !['blob:','data:'].includes(url.protocol))throw new Error(`Unexpected external request: ${url.origin}`);return route.continue()})
})

test('PNG page order, dimensions, transparency and individual downloads match the ZIP',async({page},testInfo)=>{
  await page.goto('pdf-to-png/');await choose(page)
  await expect(page.getByRole('combobox',{name:'Image format',exact:true})).toHaveValue('png')
  await page.getByRole('combobox',{name:'Resolution',exact:true}).selectOption('96')
  await page.getByRole('combobox',{name:'PNG background',exact:true}).selectOption('transparent')
  await page.getByRole('textbox',{name:'Pages to convert',exact:true}).fill('3, 2, 1, 3')
  await expect(page.getByText('Output page order: 3, 2, 1',{exact:true})).toBeVisible()
  await page.getByText('View dimensions for 3 selected pages',{exact:true}).click()
  await expect(page.getByText('Page 2: 48 × 96 px',{exact:true})).toBeVisible()
  await expect(page.getByText(/This is a pixel-memory estimate, not the encoded download size/)).toBeVisible()
  await expect.poll(()=>page.locator('.page-placeholder').count()).toBe(0)
  const preview=await pixels(page,'button[aria-label="Page 3"] canvas')
  expect(preview[0][3]).toBeGreaterThanOrEqual(127);expect(preview[0][3]).toBeLessThanOrEqual(128);expect(preview[1][3]).toBe(0)
  const fitting=await page.locator('.image-settings-grid select, .image-settings-grid input, .page-grid canvas').evaluateAll(elements=>elements.every(element=>{const bounds=element.getBoundingClientRect();return bounds.width>0 && bounds.left>=0 && bounds.right<=innerWidth}))
  expect(fitting).toBe(true)
  if(process.env.PDF_TOOLS_VISUAL_DIR)await page.screenshot({path:`${process.env.PDF_TOOLS_VISUAL_DIR}/pdf-images-settings-${testInfo.project.name}.png`,fullPage:true})
  await create(page)
  expect(await pixels(page,'article[aria-label="Image from page 3"] canvas')).toEqual(preview)
  const zip=await download(page,'Download all as ZIP'),images=await archive(zip.bytes)
  expect(zip.name).toBe('demo-png.zip');expect(images.map(image=>image.name)).toEqual(['demo-page-3.png','demo-page-2.png','demo-page-1.png'])
  expect(images.map(image=>[image.meta.width,image.meta.height])).toEqual([[96,48],[48,96],[96,48]])
  const individual=await download(page,'Download demo-page-3.png');expect(individual.bytes).toEqual(images[0].bytes)
  if(process.env.PDF_TOOLS_VISUAL_DIR)await page.screenshot({path:`${process.env.PDF_TOOLS_VISUAL_DIR}/pdf-images-results-${testInfo.project.name}.png`,fullPage:true})
})

test('JPG quality, DPI choices and format switches produce real encoded files',async({page})=>{
  await page.goto('pdf-to-jpg/');await choose(page,await demo(1))
  await expect(page.getByRole('combobox',{name:'Image format',exact:true})).toHaveValue('jpeg')
  await page.getByLabel('JPG quality (%)').fill('')
  await expect(page.getByRole('button',{name:'Create images',exact:true})).toBeDisabled()
  await expect(page.getByRole('textbox',{name:'Pages to convert',exact:true})).toHaveAttribute('aria-invalid','false')
  await expect(page.getByRole('button',{name:'Page 1',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByLabel('JPG quality (%)').fill('101');await expect(page.getByRole('button',{name:'Create images',exact:true})).toBeDisabled()
  await page.getByLabel('JPG quality (%)').fill('95')
  for(const dpi of [96,150,200]) {
    await page.getByRole('combobox',{name:'Resolution',exact:true}).selectOption(String(dpi))
    await create(page)
    const images=await archive((await download(page,'Download all as ZIP')).bytes)
    expect(images[0].meta).toMatchObject({kind:'jpeg',width:dpi,height:dpi/2})
    expect((await pixels(page,'.pdf-images-results canvas'))[1]).toEqual([255,255,255,255])
    await page.getByRole('button',{name:'Adjust settings',exact:true}).click()
  }
  await page.getByRole('combobox',{name:'Image format',exact:true}).selectOption('png')
  await page.getByRole('combobox',{name:'PNG background',exact:true}).selectOption('transparent')
  await page.getByRole('combobox',{name:'Image format',exact:true}).selectOption('jpeg')
  await expect(page.getByRole('combobox',{name:'PNG background',exact:true})).toHaveCount(0)
  await expect(page.getByLabel('JPG quality (%)')).toHaveValue('80')
  await create(page);expect((await archive((await download(page,'Download all as ZIP')).bytes))[0].meta.kind).toBe('jpeg')
})

test('keyboard page selection, bounded pagination and source replacement reset the visible plan',async({page})=>{
  await page.goto('pdf-to-png/');await choose(page,await demo(9))
  await expect(page.locator('.page-grid canvas')).toHaveCount(8)
  await page.getByRole('button',{name:'Clear page selection',exact:true}).click()
  await page.getByRole('button',{name:'Next pages',exact:true}).click()
  await expect(page.locator('.page-grid canvas')).toHaveCount(1)
  const ninth=page.getByRole('button',{name:'Page 9',exact:true});await ninth.focus();await page.keyboard.press('Space')
  await page.getByRole('button',{name:'Previous pages',exact:true}).click()
  const first=page.getByRole('button',{name:'Page 1',exact:true});await first.focus();await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox',{name:'Pages to convert',exact:true})).toHaveValue('9, 1')
  await page.getByRole('button',{name:'Select all pages',exact:true}).click();await create(page)
  await expect(page.locator('.pdf-images-results canvas')).toHaveCount(8)
  await page.getByRole('button',{name:'Next images',exact:true}).click();await expect(page.locator('.pdf-images-results canvas')).toHaveCount(1)
  await expect(page.getByRole('article',{name:'Image from page 9',exact:true})).toBeVisible()
  const out=await archive((await download(page,'Download all as ZIP')).bytes);expect(out).toHaveLength(9)
  await page.getByRole('button',{name:'Adjust settings',exact:true}).click()
  await choose(page,await demo(1),'replacement.pdf')
  await expect(page.getByRole('textbox',{name:'Pages to convert',exact:true})).toHaveValue('1')
  await expect(page.locator('.page-grid canvas')).toHaveCount(1)
  await create(page);expect((await archive((await download(page,'Download all as ZIP')).bytes)).map(image=>image.name)).toEqual(['replacement-page-1.png'])
})

test('input errors, invalid ranges and size limits recover without exposing a result',async({page})=>{
  await page.goto('pdf-to-png/')
  await page.locator('input[type="file"]').setInputFiles('../fixtures/pdf/F-010-encrypted-aes256.pdf')
  await expect(page.getByText(/password-protected/)).toBeVisible();await expect(page.getByRole('button',{name:'Create images',exact:true})).toBeDisabled()
  await page.locator('input[type="file"]').setInputFiles({name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-broken')})
  await expect(page.getByText('This file could not be read as a PDF.',{exact:true}).first()).toBeVisible()
  const pdf=await PDFDocument.create();pdf.addPage([2300,2300]);await choose(page,new Uint8Array(await pdf.save()),'large.pdf')
  await page.getByRole('combobox',{name:'Resolution',exact:true}).selectOption('200')
  await expect(page.getByRole('button',{name:'Create images',exact:true})).toBeDisabled();await expect(page.getByText(/This page exceeds the image size limit/).first()).toBeVisible()
  await page.getByRole('combobox',{name:'Resolution',exact:true}).selectOption('96');await expect(page.getByRole('button',{name:'Create images',exact:true})).toBeEnabled()
  await choose(page,await demo(1),'small.pdf')
  for(const value of ['', '2', 'broken']) {await page.getByRole('textbox',{name:'Pages to convert',exact:true}).fill(value);await expect(page.getByRole('button',{name:'Create images',exact:true})).toBeDisabled()}
  await page.getByRole('button',{name:'Select all pages',exact:true}).click();await create(page)
  await page.getByRole('button',{name:'Start over',exact:true}).click()
  await expect(page.getByText('No files selected yet.')).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0)
})

test('downloads reuse correct URLs and adjust/reset/exit revoke them',async({page})=>{
  await page.addInitScript(()=>{
    const live=new Set<string>(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL)
    URL.createObjectURL=blob=>{const url=create(blob);if(blob instanceof Blob && ['application/zip','image/png','image/jpeg'].includes(blob.type))live.add(url);return url}
    URL.revokeObjectURL=url=>{live.delete(url);revoke(url)}
    Object.assign(window,{imageDownloadUrls:live})
  })
  await page.goto('pdf-to-png/');await choose(page,await demo(1));await create(page)
  const count=()=>page.evaluate(()=>(window as unknown as {imageDownloadUrls:Set<string>}).imageDownloadUrls.size)
  expect(await count()).toBe(0)
  const zip=await download(page,'Download all as ZIP');const image=await download(page,'Download demo-page-1.png')
  expect((await archive(zip.bytes))[0].bytes).toEqual(image.bytes)
  await download(page,'Download all as ZIP');await download(page,'Download demo-page-1.png');expect(await count()).toBe(2)
  await page.getByRole('button',{name:'Adjust settings',exact:true}).click();expect(await count()).toBe(0)
  await create(page);await download(page,'Download all as ZIP');await page.getByRole('button',{name:'Start over',exact:true}).click();expect(await count()).toBe(0)
  await choose(page,await demo(1));await create(page);await download(page,'Download demo-page-1.png')
  await page.getByRole('button',{name:'Back to all tools',exact:true}).click();expect(await count()).toBe(0);await expect(page.locator('.pdf-images-results')).toHaveCount(0)
})

test('cancellation during image verification discards late output and a new job succeeds',async({page})=>{
  await page.addInitScript(()=>{
    const decode=createImageBitmap.bind(window)
    Object.assign(window,{holdRasterDecode:false,pendingRasterDecodes:[]})
    window.createImageBitmap=((...args:Parameters<typeof createImageBitmap>)=>{
      const state=window as unknown as {holdRasterDecode:boolean;pendingRasterDecodes:(()=>void)[]}
      return state.holdRasterDecode?new Promise<ImageBitmap>((resolve,reject)=>state.pendingRasterDecodes.push(()=>{decode(...args).then(resolve,reject)})):decode(...args)
    }) as typeof createImageBitmap
  })
  await page.goto('pdf-to-png/');await choose(page,await demo(1));await expect(page.getByRole('button',{name:'Create images',exact:true})).toBeEnabled()
  await page.evaluate(()=>Object.assign(window,{holdRasterDecode:true}))
  await page.getByRole('button',{name:'Create images',exact:true}).click();await expect(page.getByRole('region',{name:'Processing'})).toBeVisible()
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {pendingRasterDecodes:unknown[]}).pendingRasterDecodes.length)).toBeGreaterThan(0)
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('status',{name:'Cancelled'})).toBeVisible()
  await page.getByRole('button',{name:'Start over',exact:true}).click()
  await page.evaluate(()=>{const state=window as unknown as {holdRasterDecode:boolean;pendingRasterDecodes:(()=>void)[]};state.holdRasterDecode=false;state.pendingRasterDecodes.splice(0).forEach(resolve=>resolve())})
  await expect(page.getByRole('region',{name:'Results'})).toHaveCount(0);await expect(page.getByText('No files selected yet.')).toBeVisible()
  await choose(page,await demo(1),'retry.pdf');await create(page);expect((await archive((await download(page,'Download all as ZIP')).bytes))[0].name).toBe('retry-page-1.png')
})
