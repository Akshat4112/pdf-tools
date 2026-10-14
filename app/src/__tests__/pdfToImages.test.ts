import { readFileSync } from 'node:fs'
import { PDFDocument, PDFName, PDFNumber, degrees } from 'pdf-lib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { planPdfImagePage, normalizePdfImageOptions, PDF_IMAGE_LIMITS } from '../tools/pdfImagePlan'
import { startPdfToImages } from '../tools/pdfToImagesFlow'
import { openDocument } from '../engines/pdfjs'
import { renderPdfPageImage } from '../engines/pdfRaster'
import { readImageMetadata } from '../engines/imageMetadata'
import { verifyRasterImage } from '../outputs/verifyRaster'
import { png } from './imageFixtures'
import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } from '@zip.js/zip.js'
vi.mock('../engines/pdfRaster',()=>({renderPdfPageImage:vi.fn()}))
const close=vi.fn()
beforeEach(()=>{
  vi.mocked(renderPdfPageImage).mockReset().mockImplementation(async(_doc,plan)=>png(plan.width,plan.height))
  close.mockClear()
  vi.stubGlobal('createImageBitmap',vi.fn(async(blob:Blob)=>{const meta=readImageMetadata(new Uint8Array(await blob.arrayBuffer()));return{width:meta.width,height:meta.height,close}}))
})
afterEach(()=>vi.unstubAllGlobals())
async function source() {
  const pdf=await PDFDocument.create()
  pdf.addPage([72,36]);pdf.addPage([72,36]).setRotation(degrees(90))
  return pdf.save()
}
const input=(bytes:Uint8Array,extra={})=>({file:{displayName:'../../diagram.pdf',bytes},options:{format:'png' as const,dpi:150},...extra})

describe('raster options and exact page geometry',()=>{
  it.each([{dpi:0},{dpi:133},{dpi:NaN},{quality:-0.01},{quality:1.01},{quality:Infinity},{quality:NaN},{format:'webp'},{background:'black'},{format:'jpeg',background:'transparent'}])('rejects invalid options %j',value=>{
    expect(()=>normalizePdfImageOptions(value as Parameters<typeof normalizePdfImageOptions>[0])).toThrow()
  })
  it('accepts quality endpoints and only PNG transparency',()=>{
    expect(normalizePdfImageOptions()).toMatchObject({format:'jpeg',background:'white',quality:0.8,dpi:150})
    expect(normalizePdfImageOptions({quality:0}).quality).toBe(0)
    expect(normalizePdfImageOptions({quality:1,format:'png',background:'transparent'})).toMatchObject({quality:1,background:'transparent'})
  })
  it('uses the reader viewport for crop box, UserUnit, rotation and fractional rounding',async()=>{
    const pdf=await PDFDocument.create(),p=pdf.addPage([200,200]);p.setCropBox(10,20,72.25,36.25);p.setRotation(degrees(270));p.node.set(PDFName.of('UserUnit'),PDFNumber.of(2))
    const doc=await openDocument(await pdf.save())
    try { const page=await doc.getPage(1);for(const dpi of [96,150,200]) {const plan=planPdfImagePage(page,1,normalizePdfImageOptions({dpi}));expect([plan.width,plan.height]).toEqual([Math.ceil(36.25*2*dpi/72),Math.ceil(72.25*2*dpi/72)])}page.cleanup() }
    finally {await doc.destroy()}
  })
  it('rejects invalid or oversized dimensions before allocation',()=>{
    for(const [width,height] of [[0,1],[NaN,2],[Infinity,2],[8193,1],[5000,5000]]) {
      const page={getViewport:()=>({width,height}),rotate:0} as unknown as Parameters<typeof planPdfImagePage>[0]
      expect(()=>planPdfImagePage(page,1,normalizePdfImageOptions())).toThrow()
    }
  })
})
describe('raster flow and verified ZIP',()=>{
  it('preserves input/options and selection order, verifies images and reopens the archive',async()=>{
    const bytes=await source(),before=bytes.slice(), options={format:'png' as const,dpi:96},request={...input(bytes),pagesExpr:'2, 1, 2',options},job=startPdfToImages(request)
    options.dpi=200;request.pagesExpr='1'
    await job.completion
    expect(job.error).toBeUndefined();expect(job.state).toBe('done');expect(bytes).toEqual(before)
    expect(job.result?.images.map(p=>[p.sourcePage,p.width,p.height,p.name,p.verified])).toEqual([[2,48,96,'diagram-page-2.png',true],[1,96,48,'diagram-page-1.png',true]])
    expect(job.result?.zip.name).toBe('diagram-png.zip');expect(close).toHaveBeenCalledTimes(2)
    const reader=new ZipReader(new Uint8ArrayReader(job.result!.zip.bytes))
    try {const entries=await reader.getEntries();expect(entries.map(e=>e.filename)).toEqual(job.result!.images.map(p=>p.name));for(let i=0;i<entries.length;i++){const entry=entries[i];if(entry.directory)throw new Error('Unexpected directory');expect(await entry.getData!(new Uint8ArrayWriter(),{checkSignature:true})).toEqual(job.result!.images[i].bytes)}}finally{await reader.close()}
  })
  it('renders all pages when the selection is omitted, but rejects an explicitly empty selection',async()=>{
    const bytes=await source(),all=startPdfToImages(input(bytes));await all.completion;expect(all.result?.images).toHaveLength(2)
    const empty=startPdfToImages(input(bytes,{pagesExpr:''}));await empty.completion;expect(empty.error?.code).toBe('E-INPUT-05');expect(empty.result).toBeUndefined()
  })
  it('preflights the complete selection before rendering any page',async()=>{
    const pdf=await PDFDocument.create();pdf.addPage([72,36]);pdf.addPage([10000,10000])
    const job=startPdfToImages(input(await pdf.save()));await job.completion;expect(job.error?.code).toBe('E-PROC-02');expect(renderPdfPageImage).not.toHaveBeenCalled();expect(job.result).toBeUndefined()
  })
  it('rejects corrupted encodings, wrong dimensions and output budgets without partial results',async()=>{
    const bytes=await source()
    for(const rendered of [new Uint8Array([137,80,78,71]),png(1,1),new Uint8Array(PDF_IMAGE_LIMITS.maxEncodedBytes+1)]) {
      vi.mocked(renderPdfPageImage).mockResolvedValueOnce(rendered)
      const job=startPdfToImages(input(bytes,{pagesExpr:'1'}));await job.completion;expect(job.state).toBe('failed');expect(job.result).toBeUndefined()
    }
    vi.mocked(renderPdfPageImage).mockResolvedValueOnce(png(150,75)).mockRejectedValueOnce(new Error('render failure'))
    const failed=startPdfToImages(input(bytes));await failed.completion;expect(failed.state).toBe('failed');expect(failed.result).toBeUndefined()
  })
  it('rejects invalid/encrypted source files, ranges and page quotas',async()=>{
    const pdf=await PDFDocument.create();for(let i=0;i<301;i++)pdf.addPage([10,10])
    for(const bytes of [new Uint8Array([1,2]),new Uint8Array(readFileSync('../fixtures/pdf/F-010-encrypted-aes256.pdf')),await pdf.save()]) {
      const job=startPdfToImages(input(bytes));await job.completion;expect(job.state).toBe('failed');expect(job.result).toBeUndefined()
    }
    for(const pagesExpr of ['3','2-1','nope']) {const job=startPdfToImages(input(await source(),{pagesExpr}));await job.completion;expect(job.error?.code).toBe('E-CONFIG-01')}
  })
  it('discards cancelled/late results and permits a fresh retry',async()=>{
    const bytes=await source(),early=startPdfToImages(input(bytes));early.cancel();await early.completion;expect(early.state).toBe('cancelled');expect(early.result).toBeUndefined()
    let job:ReturnType<typeof startPdfToImages>
    job=startPdfToImages(input(bytes),{onProgress:p=>{if(p.fraction>=0.45)job.cancel()}});await job.completion;expect(job.state).toBe('cancelled');expect(job.result).toBeUndefined()
    const retry=startPdfToImages(input(bytes));await retry.completion;expect(retry.state).toBe('done')
  })
  it('closes verification bitmaps even when their decoded dimensions are wrong',async()=>{
    vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:1,height:1,close})))
    await expect(verifyRasterImage({name:'page.png',mimeType:'image/png',bytes:png(20,10)},{width:20,height:10})).rejects.toMatchObject({code:'E-OUT-01'})
    expect(close).toHaveBeenCalledTimes(1)
  })
})
