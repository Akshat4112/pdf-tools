import { startImagesToPdf } from '../../src/tools/imagesToPdfFlow'
import { DEFAULT_IMAGE_OPTIONS, type ImagePdfOptions } from '../../src/tools/imagePagePlan'
import { openDocument } from '../../src/engines/pdfjs'

export interface RenderRequest { images: number[][]; options?: Partial<ImagePdfOptions>; samples?: [number,number][] }
export interface RenderEvidence { pages: { width: number; height: number; colors: number[][] }[]; verified: boolean }
async function convertAndRender(request: RenderRequest): Promise<RenderEvidence> {
  const job=startImagesToPdf({images:request.images.map((data,i)=>({displayName:`image-${i}.png`,bytes:new Uint8Array(data)})),options:{...DEFAULT_IMAGE_OPTIONS,...request.options}})
  await job.completion
  if (!job.result) throw new Error(`${job.state}: ${job.error?.code} ${job.error?.message}`)
  const doc=await openDocument(job.result.bytes), pages: RenderEvidence['pages']=[]
  try {
    for(let i=1;i<=doc.numPages;i++) {
      const page=await doc.getPage(i), viewport=page.getViewport({scale:1}), canvas=document.createElement('canvas')
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
      const context=canvas.getContext('2d')!
      try {
        // Black reader background ensures transparent regions are painted white by the PDF itself.
        await page.render({canvas,canvasContext:context,viewport,background:'rgb(0,0,0)'}).promise
        const colors=(request.samples??[[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]]).map(([x,y])=>Array.from(context.getImageData(Math.floor(x*viewport.width),Math.floor(y*viewport.height),1,1).data))
        pages.push({width:viewport.width,height:viewport.height,colors})
      } finally {page.cleanup();canvas.width=0;canvas.height=0}
    }
  } finally {await doc.destroy()}
  return {pages,verified:job.result.verified}
}
async function failureCode(data: number[]) {
  const job = startImagesToPdf({ images: [{ displayName: 'broken.jpg', bytes: new Uint8Array(data) }] })
  await job.completion
  return { state: job.state, code: job.error?.code, hasOutput: Boolean(job.result) }
}
declare global { interface Window { imageEngine: { convertAndRender: typeof convertAndRender; failureCode: typeof failureCode } } }
window.imageEngine={convertAndRender,failureCode}
