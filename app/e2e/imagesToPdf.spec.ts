import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { png, jpegExif, chunk, concat } from '../src/__tests__/imageFixtures'
const jpegPath='e2e/images-engine/corners.jpg'
const paperWhite=[255,255,255,255]
type Sample = [number,number]
const samples: Sample[]=[[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]]
async function choose(page:Page, images:{name:string;bytes:Uint8Array}[]) {
  await page.locator('input[type="file"]').setInputFiles(images.map(file=>({name:file.name,mimeType:file.name.endsWith('.jpg')?'image/jpeg':'image/png',buffer:Buffer.from(file.bytes)})))
}
async function previews(page:Page, at=samples) {
  await expect(page.locator('.image-preview-card')).not.toHaveCount(0)
  await expect.poll(()=>page.locator('.page-placeholder').count()).toBe(0)
  return page.locator('.image-preview-card canvas').evaluateAll((canvases,at)=>canvases.map(element=>{
    const canvas=element as HTMLCanvasElement, ctx=canvas.getContext('2d')!
    return {width:canvas.width,height:canvas.height,colors:at.map(([x,y])=>Array.from(ctx.getImageData(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1).data))}
  }),at)
}
async function exported(page:Page, at=samples) {
  await page.getByRole('button',{name:'Create PDF',exact:true}).click()
  await expect(page.getByRole('region',{name:'Results'})).toBeVisible()
  const received=page.waitForEvent('download');await page.getByRole('button',{name:/^Download /}).click()
  const download=await received
  expect(download.suggestedFilename()).toMatch(/-images\.pdf$/)
  const bytes=Array.from(new Uint8Array(await readFile((await download.path())!)))
  return page.evaluate(async({bytes,at})=>{
    const moduleUrl='/pdf-tools/verification/pdf.mjs'
    const pdfjs=await import(moduleUrl) as typeof import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc='/pdf-tools/assets/pdf.worker.min.mjs'
    const loading=pdfjs.getDocument({data:new Uint8Array(bytes)}), doc=await loading.promise, pages=[]
    try {
      for(let i=1;i<=doc.numPages;i++) {
        const p=await doc.getPage(i), original=p.getViewport({scale:1}), viewport=p.getViewport({scale:Math.min(280/original.width,360/original.height)}),canvas=document.createElement('canvas')
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
        const ctx=canvas.getContext('2d')!
        try {
          await p.render({canvas,canvasContext:ctx,viewport,background:'rgb(0,0,0)'}).promise
          pages.push({width:original.width,height:original.height,colors:at.map(([x,y])=>Array.from(ctx.getImageData(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1).data))})
        } finally {p.cleanup();canvas.width=0;canvas.height=0}
      }
    } finally {await loading.destroy()}
    return pages
  },{bytes,at})
}
function matches(actual:number[][],wanted:number[][],tolerance=12) {
  actual.forEach((color,i)=>color.forEach((channel,j)=>expect(Math.abs(channel-wanted[i][j])).toBeLessThanOrEqual(tolerance)))
}
test.beforeEach(async({page})=>{
  page.on('pageerror',error=>{throw error})
  await page.route('**/verification/pdf.mjs',route=>route.fulfill({path:'node_modules/pdfjs-dist/legacy/build/pdf.mjs',contentType:'application/javascript'}))
  await page.route('**/*',route=>{
    const url=new URL(route.request().url())
    if(url.hostname!=='127.0.0.1' && !['blob:','data:'].includes(url.protocol))throw new Error(`Unexpected external request: ${url.origin}`)
    return route.fallback()
  })
  await page.goto('images-to-pdf/')
})

test('mixed image orientations preview exactly as exported, including mirrored EXIF and alpha',async({page})=>{
  const jpg=new Uint8Array(await readFile(jpegPath))
  await choose(page,Array.from({length:8},(_,i)=>({name:`orientation-${i+1}${i<4?'.jpg':'.png'}`,bytes:i<4?jpegExif(jpg,i+1):png(80,40,i+1,i===7)})))
  await page.getByRole('combobox',{name:'Page size',exact:true}).selectOption('original')
  await page.getByRole('combobox',{name:'Original size DPI',exact:true}).selectOption('96')
  await page.getByLabel('Margins (points)').fill('0')
  await expect(page.getByRole('combobox',{name:'Page orientation',exact:true})).toBeDisabled()
  const preview=await previews(page), output=await exported(page)
  expect(output).toHaveLength(8)
  output.forEach((p,i)=>{expect([p.width,p.height]).toEqual(i<4?[60,30]:[30,60]);matches(p.colors,preview[i].colors)})
})

test('A4 and Letter, contain and crop modes keep the preview and PDF in agreement',async({page},testInfo)=>{
  const points:Sample[]=[[0.01,0.5],[0.5,0.01],[0.25,0.1],[0.25,0.4]]
  for(const config of [{size:'a4',fit:'contain',orientation:'auto',dimensions:[841.89,595.276]},{size:'letter',fit:'contain',orientation:'portrait',dimensions:[612,792]},{size:'letter',fit:'cover',orientation:'portrait',dimensions:[612,792]}]) {
    await choose(page,[{name:'landscape.png',bytes:png()}])
    await page.getByRole('combobox',{name:'Page size',exact:true}).selectOption(config.size)
    await page.getByRole('combobox',{name:'Page orientation',exact:true}).selectOption(config.orientation)
    await page.getByRole('combobox',{name:'Image fit',exact:true}).selectOption(config.fit)
    await page.getByLabel('Margins (points)').fill('36')
    const preview=await previews(page,points)
    const fitting=await page.locator('.image-settings-grid select, .image-settings-grid input, .image-preview-card canvas').evaluateAll(elements=>elements.every(element=>{const bounds=element.getBoundingClientRect();return bounds.width>0 && bounds.left>=0 && bounds.right<=window.innerWidth}))
    expect(fitting).toBe(true)
    if(process.env.PDF_TOOLS_VISUAL_DIR && config.fit==='cover')await page.screenshot({path:`${process.env.PDF_TOOLS_VISUAL_DIR}/images-${testInfo.project.name}.png`,fullPage:true})
    const output=await exported(page,points)
    expect([output[0].width,output[0].height]).toEqual(config.dimensions)
    matches(output[0].colors,preview[0].colors,1)
    expect(output[0].colors.slice(0,2)).toEqual([paperWhite,paperWhite])
    if(config.orientation==='portrait')expect(output[0].colors[2]).toEqual(config.fit==='cover'?[255,0,0,255]:paperWhite)
    await page.getByRole('button',{name:'Start over',exact:true}).click()
  }
})

test('keyboard reorder, remove, append, pagination and clear produce the visible order',async({page})=>{
  await choose(page,Array.from({length:9},(_,i)=>({name:`image-${i+1}.png`,bytes:png(80+i*4,40)})))
  await expect(page.locator('.image-preview-card')).toHaveCount(8)
  await page.getByRole('button',{name:'Next images',exact:true}).click()
  await expect(page.locator('.image-preview-card')).toHaveCount(1)
  const earlier=page.getByRole('button',{name:'Move earlier: image-9.png',exact:true});await earlier.focus();await page.keyboard.press('Space')
  await expect(page.locator('.file-row').nth(7)).toContainText('image-9.png')
  await page.getByRole('button',{name:'Remove this file: image-1.png',exact:true}).click()
  await choose(page,[{name:'added.png',bytes:png(120,40)}])
  await expect(page.locator('.file-row')).toHaveCount(9)
  await page.getByRole('combobox',{name:'Page size',exact:true}).selectOption('original');await page.getByRole('combobox',{name:'Original size DPI',exact:true}).selectOption('96');await page.getByLabel('Margins (points)').fill('0')
  const output=await exported(page)
  expect(output.map(p=>p.width)).toEqual([84,88,92,96,100,104,112,108,120].map(n=>n*.75))
  await page.getByRole('button',{name:'Start over',exact:true}).click()
  await choose(page,[{name:'fresh.png',bytes:png()}]);await page.getByRole('button',{name:'Clear files',exact:true}).click()
  await expect(page.locator('.image-preview-card')).toHaveCount(0)
  await expect(page.getByText('No images selected yet.')).toBeVisible()
  await expect(page.getByRole('button',{name:'Create PDF',exact:true})).toBeDisabled()
})

test('invalid images and invalid settings recover; quotas reject before image decoding',async({page})=>{
  const header=new Uint8Array(13), v=new DataView(header.buffer);v.setUint32(0,100000);v.setUint32(4,100000);header[8]=8;header[9]=6
  const normal=png(),huge=concat(normal.subarray(0,8),chunk('IHDR',header),normal.subarray(33))
  await choose(page,[{name:'broken.png',bytes:new Uint8Array([137,80,78,71,13,10,26,10])},{name:'huge.png',bytes:huge},{name:'wrong.pdf',bytes:new TextEncoder().encode('%PDF-1.7\n')},{name:'valid.png',bytes:png()}])
  await expect(page.locator('.file-row.is-error')).toHaveCount(3)
  await expect(page.getByText('Files marked with errors are left out. Remove them or choose a replacement.')).toBeVisible()
  await page.getByLabel('Margins (points)').fill('')
  await expect(page.getByRole('button',{name:'Create PDF',exact:true})).toBeDisabled()
  await page.getByLabel('Margins (points)').fill('500')
  await expect(page.getByRole('button',{name:'Create PDF',exact:true})).toBeDisabled()
  await page.getByLabel('Margins (points)').fill('18')
  await expect(page.getByRole('button',{name:'Create PDF',exact:true})).toBeEnabled()
  await page.evaluate(()=>{
    const input=document.querySelector('input[type="file"]') as HTMLInputElement, transfer=new DataTransfer()
    for(let i=0;i<301;i++)transfer.items.add(new File(['x'],`extra-${i}.png`))
    input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))
  })
  await expect(page.getByText(/Choose at most 300 files/)).toBeVisible()
  expect(await exported(page)).toHaveLength(1)
})

test('download URLs are reused/revoked and cancellation discards a late conversion',async({page})=>{
  await page.addInitScript(()=>{
    const live=new Set<string>(), create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL)
    URL.createObjectURL=blob=>{const url=create(blob);if(blob instanceof Blob && blob.type==='application/pdf')live.add(url);return url}
    URL.revokeObjectURL=url=>{live.delete(url);revoke(url)}
    const decode=createImageBitmap.bind(window)
    Object.assign(window,{pdfDownloadUrls:live,holdImageDecode:false,pendingImageDecodes:[]})
    window.createImageBitmap=((...args:Parameters<typeof createImageBitmap>)=>{
      const state=window as unknown as {holdImageDecode:boolean;pendingImageDecodes:(()=>void)[]}
      return state.holdImageDecode?new Promise<ImageBitmap>((resolve,reject)=>state.pendingImageDecodes.push(()=>{decode(...args).then(resolve,reject)})):decode(...args)
    }) as typeof createImageBitmap
  })
  await page.reload()
  await choose(page,[{name:'alpha.png',bytes:png(80,40,undefined,true)}]);await previews(page);await exported(page)
  const count=()=>page.evaluate(()=>(window as unknown as {pdfDownloadUrls:Set<string>}).pdfDownloadUrls.size)
  expect(await count()).toBe(1)
  const again=page.waitForEvent('download');await page.getByRole('button',{name:/^Download /}).click();await again;expect(await count()).toBe(1)
  await page.getByRole('button',{name:'Start over',exact:true}).click();expect(await count()).toBe(0)
  await choose(page,[{name:'cancel.png',bytes:png()}]);await previews(page)
  await page.evaluate(()=>Object.assign(window,{holdImageDecode:true}))
  await page.getByRole('button',{name:'Create PDF',exact:true}).click();await expect(page.getByRole('region',{name:'Processing'})).toBeVisible()
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('status',{name:'Cancelled'})).toBeVisible()
  await page.getByRole('button',{name:'Start over',exact:true}).click()
  await page.evaluate(()=>{const state=window as unknown as {holdImageDecode:boolean;pendingImageDecodes:(()=>void)[]};state.holdImageDecode=false;state.pendingImageDecodes.splice(0).forEach(release=>release())})
  await expect(page.getByText('No images selected yet.')).toBeVisible();await expect(page.getByRole('region',{name:'Results'})).toHaveCount(0)
  await choose(page,[{name:'retry.png',bytes:png()}]);await exported(page)
  await page.getByRole('button',{name:'Continue to another tool',exact:true}).click();expect(await count()).toBe(0)
})

test('file-size guards skip reads, and clear/exit discard pending file reads',async({page})=>{
  await page.addInitScript(()=>{
    const read=File.prototype.arrayBuffer
    Object.assign(window,{holdFileReads:false,pendingFileReads:[],imageFileReads:0})
    File.prototype.arrayBuffer=function(){
      const state=window as unknown as {holdFileReads:boolean;pendingFileReads:(()=>void)[];imageFileReads:number}
      state.imageFileReads++
      return state.holdFileReads?new Promise<ArrayBuffer>((resolve,reject)=>state.pendingFileReads.push(()=>{read.call(this).then(resolve,reject)})):read.call(this)
    }
  })
  await page.reload()
  await page.evaluate(()=>{
    const transfer=new DataTransfer(),file=new File(['small payload'],'too-large.png')
    Object.defineProperty(file,'size',{value:50*1024*1024+1});transfer.items.add(file)
    const input=document.querySelector('input[type="file"]') as HTMLInputElement;input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))
  })
  await expect(page.getByText('This file exceeds 50 MB. Choose a smaller file.')).toBeVisible()
  expect(await page.evaluate(()=>(window as unknown as {imageFileReads:number}).imageFileReads)).toBe(0)
  await page.getByRole('button',{name:'Clear files',exact:true}).click()
  await choose(page,[{name:'retained.png',bytes:png()}]);await previews(page)
  await page.evaluate(()=>Object.assign(window,{holdFileReads:true}))
  await choose(page,[{name:'pending.png',bytes:png()}])
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {pendingFileReads:unknown[]}).pendingFileReads.length)).toBe(1)
  await page.getByRole('button',{name:'Clear files',exact:true}).click()
  const release=()=>page.evaluate(()=>{const state=window as unknown as {holdFileReads:boolean;pendingFileReads:(()=>void)[]};state.holdFileReads=false;state.pendingFileReads.splice(0).forEach(resolve=>resolve())})
  await release();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(null)))));await expect(page.locator('.file-row')).toHaveCount(0)
  await choose(page,[{name:'fresh.png',bytes:png()}]);await previews(page)
  await page.evaluate(()=>Object.assign(window,{holdFileReads:true}))
  await choose(page,[{name:'exit.png',bytes:png()}])
  await page.getByRole('button',{name:'Back',exact:true}).click();await release()
  await page.goto('images-to-pdf/');await expect(page.getByText('No images selected yet.')).toBeVisible()
})
