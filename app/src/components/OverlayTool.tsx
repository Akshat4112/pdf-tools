import { useLocale } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import { OverlayCanvas } from './OverlayCanvas'
import { CancelledPanel, FailurePanel, PreviewPanel, ProcessingPanel, ResultPanel } from './ToolScreens'
import { phaseFromJobState } from './screenPhase'
import { FileSession } from '../session/fileSession'
import { openDocument } from '../engines/pdfjs'
import { parsePageRanges } from '../lib/pageRanges'
import { normalizeOverlayOptions, overlayDefaults, unsupportedCharacters, type OverlayMode, type OverlayOptions, type OverlayPosition } from '../tools/overlayPlan'
import { startOverlay, type OverlayInput, type OverlayOutcome } from '../tools/overlayFlow'
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { ToolError } from '../registry'
import type { VerifiedOutput } from '../outputs/verify'

export function OverlayTool({mode,onExit}:{mode:OverlayMode;onExit():void}) {
  const { t } = useLocale()
  const [files,setFiles]=useState<WorkspaceFile[]>([]),[options,setOptions]=useState(()=>overlayDefaults(mode)),[expression,setExpression]=useState(''),[previewPage,setPreviewPage]=useState(1)
  const [source,setSource]=useState<{id:number;count?:number;error?:ToolError}|null>(null),[preview,setPreview]=useState<{key:string;result?:OverlayOutcome;error?:ToolError}|null>(null)
  const [renderedKey,setRenderedKey]=useState<string|null>(null)
  const [state,setState]=useState<JobState|null>(null),[progress,setProgress]=useState<JobProgress>({fraction:0}),[result,setResult]=useState<OverlayOutcome|null>(null),[error,setError]=useState<ToolError|null>(null)
  const [session]=useState(()=>new FileSession()),job=useRef<Job<OverlayInput,OverlayOutcome>|null>(null),active=useRef(true)
  const selected=files.find(file=>!file.error),count=selected&&source?.id===selected.id?source.count:undefined,sourceError=selected&&source?.id===selected.id?source.error:undefined,phase=phaseFromJobState(state)
  useEffect(()=>{active.current=true;return()=>{active.current=false;job.current?.cancel();job.current=null;session.resetSession()}},[session])
  const adjust=useCallback(()=>{setRenderedKey(null);const previous=job.current;job.current=null;previous?.cancel();session.resetSession();setState(null);setResult(null);setError(null);setProgress({fraction:0})},[session])
  const changeFiles=(next:WorkspaceFile[])=>{adjust();setFiles(next);setSource(null);setPreview(null);setExpression('');setPreviewPage(1)}
  const reset=()=>{changeFiles([]);setOptions(overlayDefaults(mode))}
  const change=(value:Partial<OverlayOptions>)=>{adjust();setOptions(current=>({...current,...value}))}
  useEffect(()=>{
    if(!selected)return
    const controller=new AbortController()
    void openDocument(selected.bytes,{strict:true,signal:controller.signal}).then(async doc=>{
      if(!controller.signal.aborted){setSource({id:selected.id,count:doc.numPages});setExpression(doc.numPages===1?'1':`1-${doc.numPages}`)}
      await doc.destroy()
    }).catch((error:ToolError)=>{if(!controller.signal.aborted)setSource({id:selected.id,error})})
    return()=>controller.abort()
  },[selected])
  let normalized:OverlayOptions|undefined,pages:number[]=[],configurationError:ToolError|undefined
  try{normalized=normalizeOverlayOptions(mode,options);if(count)pages=parsePageRanges(expression,count).pages.sort((a,b)=>a-b)}catch(error){configurationError=error as ToolError}
  const key=`${selected?.id}:${expression}:${previewPage}:${JSON.stringify(options)}`
  const readyOptions=normalized&&!configurationError&&count&&Number.isInteger(previewPage)&&previewPage>=1&&previewPage<=count
  useEffect(()=>{
    if(!selected||!readyOptions||phase!=='configure')return
    let disposed=false,next:Job<OverlayInput,OverlayOutcome>|undefined
    const timer=setTimeout(()=>{
      next=startOverlay({file:{displayName:selected.displayName,bytes:selected.bytes},mode,pagesExpr:expression,options,previewPage})
      void next.completion.then(()=>{if(!disposed)setPreview({key,result:next!.result,error:next!.error})})
    },250)
    return()=>{disposed=true;clearTimeout(timer);next?.cancel()}
  },[selected,key,readyOptions,phase,mode,expression,options,previewPage])
  const currentPreview=preview?.key===key?preview:undefined,problem=sourceError??configurationError??currentPreview?.error,canApply=Boolean(readyOptions&&currentPreview?.result?.output.verified&&renderedKey===key&&!problem)
  const previewReady=useCallback(()=>setRenderedKey(key),[key])
  const unsupported=mode==='watermark'?unsupportedCharacters(options.text):[]
  const run=()=>{
    if(!selected||!canApply||!normalized)return
    adjust()
    const next=startOverlay({file:{displayName:selected.displayName,bytes:selected.bytes},mode,pagesExpr:expression,options:normalized},{onProgress:value=>{if(active.current&&job.current===next)setProgress(value)},onState:value=>{if(active.current&&job.current===next)setState(value)}})
    job.current=next;session.jobs.track(next);setState(next.state)
    void next.completion.then(()=>{if(!active.current||job.current!==next)return;if(next.state==='done'&&next.result)setResult(next.result);if(next.error)setError(next.error)})
  }
  const download=(output:VerifiedOutput)=>{if(!output.verified)return;const stored=session.listOutputs().find(item=>item.name===output.name)??session.addOutput(output.name,output.mimeType,output.bytes);const anchor=document.createElement('a');anchor.href=session.objectUrlFor(stored.id);anchor.download=stored.name;anchor.click()}
  return <div className="tool-screen overlay-tool">
    <header className="tool-header"><h1 className="tool-heading">{mode==='page-numbers'?'Page numbers':'Text watermark'}</h1><p className="tool-subtitle">Add selectable text to a new PDF copy, entirely on your device.</p></header>
    {phase==='configure'?<>
      <FileSelection expected="pdf" multiple={false} files={files} onChange={changeFiles}/>
      <section className="panel" aria-label="Overlay settings"><h2 className="panel-title">{t("Choose text and placement")}</h2>
        <div className="overlay-settings">
          {mode==='watermark'?<label htmlFor="overlay-text">{t("Watermark text")}<input id="overlay-text" value={options.text} maxLength={240} onChange={event=>change({text:event.target.value,replaceUnsupported:false})}/></label>:<label htmlFor="overlay-start">{t("Starting number")}<input id="overlay-start" type="number" min="1" max="999999999" value={Number.isNaN(options.startNumber)?'':options.startNumber} onChange={event=>change({startNumber:event.target.value===''?NaN:Number(event.target.value)})}/></label>}
          <label htmlFor="overlay-position">{t("Position")}<select id="overlay-position" value={options.position} onChange={event=>change({position:event.target.value as OverlayPosition})}>{['bottom-left','bottom-center','bottom-right','top-left','top-center','top-right','center',...(mode==='watermark'?['diagonal-center']:[])].map(position=><option key={position} value={position}>{position.replaceAll('-',' ')}</option>)}</select></label>
          <label htmlFor="overlay-size">{t("Font size (pt)")}<input id="overlay-size" type="number" min="8" max="120" value={Number.isNaN(options.fontSize)?'':options.fontSize} onChange={event=>change({fontSize:event.target.value===''?NaN:Number(event.target.value)})}/></label>
          <label htmlFor="overlay-opacity">{t("Opacity (%)")}<input id="overlay-opacity" type="number" min="1" max="100" value={Number.isNaN(options.opacity)?'':Math.round(options.opacity*100)} onChange={event=>change({opacity:event.target.value===''?NaN:Number(event.target.value)/100})}/></label>
          <label htmlFor="overlay-margin">{t("Margin (pt)")}<input id="overlay-margin" type="number" min="0" max="144" value={Number.isNaN(options.margin)?'':options.margin} onChange={event=>change({margin:event.target.value===''?NaN:Number(event.target.value)})}/></label>
          <label htmlFor="overlay-color">{t("Text color")}<input id="overlay-color" type="color" value={options.color} onChange={event=>change({color:event.target.value})}/></label>
        </div>
        {unsupported.length?<div role="note"><p>Unsupported characters in the bundled English/German font: {unsupported.join(', ')}.</p><label><input type="checkbox" checked={options.replaceUnsupported} onChange={event=>change({replaceUnsupported:event.target.checked})}/> Replace each unsupported character with a question mark (?)</label></div>:null}
        <div className="page-range-field"><label htmlFor="overlay-pages">{t("Pages to modify")}</label><input id="overlay-pages" value={expression} disabled={!count} onChange={event=>{adjust();setExpression(event.target.value)}} placeholder="1-3, 5"/></div>
        <p className="panel-hint">Ranges and commas are supported. Unselected pages stay unchanged. {mode==='page-numbers'?'Numbers advance only on selected pages, in document order.':'The preview and output use the same embedded font and opacity.'} Placement follows the visible cropped page and its rotation; review it so text does not cover important content.</p>
        <p className="panel-hint">Your original is preserved. A modified copy can invalidate digital signatures. This adds text; it does not edit or remove existing content.</p>
        {problem?<p role="alert">{problem.message}</p>:null}
      </section>
      {selected&&count?<section className="panel" aria-label="Overlay preview"><h2 className="panel-title">Preview — source page {previewPage}</h2><div className="panel-actions"><button className="btn-ghost" disabled={previewPage<=1} onClick={()=>setPreviewPage(page=>page-1)}>{t("Previous preview")}</button><label htmlFor="overlay-preview-page">{t("Preview page")}<input id="overlay-preview-page" type="number" min="1" max={count} value={previewPage||''} onChange={event=>setPreviewPage(Number(event.target.value))}/></label><span>of {count}</span><button className="btn-ghost" disabled={previewPage>=count} onClick={()=>setPreviewPage(page=>page+1)}>{t("Next preview")}</button></div><p className="panel-hint">{pages.includes(previewPage)?`This page will receive: ${mode==='page-numbers'?String((normalized?.startNumber??1)+pages.indexOf(previewPage)):normalized?.text??'—'}`:'This page is outside your selection and stays unchanged.'} Apply checks placement on every selected page.</p>{currentPreview?.result?<OverlayCanvas key={key} bytes={currentPreview.result.output.bytes} pageNumber={previewPage} onReady={previewReady}/>:<p role="status">{problem?'Correct the settings to create a preview.':!readyOptions?'Choose valid settings and a preview page.':'Preparing the modified PDF preview…'}</p>}</section>:null}
      <PreviewPanel title="Review and apply" summary={canApply?`Modify ${pages.length} of ${count} pages. The PDF page order is preserved.`:'Choose a PDF and valid settings, then wait for the modified preview.'} details={normalized?['A separately named PDF will be created and verified.',`Selected source pages: ${pages.join(', ')||'none'}`]:undefined} actionLabel={mode==='page-numbers'?'Apply page numbers':'Apply watermark'} onConfirm={run} onCancel={onExit} disabled={!canApply} disabledReason={problem?.message??'A verified preview is required.'}/>
    </>:null}
    {phase==='processing'?<ProcessingPanel label="Applying and verifying text overlays" progress={progress} onCancel={()=>job.current?.cancel()}/>:null}
    {phase==='failed'&&error?<FailurePanel error={error} onRetry={adjust} onReset={reset}/>:null}
    {phase==='cancelled'?<CancelledPanel onReset={reset} onAdjust={adjust}/>:null}
    {phase==='result'&&result?<ResultPanel outputs={[result.output]} onDownload={download} onRetry={adjust} retryLabel="Adjust settings" onReset={reset} onContinue={onExit}/>:null}
  </div>
}
