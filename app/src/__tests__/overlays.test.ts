import { describe, expect, it } from 'vitest'
import { PDFDocument, PDFName, PDFNumber, PDFDict, PDFArray, StandardFonts, degrees } from 'pdf-lib'
import { openDocument } from '../engines/pdfjs'
import { startOverlay } from '../tools/overlayFlow'
import { normalizeOverlayOptions, overlayDefaults, overlayPlacement, unsupportedCharacters } from '../tools/overlayPlan'

async function fixture() {
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica)
  for(let i=0;i<4;i++){const page=pdf.addPage([500,400]);page.setCropBox(20,30,400,300);page.setRotation(degrees(i*90));page.drawText(`SOURCE-${i+1}`,{x:50,y:200,font,size:12});if(i===3)page.node.set(PDFName.of('UserUnit'),PDFNumber.of(2))}
  return new Uint8Array(await pdf.save())
}
describe('overlay layout and controls',()=>{
  it.each([{fontSize:0},{fontSize:121},{opacity:0},{opacity:NaN},{margin:-1},{startNumber:1.5},{startNumber:0},{position:'invalid'},{color:'red'}])('rejects invalid configuration %j',value=>{expect(()=>normalizeOverlayOptions('watermark',value as never)).toThrow()})
  it('requires explicit, predictable fallback for unsupported glyphs and keeps German characters',()=>{
    expect(unsupportedCharacters('Prüfung Straße ÄÖÜäöüß €')).toEqual([])
    expect(()=>normalizeOverlayOptions('watermark',{text:'保密'})).toThrow()
    expect(normalizeOverlayOptions('watermark',{text:'保密',replaceUnsupported:true}).text).toBe('??')
    expect(()=>normalizeOverlayOptions('watermark',{text:'\n'})).toThrow()
  })
  it('inverts viewport rotations, offsets and UserUnit to preserve physical placement',()=>{
    for(const m of [[1,0,0,-1,-20,330],[0,1,1,0,-30,-20],[-1,0,0,1,420,-30],[0,-2,-2,0,660,840]]) {
      const o=overlayDefaults('page-numbers'),p=overlayPlacement({width:400,height:300,transform:m},20,10,3,o),[a,b,c,d,e,f]=p.matrix
      for(const[x,y]of[[0,0],[400,300],[30,70]]){const px=a*x+c*y+e,py=b*x+d*y+f;expect(m[0]*px+m[2]*py+m[4]).toBeCloseTo(x);expect(m[1]*px+m[3]*py+m[5]).toBeCloseTo(300-y)}
      expect(p.y).toBeCloseTo(21);expect(p.x).toBeCloseTo(190)
    }
    expect(()=>overlayPlacement({width:10,height:10,transform:[1,0,0,-1,0,10]},30,12,3,overlayDefaults('watermark'))).toThrow()
  })
})
describe('verified overlay export',()=>{
  it('numbers selected pages in document order, preserves source geometry/text and embeds a real font file',async()=>{
    const bytes=await fixture(),before=bytes.slice(),job=startOverlay({file:{displayName:'../../report.pdf',bytes},mode:'page-numbers',pagesExpr:'4, 2',options:{startNumber:7}})
    await job.completion;expect(job.error).toBeUndefined();expect(job.state).toBe('done');expect(bytes).toEqual(before);expect(job.result?.appliedPages).toEqual([2,4])
    const doc=await openDocument(job.result!.output.bytes)
    try{for(let i=1;i<=4;i++){const page=await doc.getPage(i),text=(await page.getTextContent()).items.map(item=>item.str).join(' ');expect(text).toContain(`SOURCE-${i}`);if(i===2)expect(text).toContain('7');if(i===4)expect(text).toContain('8');expect(page.rotate).toBe((i-1)*90);page.cleanup()}}finally{await doc.destroy()}
    const out=await PDFDocument.load(job.result!.output.bytes),fonts=out.getPage(1).node.Resources()!.lookup(PDFName.of('Font'),PDFDict)
    let embedded=false
    for(const [,reference]of fonts.entries()){const f=out.context.lookup(reference,PDFDict);if(!f.has(PDFName.of('DescendantFonts')))continue;const descendant=f.lookup(PDFName.of('DescendantFonts'),PDFArray).lookup(0,PDFDict),descriptor=descendant.lookup(PDFName.of('FontDescriptor'),PDFDict);embedded ||= descriptor.has(PDFName.of('FontFile2'))}
    expect(embedded).toBe(true);expect(job.result?.output.name).toBe('report-numbered.pdf')
  })
  it('watermarks with selectable German text and creates a matching single-page preview',async()=>{
    const bytes=await fixture(),input={file:{displayName:'report.pdf',bytes},mode:'watermark' as const,pagesExpr:'2',options:{text:'Prüfung Straße',fontSize:24,opacity:0.4}}
    for(const previewPage of [undefined,2]){const job=startOverlay({...input,previewPage});await job.completion;expect(job.error).toBeUndefined();const doc=await openDocument(job.result!.output.bytes);try{expect(doc.numPages).toBe(previewPage?1:4);const p=await doc.getPage(previewPage?1:2);expect((await p.getTextContent()).items.map(item=>item.str).join(' ')).toContain('Prüfung Straße');p.cleanup()}finally{await doc.destroy()}}
  })
  it('rejects invalid selection and oversized placement without publishing partial output',async()=>{
    const bytes=await fixture()
    for(const extra of [{pagesExpr:''},{pagesExpr:'9'},{options:{text:'TOO LONG '.repeat(12),fontSize:120}}]){const job=startOverlay({file:{displayName:'file.pdf',bytes},mode:'watermark',...extra});await job.completion;expect(job.state).toBe('failed');expect(job.result).toBeUndefined()}
  })
  it('cancels cooperatively, discards all output and allows a fresh retry',async()=>{
    const bytes=await fixture(),job=startOverlay({file:{displayName:'file.pdf',bytes},mode:'page-numbers'},{onProgress:p=>{if(p.fraction>0.3)job.cancel()}})
    await job.completion;expect(job.state).toBe('cancelled');expect(job.result).toBeUndefined()
    const retry=startOverlay({file:{displayName:'file.pdf',bytes},mode:'page-numbers'});await retry.completion;expect(retry.state).toBe('done')
  })
})
