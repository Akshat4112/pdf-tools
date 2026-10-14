import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readExifOrientation, readImageMetadata } from '../engines/imageMetadata'
import { DEFAULT_IMAGE_OPTIONS, planImagePage, type ImagePdfOptions } from '../tools/imagePagePlan'
import { startImagesToPdf } from '../tools/imagesToPdfFlow'
import { chunk, concat, exif, jpegExif, png } from './imageFixtures'
const jpg = new Uint8Array(readFileSync('../fixtures/images/F-007-photo.jpg'))
const options = (extra: Partial<ImagePdfOptions> = {}): ImagePdfOptions => ({ ...DEFAULT_IMAGE_OPTIONS, ...extra })
const image = (bytes: Uint8Array = png(), displayName = 'diagram.png') => ({ bytes, displayName })
async function failure(bytes: Uint8Array, code: string) { const job=startImagesToPdf({images:[image(bytes)]}); await job.completion; expect(job.state).toBe('failed');expect(job.error?.code).toBe(code);expect(job.result).toBeUndefined() }

describe('image headers and orientation', () => {
  it.each([1,2,3,4,5,6,7,8])('reads EXIF %i for JPEG and PNG in either byte order', n => {
    for(const little of [true,false]) expect(readImageMetadata(jpegExif(jpg,n,little)).orientation).toBe(n)
    expect(readImageMetadata(png(80,40,n))).toMatchObject({width:80,height:40,orientation:n,kind:'png'})
  })
  it('defaults untagged files and respects offset buffers', () => {
    expect(readImageMetadata(jpg).orientation).toBe(1)
    const bytes=png(), pooled=concat(new Uint8Array(11),bytes,new Uint8Array(7))
    expect(readImageMetadata(pooled.subarray(11,11+bytes.length))).toMatchObject({width:80,height:40,orientation:1})
  })
  it('rejects invalid TIFF orientation, bounds, type, count and truncated IFD', () => {
    for(const n of [0,9])expect(()=>readExifOrientation(exif(n))).toThrow()
    for(const at of [2,4,8,12,14]) {const data=exif(6);data[at]=255;expect(()=>readExifOrientation(data)).toThrow()}
    expect(()=>readExifOrientation(exif(6).subarray(0,22))).toThrow()
  })
  it('rejects truncated files, bad CRC, animations, and oversized dimensions before decoding', async () => {
    await failure(png().subarray(0,40),'E-INPUT-03')
    await failure(jpg.subarray(0,jpg.length-2),'E-INPUT-03')
    const bad=png();bad[35]^=1;await failure(bad,'E-INPUT-03')
    const normal=png();await failure(concat(normal.subarray(0,33),chunk('acTL',new Uint8Array(8)),normal.subarray(33)),'E-INPUT-01')
    const huge=png();new DataView(huge.buffer).setUint32(16,1_000_000);new DataView(huge.buffer).setUint32(29, (await import('../engines/imageMetadata')).pngCrc(huge.subarray(12,29)));await failure(huge,'E-INPUT-04')
  })
})
describe('shared page layout', () => {
  const meta=readImageMetadata(png())
  it('uses oriented dimensions for auto A4/Letter and pixel size at chosen DPI', () => {
    expect(planImagePage(meta,options()).widthPt).toBe(841.89)
    expect(planImagePage({...meta,orientation:6},options({pageSize:'letter'}))).toMatchObject({widthPt:612,heightPt:792})
    expect(planImagePage(meta,options({pageSize:'original',dpi:96,marginPt:12}))).toMatchObject({widthPt:84,heightPt:54})
  })
  it('contains without distortion, covers with cropping and keeps the margin frame', () => {
    const contain=planImagePage(meta,options({orientation:'portrait',pageSize:'letter',marginPt:20})), cover=planImagePage(meta,options({orientation:'portrait',pageSize:'letter',marginPt:20,fit:'cover'}))
    expect(contain.matrix[0]/contain.matrix[3]).toBe(2)
    expect(contain.matrix[0]).toBe(572)
    expect(cover.matrix[3]).toBe(752)
    expect(cover.matrix[4]).toBeLessThan(20)
    expect(cover.frame).toEqual({x:20,y:20,width:572,height:752})
  })
  it.each([{marginPt:NaN},{marginPt:Infinity},{marginPt:-1},{marginPt:400},{dpi:72},{pageSize:'bad'},{fit:'bad'},{background:'transparent'},{pageSize:'original',orientation:'portrait'}])('rejects invalid options %j', extra => {
    expect(()=>planImagePage(meta,options(extra as Partial<ImagePdfOptions>))).toThrow()
  })
})
describe('conversion lifecycle', () => {
  it('writes verified mixed images, preserves inputs and snapshots options/order', async () => {
    const bytes=png(80,40,6,true), before=bytes.slice(), images=[image(bytes,'../../photo.png'),image(jpg)]
    const opts=options({pageSize:'letter'}), job=startImagesToPdf({images,options:opts})
    images.reverse();opts.marginPt=400
    await job.completion
    expect(job.error).toBeUndefined();expect(job.state).toBe('done');expect(job.result).toMatchObject({name:'photo-images.pdf',expectedPages:2,verified:true});expect(bytes).toEqual(before)
  })
  it('never publishes partial output after failure or cancellation and supports a fresh retry', async () => {
    const failed=startImagesToPdf({images:[image(),image(new Uint8Array([1,2,3]))]});await failed.completion;expect(failed.result).toBeUndefined();expect(failed.state).toBe('failed')
    const cancelled=startImagesToPdf({images:[image()]});cancelled.cancel();await cancelled.completion;expect(cancelled.state).toBe('cancelled');expect(cancelled.result).toBeUndefined()
    let job: ReturnType<typeof startImagesToPdf>
    job=startImagesToPdf({images:[image(),image()]},{onProgress:p=>{if(p.fraction>0)job.cancel()}});await job.completion;expect(job.state).toBe('cancelled');expect(job.result).toBeUndefined()
    const retry=startImagesToPdf({images:[image()]});await retry.completion;expect(retry.state).toBe('done')
  })
  it('enforces selection, byte, page and aggregate pixel limits', async () => {
    for(const images of [[],Array.from({length:301},()=>image()),[image(new Uint8Array(50*1024*1024+1))]]) {
      const job=startImagesToPdf({images});await job.completion;expect(job.error?.code).toBe(images.length===0?'E-INPUT-05':'E-INPUT-04')
    }
    const small=png(), large=small.slice(), view=new DataView(large.buffer);view.setUint32(16,4000);view.setUint32(20,4000);view.setUint32(29,(await import('../engines/imageMetadata')).pngCrc(large.subarray(12,29)))
    const job=startImagesToPdf({images:[image(large),image(large)]});await job.completion;expect(job.error?.code).toBe('E-INPUT-04')
  })
})
