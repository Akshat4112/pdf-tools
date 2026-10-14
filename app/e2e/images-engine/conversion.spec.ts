import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { chunk, concat, jpegExif, png } from '../../src/__tests__/imageFixtures'
import type { RenderRequest } from './harness'
const colors=[[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255]]
// Expected visual corner order, independent of the writer's PDF coordinate matrices.
const corners=[[0,1,2,3],[1,0,3,2],[3,2,1,0],[2,3,0,1],[0,2,1,3],[2,0,3,1],[3,1,2,0],[1,3,0,2]]
const jpg=new Uint8Array(readFileSync('e2e/images-engine/corners.jpg'))
test.beforeEach(async({page})=>{await page.goto('e2e/images-engine/harness.html');await page.waitForFunction(()=>Boolean(window.imageEngine))})
for(const kind of ['png','jpeg'] as const) test(`${kind}: all eight EXIF orientations render with correct corner colors and aspect`,async({page})=>{
  const images=Array.from({length:8},(_,i)=>Array.from(kind==='png'?png(80,40,i+1):jpegExif(jpg,i+1)))
  const request: RenderRequest={images,options:{pageSize:'original',marginPt:0,dpi:96}}
  const result=await page.evaluate(request=>window.imageEngine.convertAndRender(request),request)
  expect(result.verified).toBe(true)
  result.pages.forEach((p,i)=>{
    expect([p.width,p.height]).toEqual(i<4?[60,30]:[30,60])
    p.colors.forEach((color,j)=>colors[corners[i][j]].forEach((channel,k)=>expect(Math.abs(color[k]-channel)).toBeLessThanOrEqual(kind==='jpeg'?12:0)))
  })
})
test('white background is in the PDF; contain/cover honor margins; order is preserved',async({page})=>{
  const run=(request:RenderRequest)=>page.evaluate(request=>window.imageEngine.convertAndRender(request),request)
  const alpha=await run({images:[Array.from(png(80,40,undefined,true))],options:{pageSize:'original',marginPt:0,dpi:96}})
  expect(alpha.pages[0].colors).toEqual([[255,255,255,255],colors[1],[255,255,255,255],colors[3]])
  for(const fit of ['contain','cover'] as const) {
    const out=await run({images:[Array.from(png())],options:{pageSize:'letter',orientation:'portrait',marginPt:36,fit},samples:[[0.01,0.5],[0.5,0.01],[0.25,0.1],[0.5,0.5]]})
    expect(out.pages[0].colors[0]).toEqual([255,255,255,255]);expect(out.pages[0].colors[1]).toEqual([255,255,255,255])
    expect(out.pages[0].colors[2]).toEqual(fit==='contain'?[255,255,255,255]:colors[0])
  }
  const out=await run({images:[Array.from(png(40,80,3)),Array.from(png(80,40))],options:{pageSize:'original',dpi:96,marginPt:0}})
  expect(out.pages.map(p=>[p.width,p.height])).toEqual([[30,60],[60,30]])
  expect(out.pages[0].colors).toEqual(corners[2].map(i=>colors[i]));expect(out.pages[1].colors).toEqual(colors)
})

test('rejects damaged JPEG pixels and recovers with a valid image',async({page})=>{
  let scan=2
  while(scan<jpg.length && !(jpg[scan]===255 && jpg[scan+1]===218))scan++
  const scanEnd=scan+2+new DataView(jpg.buffer,jpg.byteOffset,jpg.byteLength).getUint16(scan+2)
  const broken=[...jpg.subarray(0,scanEnd),255,217]
  expect(await page.evaluate(data=>window.imageEngine.failureCode(data),broken)).toEqual({state:'failed',code:'E-INPUT-03',hasOutput:false})
  const original=png(), idatLength=new DataView(original.buffer).getUint32(33), idat=original.slice(41,41+idatLength)
  idat[0]=0 // Invalid zlib header, with a valid chunk CRC.
  const brokenPng=concat(original.subarray(0,33),chunk('IDAT',idat),original.subarray(45+idatLength))
  expect(await page.evaluate(data=>window.imageEngine.failureCode(data),Array.from(brokenPng))).toEqual({state:'failed',code:'E-INPUT-03',hasOutput:false})
  expect((await page.evaluate(data=>window.imageEngine.convertAndRender({images:[data]}),Array.from(jpg))).verified).toBe(true)
})
