import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFHexString, degrees } from 'pdf-lib'
import * as engine from '../engines/pdfjs'
import { startDocumentInfo } from '../tools/documentInfoFlow'
import { validateFile } from '../validation/validate'

afterEach(() => vi.restoreAllMocks())
async function fixture(signature = false) {
  const pdf = await PDFDocument.create(); pdf.setTitle('<script>alert(1)</script>'); pdf.setAuthor('Prüfung Straße'); pdf.setSubject('x'.repeat(2000)); pdf.setCreationDate(new Date('2026-10-01T12:30:00Z'))
  const page = pdf.addPage([500,400]); page.setCropBox(20,30,400,300); page.setRotation(degrees(90)); page.node.set(PDFName.of('UserUnit'),PDFNumber.of(2)); pdf.addPage([300,200])
  const xml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq>${Array.from({length:21},(_,i)=>`<rdf:li>Creator${i+1}</rdf:li>`).join('')}</rdf:Seq></dc:creator><dc:title><rdf:Alt><rdf:li xml:lang="x-default">XMP title</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta>`
  pdf.catalog.set(PDFName.of('Metadata'),pdf.context.register(pdf.context.stream(xml,{Type:'Metadata',Subtype:'XML'})))
  if(signature) {
    const value=pdf.context.register(pdf.context.obj({Type:'Sig',Filter:'Adobe.PPKLite',SubFilter:'adbe.pkcs7.detached',ByteRange:[0,10,20,10],Contents:PDFHexString.of('010203'),Name:PDFString.of('Synthetic unverified signer')}))
    const field=pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Widget',FT:'Sig',T:PDFString.of('Signature1'),Rect:[0,0,0,0],V:value,P:page.ref}))
    page.node.set(PDFName.of('Annots'),pdf.context.obj([field]));pdf.catalog.set(PDFName.of('AcroForm'),pdf.context.obj({SigFlags:3,Fields:[field]}))
  }
  return new Uint8Array(await pdf.save())
}
const inspect = async (bytes:Uint8Array,name='report.pdf') => {const job=startDocumentInfo({file:{displayName:name,bytes}});await job.completion;return job}

describe('document information inspector',()=>{
  it('reports physical cropped/rotated geometry, bounded metadata and XMP without changing input',async()=>{
    const bytes=await fixture(),before=bytes.slice(),job=await inspect(bytes,'../../report.pdf')
    expect(job.error).toBeUndefined();expect(job.state).toBe('done');expect(bytes).toEqual(before)
    const result=job.result!;expect(result.name).toBe('report.pdf');expect(result.byteLength).toBe(bytes.length);expect(result.pageCount).toBe(2);expect(result.version).toBe('1.7')
    expect(result.encryption).toBe('none-reported');expect(result.signatureEntries).toBe(0)
    expect(result.pages).toEqual([{number:1,width:600,height:800,rotation:90,userUnit:2},{number:2,width:300,height:200,rotation:0,userUnit:1}])
    expect(result.fields.find(item=>item.label==='Title')?.value).toBe('<script>alert(1)</script>');expect(result.fields.find(item=>item.label==='Author')?.value).toBe('Prüfung Straße')
    expect(result.fields.find(item=>item.label==='Subject')).toMatchObject({value:'x'.repeat(1000),truncated:true})
    expect(result.fields.find(item=>item.label==='Created (PDF date)')?.value).toContain('D:20261001123000')
    expect(result.xmp.find(item=>item.label==='Title')?.value).toBe('XMP title')
    expect(result.xmp.find(item=>item.label==='Creator')?.value).toContain('Creator21');expect(result.xmp.find(item=>item.label==='Creator')?.truncated).toBe(false)
  })
  it('reports synthetic signature entries as indicators and distinguishes a visual stamp',async()=>{
    const signed=await inspect(await fixture(true));expect(signed.error).toBeUndefined();expect(signed.result?.signatureFlag).toBe(true);expect(signed.result?.signatureEntries).toBe(1)
    const marker=await inspect(new Uint8Array(await readFile('../fixtures/pdf/F-009-signed-marker.pdf')));expect(marker.result?.signatureEntries).toBe(0);expect(marker.result?.signatureFlag).toBe(false)
  })
  it('allows encrypted files only for inspection and returns an honest locked report',async()=>{
    const bytes=new Uint8Array(await readFile('../fixtures/pdf/F-010-encrypted-aes256.pdf'))
    expect(()=>validateFile('locked.pdf',bytes,'pdf')).toThrow();expect(validateFile('locked.pdf',bytes,'pdf',{allowEncrypted:true}).encrypted).toBe(true)
    const job=await inspect(bytes);expect(job.state).toBe('done');expect(job.result).toMatchObject({locked:true,encryption:'password-required',fields:[],pages:[]});expect(job.result?.pageCount).toBeUndefined();expect(job.result?.signatureEntries).toBeUndefined()
  })
  it('does not treat a stray Encrypt marker as proof of encryption',async()=>{
    const bytes=await fixture(),combined=new Uint8Array(bytes.length+20);combined.set(bytes);combined.set(new TextEncoder().encode('\n% /Encrypt fake\n'),bytes.length)
    const job=await inspect(combined);expect(job.state).toBe('done');expect(job.result?.encryption).toBe('none-reported')
  })
  it('rejects malformed and over-page-limit sources without a partial report',async()=>{
    const pdf=await PDFDocument.create();for(let i=0;i<301;i++)pdf.addPage([100,100])
    for(const bytes of [new TextEncoder().encode('%PDF-broken'),new Uint8Array(await pdf.save())]){const job=await inspect(bytes);expect(job.state).toBe('failed');expect(job.result).toBeUndefined()}
  })
  it('cancels inspection and can retry the same original',async()=>{
    const bytes=await fixture(),job=startDocumentInfo({file:{displayName:'file.pdf',bytes}},{onProgress:()=>job.cancel()});await job.completion
    expect(job.state).toBe('cancelled');expect(job.result).toBeUndefined();expect((await inspect(bytes)).state).toBe('done')
  })
  it('keeps failed metadata/signature reads unknown and always destroys the document',async()=>{
    const destroy=vi.fn().mockResolvedValue(undefined),cleanup=vi.fn()
    vi.spyOn(engine,'openDocument').mockResolvedValue({numPages:1,destroy,getMetadata:()=>Promise.reject(new Error('private metadata')),getSignatures:()=>Promise.reject(new Error('private signature')),getPage:async()=>({rotate:0,userUnit:1,cleanup,getViewport:()=>({width:100,height:200})})} as never)
    const job=await inspect(await fixture());expect(job.state).toBe('done');expect(job.result?.encryption).toBe('unknown');expect(job.result?.signatureEntries).toBeUndefined();expect(job.result?.warnings).toHaveLength(2);expect(destroy).toHaveBeenCalledOnce();expect(cleanup).toHaveBeenCalledOnce()
  })
  it('settles a cancelled pending metadata request and destroys its document',async()=>{
    const destroy=vi.fn().mockResolvedValue(undefined)
    vi.spyOn(engine,'openDocument').mockResolvedValue({numPages:1,destroy,getMetadata:()=>new Promise(()=>{})} as never)
    const job=startDocumentInfo({file:{displayName:'file.pdf',bytes:await fixture()}});setTimeout(()=>job.cancel(),30);await job.completion
    expect(job.state).toBe('cancelled');expect(job.result).toBeUndefined();expect(destroy).toHaveBeenCalledOnce()
  })
})
