import { useCallback, useEffect, useRef, useState } from 'react'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import { CancelledPanel, FailurePanel, PreviewPanel, ProcessingPanel } from './ToolScreens'
import { phaseFromJobState } from './screenPhase'
import { formatBytes } from './format'
import { startDocumentInfo, type DocumentInfo, type DocumentInfoInput, type InfoField } from '../tools/documentInfoFlow'
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { ToolError } from '../registry'

function InfoFields({ fields }: { fields: InfoField[] }) {
  return <dl className="document-info-list">{fields.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}{item.truncated ? <span className="panel-hint"> (truncated to 1,000 characters)</span> : null}</dd></div>)}</dl>
}
const encryptionLabels = { 'password-required': 'Password required — inspection limited', encrypted: 'Encryption reported — opened without a password', 'none-reported': 'No encryption reported by the parser', unknown: 'Unknown' }
function signatureLabel(report: DocumentInfo): string {
  if (report.locked || report.signatureEntries === undefined) return 'Unknown — not inspected'
  if (report.signatureEntries > 0) return `${report.signatureEntries} digital signature entries reported — validity not verified`
  if (report.signatureFlag) return 'Signature flag present; no signed entries reported — validity not verified'
  return 'No digital signature entries reported — validity not verified'
}
export function DocumentInfoTool({ onExit }: { onExit(): void }) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]), [state, setState] = useState<JobState | null>(null)
  const [progress, setProgress] = useState<JobProgress>({ fraction: 0 }), [result, setResult] = useState<DocumentInfo | null>(null), [error, setError] = useState<ToolError | null>(null), [pageOffset, setPageOffset] = useState(0)
  const job = useRef<Job<DocumentInfoInput, DocumentInfo> | null>(null), active = useRef(true)
  const selected = files.find(file => !file.error), phase = phaseFromJobState(state)
  useEffect(() => { active.current = true; return () => { active.current = false; job.current?.cancel(); job.current = null } }, [])
  const adjust = useCallback(() => { const old = job.current; job.current = null; old?.cancel(); setState(null); setResult(null); setError(null); setProgress({ fraction: 0 }); setPageOffset(0) }, [])
  const changeFiles = (next: WorkspaceFile[]) => { adjust(); setFiles(next) }
  const reset = () => changeFiles([])
  const run = () => {
    if (!selected) return
    adjust()
    const next = startDocumentInfo({ file: { displayName: selected.displayName, bytes: selected.bytes } }, {
      onState: value => { if (active.current && job.current === next) setState(value) },
      onProgress: value => { if (active.current && job.current === next) setProgress(value) },
    })
    job.current = next; setState(next.state)
    void next.completion.then(() => {
      if (!active.current || job.current !== next) return
      if (next.state === 'done' && next.result) setResult(next.result)
      if (next.error) setError(next.error)
    })
  }
  return <div className="tool-screen document-info-tool">
    <header className="tool-header"><h1 className="tool-heading">Document information</h1><p className="tool-subtitle">Inspect a PDF's page geometry and metadata on your device.</p></header>
    <p className="panel-hint">No page text is extracted. Nothing is uploaded or saved. Metadata is supplied by the document and may be incomplete or inaccurate.</p>
    <FileSelection expected="pdf" multiple={false} files={files} onChange={changeFiles} allowEncrypted />
    {phase === 'configure' ? <PreviewPanel title="Inspect this PDF" summary="Read page count, visible dimensions, standard metadata, encryption and digital signature indicators. Locked PDFs show a limited report; passwords and certificate validation are not supported." actionLabel="Inspect PDF" onConfirm={run} onCancel={onExit} disabled={!selected} disabledReason="Choose a PDF first." /> : null}
    {phase === 'processing' ? <ProcessingPanel label="Inspecting document information" progress={progress} onCancel={() => job.current?.cancel()} /> : null}
    {phase === 'failed' && error ? <FailurePanel error={error} onRetry={adjust} onReset={reset} /> : null}
    {phase === 'cancelled' ? <CancelledPanel onAdjust={adjust} onReset={reset} /> : null}
    {phase === 'result' && result ? <>
      <section className="panel" aria-label="Document summary"><h2 className="panel-title">{result.locked ? 'Limited inspection — password required' : 'Document summary'}</h2>
        <InfoFields fields={[
          {label:'File',value:result.name,truncated:false}, {label:'File size',value:`${formatBytes(result.byteLength)} (${result.byteLength.toLocaleString('en-US')} bytes)`,truncated:false},
          {label:'Pages',value:result.pageCount?.toString() ?? 'Unavailable — password required',truncated:false}, {label:'PDF version',value:result.version ?? 'Unknown',truncated:false},
          {label:'Encryption',value:encryptionLabels[result.encryption],truncated:false}, {label:'Digital signatures',value:signatureLabel(result),truncated:false},
        ]} />
        <p role="note">Signature indicators do not verify authenticity, trust, certificate expiry or document integrity. A visible signature stamp is not proof of a digital signature. Modifying a PDF can invalidate digital signatures; inspection leaves the original bytes unchanged.</p>
        {result.warnings.map(warning => <p role="note" key={warning}>{warning}</p>)}
      </section>
      {result.fields.length ? <section className="panel" aria-label="Document metadata"><h2 className="panel-title">Document metadata</h2><p className="panel-hint">Dates are shown as stored, including any timezone. Missing fields are not inferred.</p><InfoFields fields={result.fields} />{result.xmp.length ? <details><summary>XMP metadata</summary><InfoFields fields={result.xmp} /></details> : <p className="panel-hint">No XMP metadata supplied.</p>}</section> : null}
      {result.pages.length ? <section className="panel" aria-label="Page dimensions"><h2 className="panel-title">Page dimensions</h2><p className="panel-hint">Visible cropped dimensions include page rotation and UserUnit scaling. 1 point = 1/72 inch.</p><div className="document-info-table"><table><caption>Pages {pageOffset+1}–{Math.min(pageOffset+25,result.pages.length)} of {result.pages.length}</caption><thead><tr><th scope="col">Page</th><th scope="col">Visible size</th><th scope="col">Rotation</th><th scope="col">UserUnit</th></tr></thead><tbody>{result.pages.slice(pageOffset,pageOffset+25).map(page => <tr key={page.number}><th scope="row">{page.number}</th><td>{page.width.toFixed(2)} × {page.height.toFixed(2)} pt<br/>{(page.width*25.4/72).toFixed(2)} × {(page.height*25.4/72).toFixed(2)} mm</td><td>{page.rotation}°</td><td>{page.userUnit}</td></tr>)}</tbody></table></div>{result.pages.length > 25 ? <div className="panel-actions"><button className="btn-ghost" disabled={pageOffset===0} onClick={() => setPageOffset(offset => Math.max(0,offset-25))}>Previous pages</button><button className="btn-ghost" disabled={pageOffset+25>=result.pages.length} onClick={() => setPageOffset(offset => offset+25)}>Next pages</button></div> : null}</section> : null}
      <div className="panel-actions"><button className="btn-ghost" onClick={adjust}>Inspect again</button><button className="btn-ghost" onClick={reset}>Start over</button><button className="btn-ghost" onClick={onExit}>Back to all tools</button></div>
    </> : null}
  </div>
}
