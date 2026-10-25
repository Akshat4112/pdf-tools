/** PT-QA-001: real UI downloads -> external PyMuPDF/qpdf. Synthetic files only. */
import { test, expect, type Page } from '@playwright/test'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { TOOLS } from '../src/registry'

const actions: Record<string,string> = {merge:'Merge PDFs',split:'Split PDF',rotate:'Create rotated copy',organize:'Create organized copy','extract-pages':'Extract pages','delete-pages':'Create copy without selected pages','images-to-pdf':'Create PDF','pdf-to-jpg':'Create images','pdf-to-png':'Create images','page-numbers':'Apply page numbers',watermark:'Apply watermark','pdf-to-text':'Export text'}
async function source() {
  const doc=await PDFDocument.create(), font=await doc.embedFont(StandardFonts.Courier)
  doc.setTitle('Independent QA source')
  for(let i=0;i<3;i++) {
    const p=doc.addPage([300,400]); p.drawText(`PAGE-${i+1} Prüfung`,{x:30,y:300,size:14,font})
    p.drawRectangle({x:30,y:100,width:100,height:100,color:rgb(i===0?1:0,i===1?1:0,i===2?1:0)})
    if(i===1)p.setRotation(degrees(90))
  }
  return Buffer.from(await doc.save())
}
async function click(page:Page,name:string) {await page.getByRole('button',{name,exact:true}).click()}
async function save(page:Page,dir:string,name:string,button?:string) {
  const waiting=page.waitForEvent('download')
  await page.getByRole('button',button?{name:button,exact:true}:{name:/^Download /}).first().click()
  const download=await waiting;await download.saveAs(join(dir,name))
}
function validate(dir:string) {
  execFileSync('python3',['../scripts/validate_outputs.py','--manifest',join(dir,'manifest.json')],{stdio:'pipe'})
}
for(const tool of TOOLS.filter(t=>t.implemented)) test(`independent output: ${tool.id}`,async({page})=>{
  test.setTimeout(90_000)
  const route=tool.route.slice(1),dir=await mkdtemp(join(tmpdir(),'foliolocal-output-'))
  try {
    const bytes=await source();await writeFile(join(dir,'source.pdf'),bytes)
    await page.goto(`${route}/`)
    if(route==='images-to-pdf') {
      // Independently render the synthetic source to an opaque image; no production engine generates the oracle.
      execFileSync('python3',['-c',`import pymupdf; d=pymupdf.open(${JSON.stringify(join(dir,'source.pdf'))}); d[0].get_pixmap().save(${JSON.stringify(join(dir,'source.png'))})`])
      await page.locator('input[type=file]').setInputFiles(join(dir,'source.png'))
    } else {
      const payload={name:'source.pdf',mimeType:'application/pdf',buffer:bytes}
      await page.locator('input[type=file]').setInputFiles(route==='merge'?[payload,{...payload,name:'second.pdf'}]:payload)
    }
    await expect(page.locator('.file-row')).toHaveCount(route==='merge'?2:1)
    const ref=(pages:number[],rotations?:number[])=>({file:'source.pdf',pages,...(rotations?{rotations}:{})})
    let output:Record<string,unknown>={file:'output.pdf',kind:'pdf',pages:3,reference:ref([0,1,2])}
    if(route==='reader') {
      await expect(page.getByRole('button',{name:'Go',exact:true})).toBeEnabled()
      for(let i=1;i<=3;i++) {
        await page.getByLabel('Page',{exact:true}).fill(String(i));await click(page,'Go')
        await expect(page.locator('.textLayer')).toContainText(`PAGE-${i}`)
      }
      // Independent parser checks the same source oracle. Read-only tools have no download.
      await writeFile(join(dir,'manifest.json'),JSON.stringify({outputs:[{file:'source.pdf',kind:'pdf',pages:3,rotations:[0,90,0],page_text_markers:['PAGE-1','PAGE-2','PAGE-3']}]}))
      validate(dir);return
    }
    if(route==='doc-info') {
      await click(page,'Inspect PDF')
      const summary=page.getByRole('region',{name:'Document summary',exact:true})
      await expect(summary.locator('div').filter({has:page.locator('dt',{hasText:/^Pages$/})}).locator('dd')).toHaveText('3')
      const rows=page.getByRole('region',{name:'Page dimensions',exact:true}).getByRole('row')
      for(let i=0;i<3;i++) {await expect(rows.nth(i+1)).toContainText(i===1?'400.00 × 300.00 pt':'300.00 × 400.00 pt');await expect(rows.nth(i+1)).toContainText(i===1?'90°':'0°')}
      await expect(page.getByRole('region',{name:'Document metadata',exact:true})).toContainText('Independent QA source')
      await writeFile(join(dir,'manifest.json'),JSON.stringify({outputs:[{file:'source.pdf',kind:'pdf',pages:3,rotations:[0,90,0],page_sizes_pt:[[300,400],[400,300],[300,400]]}]}));validate(dir);return
    }
    if(route==='merge') output={...output,pages:6,reference:ref([0,1,2,0,1,2])}
    if(route==='split') {
      await page.getByLabel('Ranges (comma separated)',{exact:true}).fill('3, 1-2')
      output={file:'output.zip',kind:'zip',members:[{file:'source-1.pdf',kind:'pdf',pages:1,reference:ref([2])},{file:'source-2.pdf',kind:'pdf',pages:2,reference:ref([0,1])}]}
    }
    if(route==='rotate'||route==='organize') {
      await expect(page.getByRole('button',{name:'Output page 1, source page 1',exact:true})).toBeVisible()
      if(route==='organize') {await click(page,'Move earlier at position 3');output={...output,reference:ref([0,2,1],[90,0,90])}}
      else output={...output,reference:ref([0,1,2],[90,90,0])}
      await click(page,'Rotate right at position 1')
    }
    if(route==='extract-pages'||route==='delete-pages') {
      await expect(page.getByRole('button',{name:'Page 1',exact:true})).toBeVisible()
      await page.getByRole('textbox',{name:route==='extract-pages'?'Pages to extract':'Pages to remove',exact:true}).fill(route==='extract-pages'?'3, 1':'2')
      if(route==='delete-pages')await page.locator('.page-delete-confirmation input').check()
      output={...output,pages:2,reference:ref(route==='extract-pages'?[2,0]:[0,2])}
    }
    if(route==='watermark'||route==='page-numbers') {
      if(route==='watermark') {await page.getByLabel('Watermark text',{exact:true}).fill('Prüfung Straße');await page.getByLabel('Font size (pt)',{exact:true}).fill('16')}
      else await page.getByLabel('Starting number',{exact:true}).fill('7')
      await expect(page.getByText('Preview ready',{exact:true})).toBeVisible()
      output={...output,reference:{...ref([0,1,2]),overlay:true},page_required_text:route==='watermark'?[['Prüfung Straße'],['Prüfung Straße'],['Prüfung Straße']]:[['7'],['8'],['9']]}
    }
    if(route==='images-to-pdf') {
      await page.getByRole('combobox',{name:'Page size',exact:true}).selectOption('original')
      // Lowest supported DPI is 96. Geometry scales 300x400 pixels to 225x300 pt.
      await page.getByRole('combobox',{name:'Original size DPI',exact:true}).selectOption('96')
      await page.getByLabel('Margins (points)',{exact:true}).fill('0')
      output={file:'output.pdf',kind:'pdf',pages:1,page_sizes_pt:[[225,300]]}
    }
    if(route==='pdf-to-png'||route==='pdf-to-jpg') {
      await page.getByRole('combobox',{name:'Resolution',exact:true}).selectOption('96')
      await page.getByRole('textbox',{name:'Pages to convert',exact:true}).fill('3, 2, 1')
      const ext=route==='pdf-to-png'?'png':'jpg'
      output={file:'output.zip',kind:'zip',members:[2,1,0].map(i=>({file:`source-page-${i+1}.${ext}`,kind:ext==='png'?'png':'jpeg',image_reference:{file:'source.pdf',page:i,dpi:96,pixel_tolerance:8}}))}
    }
    if(route==='pdf-to-text')output={file:'output.txt',kind:'txt',ordered_text:['PAGE-1','Prüfung','PAGE-2','Prüfung','PAGE-3','Prüfung']}
    await expect(page.getByRole('button',{name:actions[route],exact:true})).toBeEnabled()
    await click(page,actions[route]);await expect(page.getByRole('region',{name:'Results',exact:true})).toBeVisible()
    await save(page,dir,output.file as string,route==='pdf-to-png'||route==='pdf-to-jpg'?'Download all as ZIP':undefined)
    await writeFile(join(dir,'manifest.json'),JSON.stringify({outputs:[output]}));validate(dir)
    if(route==='images-to-pdf') {
      // Independent raster comparison at 96 DPI reverses original-size layout.
      execFileSync('python3',['-c',`import pymupdf,sys; sys.path.insert(0,'../scripts'); from validate_outputs import pixel_error; d=pymupdf.open(${JSON.stringify(join(dir,'output.pdf'))}); a=d[0].get_pixmap(matrix=pymupdf.Matrix(96/72,96/72)); b=pymupdf.Pixmap(${JSON.stringify(join(dir,'source.png'))}); assert pixel_error(a,b)<2`])
    }
    if(route==='pdf-to-png'||route==='pdf-to-jpg') {
      const ext=route==='pdf-to-png'?'png':'jpg';await save(page,dir,`individual.${ext}`,`Download source-page-3.${ext}`)
      execFileSync('python3',['-c',`import zipfile; from pathlib import Path; p=Path(${JSON.stringify(dir)}); assert (p/'individual.${ext}').read_bytes()==zipfile.ZipFile(p/'output.zip').read('source-page-3.${ext}')`])
    }
  } finally {await rm(dir,{recursive:true,force:true})}
})

// Each supported PDF corpus case is exported by the page-copy engine through the UI.
// Forms/annotations are reviewed separately: page-copy output does not promise interactive preservation.
for(const fixture of ['F-001-plain-text-3p.pdf','F-002-plain-text-30p.pdf','F-003-mixed-sizes.pdf','F-004-rotated-pages.pdf','F-005-form-acroform.pdf','F-006-annotations.pdf','F-007-image-page.pdf','F-008-scan-like.pdf','F-009-signed-marker.pdf','F-014-outline.pdf','F-015-pages-60p.pdf']) test(`independent corpus export: ${fixture}`,async({page})=>{
  test.setTimeout(120_000)
  const dir=await mkdtemp(join(tmpdir(),'foliolocal-corpus-'))
  try {
    const bytes=await readFile(`../fixtures/pdf/${fixture}`);await writeFile(join(dir,'source.pdf'),bytes)
    await page.goto('extract-pages/');await page.locator('input[type=file]').setInputFiles({name:'source.pdf',mimeType:'application/pdf',buffer:bytes})
    await expect(page.getByRole('button',{name:'Page 1',exact:true})).toBeVisible()
    // Full document and page plan come from the external parser, not the production engine.
    const count=Number(execFileSync('python3',['-c',`import pymupdf; print(len(pymupdf.open(${JSON.stringify(join(dir,'source.pdf'))})))`],{encoding:'utf8'}).trim())
    await page.getByRole('textbox',{name:'Pages to extract',exact:true}).fill(`1-${count}`)
    await click(page,'Extract pages');await expect(page.getByRole('region',{name:'Results',exact:true})).toBeVisible();await save(page,dir,'output.pdf')
    await writeFile(join(dir,'manifest.json'),JSON.stringify({outputs:[{file:'output.pdf',kind:'pdf',pages:count,reference:{file:'source.pdf',pages:Array.from({length:count},(_,i)=>i),ignore_annotations:fixture.startsWith('F-005')||fixture.startsWith('F-006')}}]}));validate(dir)
  } finally {await rm(dir,{recursive:true,force:true})}
})

for(const fixture of ['F-007-photo.jpg','F-013-diagram.png']) test(`independent image corpus export: ${fixture}`,async({page})=>{
  const dir=await mkdtemp(join(tmpdir(),'foliolocal-image-'))
  try {
    const path=`../fixtures/images/${fixture}`
    await page.goto('images-to-pdf/');await page.locator('input[type=file]').setInputFiles(path)
    await page.getByRole('combobox',{name:'Page size',exact:true}).selectOption('original')
    await page.getByRole('combobox',{name:'Original size DPI',exact:true}).selectOption('96')
    await page.getByLabel('Margins (points)',{exact:true}).fill('0')
    await click(page,'Create PDF');await expect(page.getByRole('region',{name:'Results',exact:true})).toBeVisible();await save(page,dir,'output.pdf')
    await writeFile(join(dir,'manifest.json'),JSON.stringify({outputs:[{file:'output.pdf',kind:'pdf',pages:1}]}));validate(dir)
    execFileSync('python3',['-c',`import pymupdf,sys; sys.path.insert(0,'../scripts'); from validate_outputs import pixel_error; d=pymupdf.open(${JSON.stringify(join(dir,'output.pdf'))}); a=d[0].get_pixmap(matrix=pymupdf.Matrix(96/72,96/72)); b=pymupdf.Pixmap(${JSON.stringify(path)}); b=pymupdf.Pixmap(b,0) if b.alpha else b; assert pixel_error(a,b)<8`])
  } finally {await rm(dir,{recursive:true,force:true})}
})
