import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument, PDFName, PDFNumber, PDFString, StandardFonts, degrees } from 'pdf-lib'

async function sourcePdf() {
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica)
  for(const [index,rotation] of [0,90,180,270].entries()) {
    const page=pdf.addPage([500,400]);page.setCropBox(20,30,400,300);page.setRotation(degrees(rotation))
    if(index===3)page.node.set(PDFName.of('UserUnit'),PDFNumber.of(2))
    page.drawText(`SOURCE-${index+1}`,{x:70,y:180,size:14,font})
  }
  const hidden=pdf.context.register(pdf.context.obj({Type:'OCG',Name:PDFString.of('Hidden layer')}))
  pdf.catalog.set(PDFName.of('OCProperties'),pdf.context.obj({OCGs:[hidden],D:{BaseState:'ON',OFF:[hidden],Order:[hidden]}}))
  const first=pdf.getPage(0);first.node.Resources()!.set(PDFName.of('Properties'),pdf.context.obj({Hidden:hidden}))
  first.node.addContentStream(pdf.context.register(pdf.context.flateStream('q /OC /Hidden BDC 1 0 0 rg 20 30 300 200 re f EMC Q')))
  return Buffer.from(await pdf.save())
}
async function choose(page:Page,bytes?:Buffer,name='local.pdf') {
  await page.locator('input[type="file"]').setInputFiles({name,mimeType:'application/pdf',buffer:bytes??await sourcePdf()})
  await expect(page.locator('.file-row .file-name')).toHaveText(name)
}
async function preview(page:Page) { await expect(page.getByText('Preview ready',{exact:true})).toBeVisible() }
async function download(page:Page) {
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:/^Download .*\.pdf/}).click()
  const file=await waiting;return {bytes:await readFile((await file.path())!),name:file.suggestedFilename()}
}
async function inspect(page:Page,bytes:Buffer) {
  return page.evaluate(async data=>{
    const moduleUrl='/__overlay-pdfjs.mjs',pdfjs=await import(moduleUrl)
    pdfjs.GlobalWorkerOptions.workerSrc='/pdf-tools/assets/pdf.worker.min.mjs'
    const task=pdfjs.getDocument({data:new Uint8Array(data),isEvalSupported:false,standardFontDataUrl:'/pdf-tools/assets/standard_fonts/'})
    const doc=await task.promise.catch((error:Error)=>{throw new Error(error.message)}),results=[]
    try { for(let i=1;i<=doc.numPages;i++) {
      const source=await doc.getPage(i),base=source.getViewport({scale:1}),viewport=source.getViewport({scale:Math.min(600/base.width,800/base.height)})
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
      await source.render({canvas,canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise
      const text=(await source.getTextContent()).items.filter((item:{str?:string})=>item.str).map((item:{str:string})=>item.str)
      results.push({text,rotation:source.rotate,width:base.width,height:base.height,image:canvas.toDataURL()});source.cleanup()
    } return results } finally {await task.destroy()}
  },Array.from(bytes)) as Promise<Array<{text:string[];rotation:number;width:number;height:number;image:string}>>
}
test.beforeEach(async({page})=>{
  page.on('pageerror',error=>{throw error})
  await page.route('**/__overlay-pdfjs.mjs',async route=>route.fulfill({contentType:'text/javascript',body:await readFile('node_modules/pdfjs-dist/build/pdf.mjs')}))
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'&&!['blob:','data:'].includes(url.protocol))throw new Error(`External request: ${url.origin}`);return route.fallback()})
})

test('numbering selected pages preserves geometry and downloaded pixels match each rotated preview',async({page},info)=>{
  await page.goto('page-numbers/');await choose(page)
  await page.getByLabel('Starting number',{exact:true}).fill('7');await page.getByLabel('Pages to modify',{exact:true}).fill('4, 2')
  const images:string[]=[]
  for(let number=1;number<=4;number++){
    await page.getByLabel('Preview page',{exact:true}).fill(String(number));await preview(page)
    images.push(await page.locator('.overlay-canvas canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL()))
  }
  await expect(page.getByText('This page will receive: 8', {exact:false})).toBeVisible()
  expect(await page.locator('.overlay-settings input,.overlay-settings select,.overlay-canvas canvas').evaluateAll(items=>items.every(item=>{const rect=item.getBoundingClientRect();return rect.width>0&&rect.left>=0&&rect.right<=innerWidth}))).toBe(true)
  if(process.env.PDF_TOOLS_VISUAL_DIR)await page.screenshot({path:`${process.env.PDF_TOOLS_VISUAL_DIR}/numbers-${info.project.name}.png`,fullPage:true})
  await page.getByRole('button',{name:'Apply page numbers',exact:true}).click();const file=await download(page),result=await inspect(page,file.bytes)
  expect(file.name).toBe('local-numbered.pdf');expect(result).toHaveLength(4)
  for(const [index,item] of result.entries()){
    expect(item.rotation).toBe(index*90);expect(item.text).toContain(`SOURCE-${index+1}`);expect(item.image).toBe(images[index])
    expect(item.text.filter(text=>text!==`SOURCE-${index+1}`)).toEqual(index===1?['7']:index===3?['8']:[])
  }
  expect(result.map(item=>[item.width,item.height])).toEqual([[400,300],[300,400],[400,300],[600,800]])
})

test('German watermark supports real embedded text, all anchors and deliberate unsupported replacement',async({page},info)=>{
  await page.goto('watermark/');await choose(page);await page.getByLabel('Watermark text',{exact:true}).fill('Prüfung Straße €')
  await page.getByLabel('Font size (pt)',{exact:true}).fill('24');await page.getByLabel('Opacity (%)',{exact:true}).fill('35')
  for(const position of ['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right','center','diagonal-center']){
    await page.getByRole('combobox',{name:'Position',exact:true}).selectOption(position);await preview(page)
  }
  if(process.env.PDF_TOOLS_VISUAL_DIR)await page.screenshot({path:`${process.env.PDF_TOOLS_VISUAL_DIR}/watermark-${info.project.name}.png`,fullPage:true})
  await page.getByRole('button',{name:'Apply watermark',exact:true}).click();const german=await inspect(page,(await download(page)).bytes)
  expect(german.every(item=>item.text.includes('Prüfung Straße €'))).toBe(true)
  await page.getByRole('button',{name:'Run again with other files',exact:true}).click()
  await page.getByLabel('Watermark text',{exact:true}).fill('中文 😀');await expect(page.getByRole('button',{name:'Apply watermark',exact:true})).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText('outside the bundled font')
  await page.getByRole('checkbox',{name:'Replace each unsupported character with a question mark (?)',exact:true}).check();await preview(page)
  await expect(page.getByText('This page will receive: ?? ?', {exact:false})).toBeVisible()
  await page.getByRole('button',{name:'Apply watermark',exact:true}).click();expect((await inspect(page,(await download(page)).bytes)).every(item=>item.text.includes('?? ?'))).toBe(true)
})

test('invalid settings and encrypted input recover; replacement resets ranges and full reset clears styling',async({page})=>{
  await page.goto('watermark/');await choose(page,await readFile('../fixtures/pdf/F-010-encrypted-aes256.pdf'),'encrypted.pdf')
  await expect(page.getByRole('alert')).toContainText('password-protected');await choose(page)
  await page.getByLabel('Pages to modify',{exact:true}).fill('999');await expect(page.getByRole('button',{name:'Apply watermark',exact:true})).toBeDisabled()
  await page.getByLabel('Pages to modify',{exact:true}).fill('1-4');await page.getByLabel('Font size (pt)',{exact:true}).fill('120')
  await expect(page.getByRole('alert')).toContainText('does not fit');await page.getByLabel('Font size (pt)',{exact:true}).fill('20');await preview(page)
  await page.getByLabel('Preview page',{exact:true}).fill('4');await page.getByLabel('Pages to modify',{exact:true}).fill('4')
  const single=await PDFDocument.create();single.addPage([400,400]);await choose(page,Buffer.from(await single.save()),'single.pdf')
  await expect(page.getByLabel('Pages to modify',{exact:true})).toHaveValue('1');await expect(page.getByLabel('Preview page',{exact:true})).toHaveValue('1');await preview(page)
  await page.getByRole('button',{name:'Apply watermark',exact:true}).click();await download(page)
  await page.getByRole('button',{name:'Start over',exact:true}).click();await expect(page.getByLabel('Font size (pt)',{exact:true})).toHaveValue('36');await expect(page.locator('canvas')).toHaveCount(0)
})

test('download URLs are reused and revoked when adjusting, resetting or exiting',async({page})=>{
  await page.addInitScript(()=>{const live=new Set<string>(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);if(blob instanceof Blob&&blob.type==='application/pdf')live.add(url);return url};URL.revokeObjectURL=url=>{live.delete(url);revoke(url)};Object.assign(window,{overlayUrls:live})})
  const count=()=>page.evaluate(()=>(window as unknown as {overlayUrls:Set<string>}).overlayUrls.size)
  await page.goto('page-numbers/');await choose(page);await preview(page);await page.getByRole('button',{name:'Apply page numbers',exact:true}).click();await download(page);await download(page);expect(await count()).toBe(1)
  await page.getByRole('button',{name:'Run again with other files',exact:true}).click();expect(await count()).toBe(0);await preview(page)
  await page.getByRole('button',{name:'Apply page numbers',exact:true}).click();await download(page);await page.getByRole('button',{name:'Start over',exact:true}).click();expect(await count()).toBe(0)
  await choose(page);await preview(page);await page.getByRole('button',{name:'Apply page numbers',exact:true}).click();await download(page);await page.getByRole('button',{name:'Continue to another tool',exact:true}).click();expect(await count()).toBe(0)
})

test('cancelling held text work terminates workers and retries retained settings without stale output',async({page})=>{
  await page.addInitScript(()=>{
    const send=Worker.prototype.postMessage,terminate=Worker.prototype.terminate,gate={hold:false,pending:[] as (()=>void)[],terminated:0}
    Object.assign(window,{overlayGate:gate});Worker.prototype.terminate=function(){gate.terminated++;terminate.call(this)}
    Worker.prototype.postMessage=function(message:unknown,transfer?:Transferable[]|StructuredSerializeOptions){const forward=()=>{Reflect.apply(send,this,[message,transfer])};if(gate.hold&&(message as {action?:string})?.action==='GetTextContent')gate.pending.push(forward);else forward()}
  })
  await page.goto('page-numbers/');await choose(page);await page.getByLabel('Starting number',{exact:true}).fill('13');await preview(page)
  await page.evaluate(()=>{(window as unknown as {overlayGate:{hold:boolean;terminated:number}}).overlayGate.hold=true;(window as unknown as {overlayGate:{terminated:number}}).overlayGate.terminated=0})
  await page.getByRole('button',{name:'Apply page numbers',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {overlayGate:{pending:unknown[]}}).overlayGate.pending.length)).toBeGreaterThan(0)
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {overlayGate:{terminated:number}}).overlayGate.terminated)).toBeGreaterThan(0)
  await page.evaluate(()=>{const gate=(window as unknown as {overlayGate:{hold:boolean;pending:(()=>void)[]}}).overlayGate;gate.hold=false;gate.pending.splice(0).forEach(send=>send())})
  await page.getByRole('button',{name:'Adjust settings',exact:true}).click();await expect(page.getByLabel('Starting number',{exact:true})).toHaveValue('13');await preview(page)
  await expect(page.getByRole('button',{name:/^Download/})).toHaveCount(0);await page.getByRole('button',{name:'Apply page numbers',exact:true}).click()
  expect((await inspect(page,(await download(page)).bytes))[0].text).toContain('13')
})


test('Apply waits for the rendered preview',async({page})=>{
  await page.addInitScript(()=>{const schedule=requestAnimationFrame.bind(window),gate={hold:true,pending:[] as FrameRequestCallback[]};Object.assign(window,{overlayFrames:gate});window.requestAnimationFrame=callback=>{if(gate.hold){gate.pending.push(callback);return -1}return schedule(callback)}})
  await page.goto('page-numbers/');await choose(page)
  await expect(page.getByText('Rendering preview…',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Apply page numbers',exact:true})).toBeDisabled()
  await page.evaluate(()=>{const gate=(window as unknown as {overlayFrames:{hold:boolean;pending:FrameRequestCallback[]}}).overlayFrames;gate.hold=false;gate.pending.splice(0).forEach(callback=>requestAnimationFrame(callback))})
  await preview(page);await expect(page.getByRole('button',{name:'Apply page numbers',exact:true})).toBeEnabled()
})
