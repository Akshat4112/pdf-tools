import { concatTransformationMatrix, degrees, popGraphicsState, pushGraphicsState, rgb, type PDFDocument, type PDFFont } from 'pdf-lib'
import { loadWritable } from '../engines/pdflib'
import { openDocument, type PdfjsDocument, type PdfjsPage } from '../engines/pdfjs'
import { CancelledError, runJob, type JobEvents } from '../jobs/orchestrator'
import { verifyOutput, type VerifiedOutput } from '../outputs/verify'
import { QUOTAS, toolError } from '../registry'
import { validateFile } from '../validation/validate'
import { parsePageRanges } from '../lib/pageRanges'
import { normalizeOverlayOptions, overlayPlacement, type OverlayMode, type OverlayOptions, type OverlayPlacement, type OverlayViewport } from './overlayPlan'

export interface OverlayInput { file: { displayName: string; bytes: Uint8Array }; mode: OverlayMode; pagesExpr?: string; options?: Partial<OverlayOptions>; previewPage?: number }
export interface OverlayOutcome { output: VerifiedOutput; appliedPages: number[]; totalPages: number; previewPage?: number; previewText?: string }
interface Evidence { view: OverlayViewport; rotation: number; text: string }
interface PaintPlan { page: number; text: string; placement: OverlayPlacement }
async function evidence(page: PdfjsPage): Promise<Evidence> {
  try { return { view: page.getViewport({ scale: 1 }) as OverlayViewport, rotation: page.rotate, text: (await page.getTextContent()).items.map(item=>item.str).join(' ').trim() } }
  finally { page.cleanup() }
}
async function embedFont(doc: PDFDocument): Promise<PDFFont> {
  const [{ default: fontkit }, { OVERLAY_FONT_BASE64 }] = await Promise.all([import('@pdf-lib/fontkit'), import('../assets/overlayFont')])
  doc.registerFontkit(fontkit)
  const bytes = Uint8Array.from(atob(OVERLAY_FONT_BASE64), char=>char.charCodeAt(0))
  return doc.embedFont(bytes, { subset: true })
}
/** Same writer/layout path for full-document previews and the final, independently verified PDF. */
export function startOverlay(input: OverlayInput, events: JobEvents = {}) {
  const snapshot = { ...input, file: { ...input.file }, options: { ...input.options } }
  return runJob(input.previewPage ? 'overlay-preview' : input.mode, snapshot, async (request, ctx): Promise<OverlayOutcome> => {
    const controller = new AbortController(), monitor = setInterval(()=>{ if (ctx.isCancelled()) controller.abort() },20)
    const check = () => { if (ctx.isCancelled()) throw new CancelledError() }
    const wait = async <T,>(pending: Promise<T>): Promise<T> => {
      let rejectAbort: (error: CancelledError)=>void = ()=>{}
      const aborted = new Promise<never>((_,reject)=>{ rejectAbort=reject })
      const abort = ()=>rejectAbort(new CancelledError())
      controller.signal.addEventListener('abort',abort,{once:true}); if(controller.signal.aborted)abort()
      try { return await Promise.race([pending,aborted]) } finally { controller.signal.removeEventListener('abort',abort) }
    }
    let source: PdfjsDocument | undefined, result: PdfjsDocument | undefined
    try {
      check()
      const metadata = validateFile(request.file.displayName,request.file.bytes,'pdf'), options = normalizeOverlayOptions(request.mode,request.options)
      source = await openDocument(request.file.bytes,{strict:true,signal:controller.signal})
      check()
      const count = source.numPages, selected = request.pagesExpr === undefined ? Array.from({length:count},(_,i)=>i+1) : parsePageRanges(request.pagesExpr,count).pages.sort((a,b)=>a-b)
      if(!selected.length)throw toolError('E-INPUT-05','Select at least one page.','focus-picker')
      if (request.previewPage !== undefined && (!Number.isInteger(request.previewPage) || request.previewPage < 1 || request.previewPage > count)) throw toolError('E-CONFIG-01','Choose a valid preview page.','fix-field')
      const sourcePages = Array.from({length:count},(_,i)=>i+1)
      const expected: Evidence[] = []
      for (const [index,number] of sourcePages.entries()) { check(); expected.push(await wait(source.getPage(number).then(evidence))); ctx.reportProgress(0.25*(index+1)/sourcePages.length,`Reading page ${number}`) }
      check()
      const writable = await loadWritable(request.file.bytes)
      const out = writable // Preserve the source catalog, including optional-content visibility, in previews too.
      check()
      const font = await embedFont(out), plans: PaintPlan[] = []
      for (const [index,number] of sourcePages.entries()) {
        const selectedIndex = selected.indexOf(number)
        if (selectedIndex === -1) continue
        const text = request.mode === 'page-numbers' ? String(options.startNumber+selectedIndex) : options.text
        const ascent = font.heightAtSize(options.fontSize,{descender:false}), fullHeight = font.heightAtSize(options.fontSize,{descender:true})
        plans.push({page:index+1,text,placement:overlayPlacement(expected[index].view,font.widthOfTextAtSize(text,options.fontSize),ascent,fullHeight-ascent,options)})
      }
      // All selected placements in this output are checked before any drawing.
      for (const [index,plan] of plans.entries()) {
        check()
        const page = out.getPage(plan.page-1), p = plan.placement, color = options.color.slice(1)
        page.pushOperators(pushGraphicsState(),concatTransformationMatrix(...p.matrix))
        page.drawText(plan.text,{font,size:options.fontSize,x:p.x,y:p.y,rotate:degrees(p.angle),opacity:options.opacity,color:rgb(parseInt(color.slice(0,2),16)/255,parseInt(color.slice(2,4),16)/255,parseInt(color.slice(4,6),16)/255)})
        page.pushOperators(popGraphicsState())
        ctx.reportProgress(0.3+0.3*(index+1)/Math.max(1,plans.length),`Adding overlay to page ${sourcePages[plan.page-1]}`)
        await new Promise(resolve=>setTimeout(resolve,0))
      }
      check(); const bytes = await out.save(); check()
      if(bytes.length>QUOTAS.maxInputBytes)throw toolError('E-PROC-02','The modified PDF exceeds the 50 MB output limit. Split the PDF first.','reduce-scope')
      result = await openDocument(bytes,{strict:true,signal:controller.signal})
      if(result.numPages!==sourcePages.length)throw toolError('E-OUT-01','The modified PDF has an unexpected page count.','retry-job')
      for(const [index,wanted] of expected.entries()) {
        check(); const actual=await wait(result.getPage(index+1).then(evidence)),overlay=plans.find(p=>p.page===index+1)
        const normalized=(text:string)=>text.replace(/\s+/g,' ').trim()
        if(actual.rotation!==wanted.rotation || Math.abs(actual.view.width-wanted.view.width)>0.01 || Math.abs(actual.view.height-wanted.view.height)>0.01 || !normalized(actual.text).includes(normalized(wanted.text)) || (overlay && !normalized(actual.text).includes(normalized(overlay.text))))throw toolError('E-OUT-01',`Page ${sourcePages[index]} did not pass text and geometry verification.`,'retry-job')
        ctx.reportProgress(0.65+0.3*(index+1)/expected.length,`Verified page ${sourcePages[index]}`)
      }
      check()
      const stem=metadata.displayName.replace(/\.[^.]*$/,'').replace(/[^\w.-]+/g,'_').slice(0,50)||'document'
      const output=await verifyOutput({name:`${stem}-${request.mode==='page-numbers'?'numbered':'watermarked'}.pdf`,mimeType:'application/pdf',bytes,expectedPages:sourcePages.length})
      return {output,appliedPages:selected,totalPages:count,previewPage:request.previewPage,previewText:plans.find(plan=>plan.page===(request.previewPage??1))?.text}
    } finally {clearInterval(monitor);await source?.destroy();await result?.destroy()}
  },events)
}
