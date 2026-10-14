import { startPdfToImages } from '../../src/tools/pdfToImagesFlow'
import type { PdfImageOptions } from '../../src/tools/pdfImagePlan'
import { openDocument, type PdfjsPage } from '../../src/engines/pdfjs'

export interface RasterRequest { pdf: number[]; pagesExpr?: string; options?: Partial<PdfImageOptions>; cancelRender?: boolean; forceHtmlCanvas?: boolean; emptyEncoding?: boolean }
async function rasterize(request: RasterRequest) {
  const nativeCanvas = globalThis.OffscreenCanvas
  const originalEncode = nativeCanvas.prototype.convertToBlob
  if (request.emptyEncoding) nativeCanvas.prototype.convertToBlob = async () => new Blob([], { type: 'image/png' })
  const canvases: OffscreenCanvas[] = []
  let cancelCount = 0
  let prototype: PdfjsPage | undefined
  if (request.cancelRender) {
    const probe = await openDocument(new Uint8Array(request.pdf))
    try { prototype = Object.getPrototypeOf(await probe.getPage(1)) as PdfjsPage } finally { await probe.destroy() }
  }
  const originalRender = prototype?.render
  let heldReject: ((reason: Error) => void) | undefined
  if (request.forceHtmlCanvas) Reflect.set(globalThis, 'OffscreenCanvas', undefined)
  else if (nativeCanvas) globalThis.OffscreenCanvas = new Proxy(nativeCanvas, {
    construct(target, args) {
      const canvas = Reflect.construct(target,args) as OffscreenCanvas
      canvases.push(canvas)
      if (request.cancelRender) queueMicrotask(()=>job.cancel())
      return canvas
    },
  })
  if (prototype && originalRender) prototype.render = function(parameters) {
    const task = originalRender.call(this, parameters)
    void task.promise.catch(()=>{})
    return { promise: new Promise<void>((_resolve,reject)=>{heldReject=reject}), cancel: ()=>{cancelCount++;task.cancel?.();heldReject?.(new Error('cancelled'))} } as ReturnType<typeof originalRender>
  }
  const job = startPdfToImages({ file: { displayName: '../../sample.pdf', bytes: new Uint8Array(request.pdf) }, pagesExpr: request.pagesExpr, options: request.options })
  try {
    await job.completion
    const output = job.result
    const images = []
    if (output) for (const image of output.images) {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(image.bytes).buffer], { type: image.mimeType }))
      const canvas = new nativeCanvas(bitmap.width,bitmap.height), context = canvas.getContext('2d')!
      try {
        context.drawImage(bitmap,0,0)
        const samples = [[0.1,0.1],[0.75,0.25],[0.1,0.9],[0.75,0.75],[0.25,0.25]].map(([x,y])=>Array.from(context.getImageData(Math.floor(x*bitmap.width),Math.floor(y*bitmap.height),1,1).data))
        images.push({ name:image.name,sourcePage:image.sourcePage,width:image.width,height:image.height,mimeType:image.mimeType,verified:image.verified,bytes:image.actualBytes,quality:image.quality,background:image.background,samples })
      } finally {bitmap.close();canvas.width=0;canvas.height=0}
    }
    return { state:job.state, code:job.error?.code,message:job.error?.message, hasOutput:Boolean(output), images, zip:output?{name:output.zip.name,verified:output.zip.verified,bytes:output.zip.actualBytes}:undefined, cancelCount, cleared:canvases.every(canvas=>canvas.width===0 && canvas.height===0), canvases:canvases.length }
  } finally {globalThis.OffscreenCanvas=nativeCanvas;nativeCanvas.prototype.convertToBlob=originalEncode;if (prototype && originalRender) prototype.render=originalRender}
}
declare global { interface Window { pdfRasterEngine: { rasterize: typeof rasterize } } }
window.pdfRasterEngine={rasterize}
