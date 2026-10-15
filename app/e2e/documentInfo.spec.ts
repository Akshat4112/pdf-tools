import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, degrees } from 'pdf-lib'

const title='<script>alert("private-title")</script>',author='Prüfung Straße'
async function demo(signed=false) {
  const pdf=await PDFDocument.create();pdf.setTitle(title);pdf.setAuthor(author);pdf.setSubject('x'.repeat(2000))
  const page=pdf.addPage([500,400]);page.setCropBox(20,30,400,300);page.setRotation(degrees(90));page.node.set(PDFName.of('UserUnit'),PDFNumber.of(2));pdf.addPage([300,200])
  if(signed){const value=pdf.context.register(pdf.context.obj({Type:'Sig',Filter:'Adobe.PPKLite',SubFilter:'adbe.pkcs7.detached',ByteRange:[0,10,20,10],Contents:PDFHexString.of('010203')})),field=pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Widget',FT:'Sig',T:PDFString.of('Synthetic signature'),Rect:[0,0,0,0],V:value,P:page.ref}));page.node.set(PDFName.of('Annots'),pdf.context.obj([field]));pdf.catalog.set(PDFName.of('AcroForm'),pdf.context.obj({SigFlags:3,Fields:[field]}))}
  return Buffer.from(await pdf.save())
}
async function choose(page:Page,bytes?:Buffer,name='local.pdf') {await page.locator('input[type="file"]').setInputFiles({name,mimeType:'application/pdf',buffer:bytes??await demo()});await expect(page.locator('.file-row .file-name')).toHaveText(name)}
async function inspect(page:Page) {await page.getByRole('button',{name:'Inspect PDF',exact:true}).click();await expect(page.getByRole('region',{name:'Document summary',exact:true})).toBeVisible()}
async function chooseAndInspect(page:Page,bytes?:Buffer,name?:string) {await choose(page,bytes,name);await inspect(page)}
test.beforeEach(async({page})=>{
  page.on('pageerror',error=>{throw error})
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'&&!['blob:','data:'].includes(url.protocol))throw new Error(`External request: ${url.origin}`);return route.continue()})
})
test('metadata is inert and bounded; page dimensions include crop, rotation and UserUnit',async({page},info)=>{
  const logs:string[]=[];page.on('console',message=>logs.push(message.text()))
  await page.goto('doc-info/');await chooseAndInspect(page)
  await expect(page.getByRole('region',{name:'Document metadata',exact:true})).toContainText(title)
  await expect(page.getByRole('region',{name:'Document metadata',exact:true})).toContainText(author)
  await expect(page.getByText('(truncated to 1,000 characters)',{exact:true})).toBeVisible()
  await expect(page.getByRole('region',{name:'Document summary',exact:true})).toContainText('No encryption reported by the parser')
  const rows=page.getByRole('region',{name:'Page dimensions',exact:true}).getByRole('row')
  await expect(rows.nth(1)).toContainText('600.00 × 800.00 pt');await expect(rows.nth(1)).toContainText('90°');await expect(rows.nth(2)).toContainText('300.00 × 200.00 pt')
  await expect(page.locator('.document-info-tool script,.document-info-tool iframe,.document-info-tool canvas')).toHaveCount(0)
  expect(logs.some(log=>log.includes('private-title')||log.includes(author))).toBe(false)
  expect(await page.locator('.document-info-list,.document-info-table').evaluateAll(items=>items.every(item=>{const rect=item.getBoundingClientRect();return rect.left>=0&&rect.right<=innerWidth}))).toBe(true)
  if(process.env.PDF_TOOLS_VISUAL_DIR)await page.screenshot({path:`${process.env.PDF_TOOLS_VISUAL_DIR}/document-info-${info.project.name}.png`,fullPage:true})
})
test('signature entries, visual stamps and locked documents have distinct honest reports',async({page})=>{
  await page.goto('doc-info/');await chooseAndInspect(page,await demo(true))
  await expect(page.getByRole('region',{name:'Document summary',exact:true})).toContainText('1 digital signature entries reported — validity not verified')
  await expect(page.getByRole('note')).toContainText('Modifying a PDF can invalidate digital signatures')
  await chooseAndInspect(page,await readFile('../fixtures/pdf/F-009-signed-marker.pdf'),'stamp.pdf')
  await expect(page.getByRole('region',{name:'Document summary',exact:true})).toContainText('No digital signature entries reported')
  await chooseAndInspect(page,await readFile('../fixtures/pdf/F-010-encrypted-aes256.pdf'),'locked.pdf')
  await expect(page.getByRole('heading',{name:'Limited inspection — password required',exact:true})).toBeVisible()
  await expect(page.getByRole('region',{name:'Document summary',exact:true})).toContainText('Unavailable — password required')
  await expect(page.getByRole('region',{name:'Document summary',exact:true})).toContainText('Unknown — not inspected')
  await expect(page.getByRole('region',{name:'Document metadata',exact:true})).toHaveCount(0)
  await choose(page,Buffer.from('%PDF-broken'),'bad.pdf');await page.getByRole('button',{name:'Inspect PDF',exact:true}).click();await expect(page.getByRole('alert')).toContainText('could not be read')
  await page.getByRole('button',{name:'Try again',exact:true}).click();await chooseAndInspect(page)
})
test('page rows are bounded, replacement clears private metadata and reset/exit leave no retained report',async({page})=>{
  await page.goto('doc-info/');await chooseAndInspect(page,await readFile('../fixtures/pdf/F-002-plain-text-30p.pdf'),'long.pdf')
  const table=page.getByRole('region',{name:'Page dimensions',exact:true});await expect(table.getByRole('row')).toHaveCount(26)
  await page.getByRole('button',{name:'Next pages',exact:true}).click();await expect(table.getByRole('row')).toHaveCount(6);await expect(table).toContainText('Pages 26–30 of 30')
  await choose(page);await expect(page.getByRole('region',{name:'Page dimensions',exact:true})).toHaveCount(0);await inspect(page);await expect(table).toContainText('Pages 1–2 of 2')
  await page.getByRole('button',{name:'Start over',exact:true}).click();await expect(page.getByText('No files selected yet.',{exact:true})).toBeVisible();await expect(page.getByText(title,{exact:true})).toHaveCount(0)
  await chooseAndInspect(page);await page.getByRole('button',{name:'Back to all tools',exact:true}).click();await expect(page.getByText(title,{exact:true})).toHaveCount(0)
  await page.goto('doc-info/');await expect(page.getByText('No files selected yet.',{exact:true})).toBeVisible()
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0})
})
for(const action of ['GetMetadata','GetPage'])test(`cancel/replacement during held ${action} terminates the worker and cannot expose late metadata`,async({page})=>{
  await page.addInitScript(action=>{
    const send=Worker.prototype.postMessage,terminate=Worker.prototype.terminate,gate={hold:true,pending:[] as (()=>void)[],terminated:0};Object.assign(window,{infoGate:gate})
    Worker.prototype.terminate=function(){gate.terminated++;terminate.call(this)}
    Worker.prototype.postMessage=function(message:unknown,transfer?:Transferable[]|StructuredSerializeOptions){const forward=()=>{Reflect.apply(send,this,[message,transfer])};if(gate.hold&&(message as {action?:string})?.action===action)gate.pending.push(forward);else forward()}
  },action)
  await page.goto('doc-info/');await choose(page);await page.getByRole('button',{name:'Inspect PDF',exact:true}).click()
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {infoGate:{pending:unknown[]}}).infoGate.pending.length)).toBeGreaterThan(0)
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {infoGate:{terminated:number}}).infoGate.terminated)).toBeGreaterThan(0)
  await page.evaluate(()=>{const gate=(window as unknown as {infoGate:{hold:boolean;pending:(()=>void)[]}}).infoGate;gate.hold=false;gate.pending.splice(0).forEach(send=>send())})
  await page.getByRole('button',{name:'Adjust settings',exact:true}).click();await expect(page.locator('.file-row .file-name')).toHaveText('local.pdf');await expect(page.getByRole('region',{name:'Document summary',exact:true})).toHaveCount(0)
  await inspect(page);await expect(page.getByRole('region',{name:'Document metadata',exact:true})).toContainText(author)
  await page.getByRole('button',{name:'Inspect again',exact:true}).click();await page.evaluate(()=>{(window as unknown as {infoGate:{hold:boolean}}).infoGate.hold=true})
  await page.getByRole('button',{name:'Inspect PDF',exact:true}).click();await expect.poll(()=>page.evaluate(()=>(window as unknown as {infoGate:{pending:unknown[]}}).infoGate.pending.length)).toBeGreaterThan(0)
  const empty=await PDFDocument.create();empty.addPage([200,100]);await choose(page,Buffer.from(await empty.save()),'replacement.pdf')
  await page.evaluate(()=>{const gate=(window as unknown as {infoGate:{hold:boolean;pending:(()=>void)[]}}).infoGate;gate.hold=false;gate.pending.splice(0).forEach(send=>send())})
  await inspect(page);await expect(page.getByRole('region',{name:'Document summary',exact:true})).toContainText('replacement.pdf');await expect(page.getByText(author,{exact:true})).toHaveCount(0)
})
