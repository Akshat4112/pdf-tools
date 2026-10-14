import { test,expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument,PDFName,PDFNumber,PDFRawStream,rgb,degrees } from 'pdf-lib'
import { png } from '../../src/__tests__/imageFixtures'
import type { RasterRequest } from './rasterHarness'
async function coloredPdf() {
  const pdf=await PDFDocument.create()
  const p=pdf.addPage([72,36]);p.drawRectangle({x:0,y:0,width:36,height:18,color:rgb(0,0,1)});p.drawRectangle({x:36,y:18,width:36,height:18,color:rgb(0,1,0)})
  const rotated=pdf.addPage([72,36]);rotated.drawRectangle({x:0,y:0,width:36,height:18,color:rgb(1,0,0)});rotated.setRotation(degrees(90))
  const alpha=pdf.addPage([72,36]);alpha.drawRectangle({x:0,y:18,width:36,height:18,color:rgb(1,0,0),opacity:0.5})
  return Array.from(await pdf.save())
}
test.beforeEach(async({page})=>{
  page.on('pageerror',error=>{throw error})
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1' && !['blob:','data:'].includes(url.protocol))throw new Error(`Unexpected request: ${url.origin}`);return route.continue()})
  await page.goto('e2e/images-engine/harness.html');await page.waitForFunction(()=>Boolean(window.pdfRasterEngine))
})
for(const dpi of [96,150,200])test(`PNG ${dpi} DPI honors page dimensions, rotation, custom order and color`,async({page})=>{
  const request:RasterRequest={pdf:await coloredPdf(),pagesExpr:'2, 1, 2',options:{format:'png',dpi}}
  const out=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),request)
  expect(out.state).toBe('done');expect(out.zip).toMatchObject({name:'sample-png.zip',verified:true});expect(out.cleared).toBe(true)
  expect(out.images.map(image=>[image.sourcePage,image.width,image.height,image.name])).toEqual([[2,dpi/2,dpi,'sample-page-2.png'],[1,dpi,dpi/2,'sample-page-1.png']])
  expect(out.images[0].samples[0]).toEqual([255,0,0,255]);expect(out.images[1].samples[1]).toEqual([0,255,0,255]);expect(out.images[1].samples[2]).toEqual([0,0,255,255])
})
test('PNG white/transparent and JPEG white backgrounds preserve visible content',async({page})=>{
  const pdf=await coloredPdf()
  for(const options of [{format:'png' as const,background:'transparent' as const},{format:'png' as const,background:'white' as const},{format:'jpeg' as const,background:'white' as const}]) {
    const out=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf,pagesExpr:'3',options:{...options,dpi:96}})
    expect(out.state).toBe('done');expect(out.cleared).toBe(true)
    const image=out.images[0];expect(image.mimeType).toBe(options.format==='png'?'image/png':'image/jpeg')
    if(options.background==='transparent') {expect(image.samples[1]).toEqual([0,0,0,0]);expect(image.samples[4][0]).toBe(255);expect(image.samples[4][3]).toBeGreaterThanOrEqual(127);expect(image.samples[4][3]).toBeLessThanOrEqual(128)}
    else {image.samples[1].forEach(channel=>expect(channel).toBeGreaterThanOrEqual(250));expect(image.samples[4][0]).toBeGreaterThanOrEqual(250);expect(image.samples[4][1]).toBeGreaterThanOrEqual(125);expect(image.samples[4][1]).toBeLessThanOrEqual(131)}
  }
})
test('JPEG quality affects real encoding; crop box and UserUnit determine dimensions',async({page})=>{
  const pdf=await PDFDocument.create(),image=await pdf.embedPng(png(160,80)),p=pdf.addPage([160,80]);p.drawImage(image,{x:0,y:0,width:160,height:80});p.setCropBox(10,10,72.25,36.25);p.node.set(PDFName.of('UserUnit'),PDFNumber.of(2));p.setRotation(degrees(270))
  const bytes=Array.from(await pdf.save()),out=[]
  for(const quality of [0.2,0.95])out.push(await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf:bytes,options:{format:'jpeg' as const,dpi:150,quality}}))
  out.forEach(result=>{expect(result.state,JSON.stringify(result)).toBe('done');expect([result.images[0].width,result.images[0].height]).toEqual([152,302]);expect(result.cleared).toBe(true)})
  expect(out[1].images[0].bytes).toBeGreaterThan(out[0].images[0].bytes)
  expect(out.map(result=>result.images[0].quality)).toEqual([0.2,0.95])
})
test('canvas limits and unreadable/encrypted PDFs fail without partial output; retry succeeds',async({page})=>{
  const pdf=await PDFDocument.create();pdf.addPage([10000,10000])
  const cases=[{pdf:Array.from(await pdf.save()),code:'E-PROC-02'},{pdf:Array.from(await readFile('../fixtures/pdf/F-010-encrypted-aes256.pdf')),code:'E-INPUT-02'},{pdf:Array.from(new TextEncoder().encode('%PDF-broken')),code:'E-INPUT-03'}]
  for(const item of cases) {const result=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf:item.pdf});expect(result.state).toBe('failed');expect(result.code).toBe(item.code);expect(result.hasOutput).toBe(false);expect(result.canvases).toBe(0)}
  const retry=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf:await coloredPdf(),pagesExpr:'1',options:{format:'png' as const}});expect(retry.state).toBe('done')
})
test('cancel interrupts a pending render, clears its canvas and never publishes a late result',async({page})=>{
  const cancelled=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf:await coloredPdf(),cancelRender:true})
  expect(cancelled.state).toBe('cancelled');expect(cancelled.hasOutput).toBe(false);expect(cancelled.cancelCount).toBeGreaterThan(0);expect(cancelled.cleared).toBe(true)
  const next=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf:await coloredPdf(),pagesExpr:'1',options:{format:'png' as const}});expect(next.state).toBe('done')
})
test('a failed embedded image cannot be substituted with a verified blank page',async({page})=>{
  const pdf=await PDFDocument.create(),image=await pdf.embedJpg(new Uint8Array(await readFile('e2e/images-engine/corners.jpg'))),p=pdf.addPage([72,36]);p.drawImage(image,{x:0,y:0,width:72,height:36})
  await pdf.flush()
  const original=pdf.context.lookup(image.ref) as PDFRawStream
  pdf.context.assign(image.ref,PDFRawStream.of(original.dict,new Uint8Array([1,2,3])))
  const result=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf:Array.from(await pdf.save())})
  expect(result.state).toBe('failed');expect(result.hasOutput).toBe(false);expect(result.cleared).toBe(true)
})

test('HTML canvas fallback works, and encoding failure cannot publish an output',async({page})=>{
  const pdf=await coloredPdf()
  const fallback=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf,pagesExpr:'1',forceHtmlCanvas:true,options:{format:'png' as const,dpi:96}})
  expect(fallback.state).toBe('done');expect(fallback.images[0].samples[1]).toEqual([0,255,0,255])
  const failed=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf,pagesExpr:'1',emptyEncoding:true,options:{format:'png' as const}})
  expect(failed.state).toBe('failed');expect(failed.code).toBe('E-OUT-01');expect(failed.hasOutput).toBe(false);expect(failed.cleared).toBe(true)
})
test('large source-image dimension hints do not silently remove visible content',async({page})=>{
  const pdf=await PDFDocument.create(),p=pdf.addPage([72,36]),image=await pdf.embedJpg(new Uint8Array(await readFile('e2e/images-engine/corners.jpg')))
  p.drawImage(image,{x:0,y:0,width:72,height:36})
  await pdf.flush()
  const stream=pdf.context.lookup(image.ref) as PDFRawStream
  stream.dict.set(PDFName.of('Width'),PDFNumber.of(5000));stream.dict.set(PDFName.of('Height'),PDFNumber.of(5000))
  const result=await page.evaluate(request=>window.pdfRasterEngine.rasterize(request),{pdf:Array.from(await pdf.save())})
  expect(result.state,JSON.stringify(result)).toBe('done');expect(result.cleared).toBe(true)
  expect(result.images[0].samples.some(color=>color[0]<200 || color[1]<200 || color[2]<200)).toBe(true)
})
