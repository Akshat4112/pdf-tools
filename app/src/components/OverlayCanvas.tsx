import { useEffect, useRef, useState } from 'react'
import { openDocument, type PdfjsDocument, type PdfjsPage } from '../engines/pdfjs'

/** Render the requested page of the actual modified PDF, never an approximation of its typography. */
export function OverlayCanvas({ bytes, pageNumber, onReady }: { bytes: Uint8Array; pageNumber: number; onReady(): void }) {
  const canvas = useRef<HTMLCanvasElement>(null), [status,setStatus] = useState('Rendering preview…')
  useEffect(()=>{
    const controller = new AbortController(), target=canvas.current
    let doc: PdfjsDocument|undefined,page:PdfjsPage|undefined,task:{promise:Promise<void>;cancel?:()=>void}|undefined
    void (async()=>{
      try {
        doc=await openDocument(bytes,{signal:controller.signal,maxCanvasBytes:8_000_000})
        if(controller.signal.aborted||!target)return
        page=await doc.getPage(pageNumber)
        if(controller.signal.aborted)return
        const original=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(600/original.width,800/original.height)})
        target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height)
        const context=target.getContext('2d');if(!context)throw new Error('Canvas unavailable')
        task=page.render({canvas:target,canvasContext:context,viewport,background:'#ffffff'})
        await task.promise;if(!controller.signal.aborted){setStatus('Preview ready');onReady()}
      }catch{if(!controller.signal.aborted)setStatus('The PDF preview could not be rendered. Try another PDF.')}
      finally{page?.cleanup();await doc?.destroy()}
    })()
    return()=>{task?.cancel?.();controller.abort();if(target){target.width=0;target.height=0}}
  },[bytes,pageNumber,onReady])
  return <div className="overlay-canvas"><canvas ref={canvas} aria-label="Modified PDF page preview" role="img"/><p className="panel-hint" role="status">{status}</p></div>
}
