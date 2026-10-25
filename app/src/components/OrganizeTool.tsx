import { useCallback, useEffect, useReducer, useRef, useState, type PointerEvent } from 'react'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import { PageThumbnail } from './PageThumbnail'
import { CancelledPanel, FailurePanel, PreviewPanel, ProcessingPanel, ResultPanel } from './ToolScreens'
import { phaseFromJobState } from './screenPhase'
import { FileSession } from '../session/fileSession'
import { openDocument, type PdfjsDocument } from '../engines/pdfjs'
import { getTool, QUOTAS, toolError, type ToolError } from '../registry'
import { EMPTY_ORGANIZE, initialPages, organizeReducer, planKey, UNDO_LIMIT, type OrganizeAction } from '../tools/organizePlan'
import { startOrganize, type OrganizeInput } from '../tools/organizeFlow'
import type { Job, JobProgress, JobState } from '../jobs/orchestrator'
import type { VerifiedOutput } from '../outputs/verify'

const VIEW_SIZE = 8
interface DocumentState { fileId: number; doc?: PdfjsDocument; rotations?: number[]; error?: ToolError }

export function OrganizeTool({ mode = 'organize', onExit }: { mode?: 'organize' | 'rotate'; onExit?: () => void }) {
  const tool = getTool(mode)
  const organizing = mode === 'organize'
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [documentState, setDocumentState] = useState<DocumentState | null>(null)
  const [editor, dispatch] = useReducer(organizeReducer, EMPTY_ORGANIZE)
  const [picked, setPicked] = useState<number[]>([])
  const [viewStart, setViewStart] = useState(0)
  const [destination, setDestination] = useState('1')
  const [confirmed, setConfirmed] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [dropPosition, setDropPosition] = useState<number | null>(null)
  const [state, setState] = useState<JobState | null>(null)
  const [progress, setProgress] = useState<JobProgress>({ fraction: 0 })
  const [result, setResult] = useState<VerifiedOutput | null>(null)
  const [error, setError] = useState<ToolError | null>(null)
  const [session] = useState(() => new FileSession())
  const job = useRef<Job<OrganizeInput, VerifiedOutput> | null>(null)
  const active = useRef(true)
  const dragging = useRef<number | null>(null)
  const prepareDragHandle = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return
    // Cancel the native touch gesture only on the handle. This prevents an
    // ending drag from leaving a scroll/compatibility-click gesture in flight.
    const blockGesture = (event: TouchEvent) => event.preventDefault()
    node.addEventListener('touchstart', blockGesture, { passive: false })
    return () => node.removeEventListener('touchstart', blockGesture)
  }, [])
  const selected = files.find((f) => !f.error)
  const current = selected && documentState?.fileId === selected.id ? documentState : undefined
  const doc = current?.doc
  const rotations = current?.rotations ?? []
  const pages = doc ? editor.pages : []
  const selectedIds = picked.filter((id) => pages.some((p) => p.id === id))
  const finalSources = new Set(pages.map((p) => p.sourcePage))
  const removed = rotations.map((_, i) => i + 1).filter((n) => !finalSources.has(n))
  const duplicateCount = pages.length - finalSources.size
  const dirty = Boolean(doc && planKey(pages) !== planKey(initialPages(rotations)))
  const reviewKey = `${selected?.id}:${planKey(pages)}`
  const canRun = dirty && pages.length > 0 && (!removed.length || confirmed === reviewKey)
  const phase = phaseFromJobState(state)
  const start = Math.min(viewStart, Math.max(0, Math.floor((pages.length - 1) / VIEW_SIZE) * VIEW_SIZE))
  const validDestination = /^\d+$/.test(destination) && Number(destination) >= 1 && Number(destination) <= pages.length

  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      job.current?.cancel()
      job.current = null
      session.resetSession()
    }
  }, [session])

  useEffect(() => {
    if (!selected) return
    let disposed = false
    let loaded: PdfjsDocument | undefined
    void (async () => {
      try {
        loaded = await openDocument(selected.bytes)
        const angles: number[] = []
        if (!loaded.numPages) throw toolError('E-INPUT-03', 'This PDF has no pages.', 'retry-file')
        for (let i = 1; i <= loaded.numPages; i++) {
          if (disposed) return
          const page = await loaded.getPage(i)
          angles.push(page.rotate)
          page.cleanup()
        }
        if (disposed) return
        dispatch({ type: 'load', rotations: angles })
        setDocumentState({ fileId: selected.id, doc: loaded, rotations: angles })
      } catch (e) {
        if (!disposed) setDocumentState({ fileId: selected.id, error: typeof (e as ToolError)?.code === 'string' ? e as ToolError : toolError('E-INPUT-03', 'This file could not be read as a PDF.', 'retry-file') })
        if (loaded) void loaded.destroy().catch(() => {})
      } finally {
        if (disposed && loaded) void loaded.destroy().catch(() => {})
      }
    })()
    return () => { disposed = true; if (loaded) void loaded.destroy().catch(() => {}) }
  }, [selected])

  const resetJob = useCallback(() => {
    const old = job.current
    job.current = null
    old?.cancel()
    session.resetSession()
    setState(null)
    setResult(null)
    setError(null)
    setProgress({ fraction: 0 })
    setConfirmed(null)
  }, [session])
  const changeFiles = useCallback((next: WorkspaceFile[]) => {
    resetJob()
    dragging.current = null
    setDropPosition(null)
    setDocumentState(null)
    dispatch({ type: 'load', rotations: [] })
    setFiles(next)
    setPicked([])
    setViewStart(0)
    setDestination('1')
    setMessage('')
  }, [resetJob])

  const edit = (action: OrganizeAction, announcement: string) => {
    dispatch(action)
    setConfirmed(null)
    setMessage(announcement)
    if (action.type === 'undo' || action.type === 'delete' || action.type === 'restore') setPicked([])
  }
  const move = (id: number, to: number) => {
    edit({ type: 'move', id, to }, `Page moved to output position ${to + 1}.`)
    setViewStart(Math.floor(to / VIEW_SIZE) * VIEW_SIZE)
  }
  const positionAt = (event: PointerEvent<HTMLElement>) => {
    const card = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-output-position]')
    return card && event.currentTarget.closest('.organize-tool')?.contains(card) ? Number(card.dataset.outputPosition) : null
  }
  const run = () => {
    if (!canRun || !selected) return
    setError(null)
    setResult(null)
    setProgress({ fraction: 0 })
    const next = startOrganize({ mode, file: { displayName: selected.displayName, bytes: selected.bytes }, plan: pages.map(({ sourcePage, rotation }) => ({ sourcePage, rotation })) }, {
      onProgress: (value) => { if (active.current && job.current === next) setProgress(value) },
      onState: () => { if (active.current && job.current === next) setState(next.state) },
    })
    job.current = next
    setState(next.state)
    session.jobs.track(next)
    void next.completion.then(() => {
      if (!active.current || job.current !== next) return
      if (next.state === 'done' && next.result) setResult(next.result)
      if (next.state === 'failed' && next.error) setError(next.error)
    })
  }
  const download = (output: VerifiedOutput) => {
    const stored = session.listOutputs()[0] ?? session.addOutput(output.name, output.mimeType, output.bytes)
    const anchor = document.createElement('a')
    anchor.href = session.objectUrlFor(stored.id)
    anchor.download = stored.name
    anchor.click()
  }
  const reset = () => changeFiles([])

  return (
    <div className="tool-screen organize-tool">
      <header className="tool-header"><h1 className="tool-heading">{tool.title}</h1><p className="tool-subtitle">{tool.description}</p></header>
      {phase === 'configure' ? <>
        <FileSelection expected="pdf" multiple={false} files={files} onChange={changeFiles} />
        {selected ? <section className="panel" aria-label="Page workspace">
          <h2 className="panel-title">{organizing ? 'Arrange the new copy' : 'Choose pages to rotate'}</h2>
          <p className="panel-summary">{organizing ? 'Drag a handle to another page, or use Move earlier/later with touch or keyboard. Thumbnails show the exact output order and orientation.' : 'Select pages, then rotate left or right. Existing rotations are included in the preview.'}</p>
          {doc ? <>
            <div className="panel-actions organize-toolbar">
              <button type="button" className="btn-ghost" onClick={() => setPicked(pages.map(p => p.id))}>Select all pages</button>
              <button type="button" className="btn-ghost" onClick={() => setPicked([])}>Clear selection</button>
              <button type="button" className="btn-ghost" disabled={!selectedIds.length} onClick={() => edit({ type: 'rotate', ids: selectedIds, delta: -90 }, 'Selected pages rotated left.')}>Rotate selected left</button>
              <button type="button" className="btn-ghost" disabled={!selectedIds.length} onClick={() => edit({ type: 'rotate', ids: selectedIds, delta: 90 }, 'Selected pages rotated right.')}>Rotate selected right</button>
              {organizing ? <button type="button" className="btn-ghost" disabled={!selectedIds.length || selectedIds.length === pages.length} onClick={() => edit({ type: 'delete', ids: selectedIds }, 'Selected pages removed from the new copy. Undo restores them.')}>Delete selected pages</button> : null}
              <button type="button" className="btn-ghost" disabled={!editor.history.length} onClick={() => edit({ type: 'undo' }, 'Last change undone.')}>Undo</button>
              <button type="button" className="btn-ghost" disabled={!dirty} onClick={() => edit({ type: 'restore', rotations }, 'Original pages and rotations restored.')}>Restore original pages</button>
            </div>
            <p className="panel-hint">{pages.length} output pages · {selectedIds.length} selected · undo keeps the last {UNDO_LIMIT} changes. Keep at least one page; limit {QUOTAS.maxPages} pages.</p>
            {organizing ? <div className="organize-move-field">
              <label htmlFor="organize-position">Move one selected page to position</label>
              <input id="organize-position" type="number" min="1" max={pages.length} value={destination} onChange={e => setDestination(e.target.value)} aria-invalid={!validDestination} />
              <button type="button" className="btn-ghost" disabled={selectedIds.length !== 1 || !validDestination} onClick={() => move(selectedIds[0], Number(destination) - 1)}>Move selected page</button>
            </div> : null}
            <div className="organize-grid" role="group" aria-label="Output page order">
              {pages.slice(start, start + VIEW_SIZE).map((page, offset) => {
                const index = start + offset
                const position = index + 1
                return <div className={`organize-card${dropPosition === index ? ' is-drop-target' : ''}`} key={page.id} data-output-position={index}>
                  <PageThumbnail key={`${page.id}:${page.rotation}`} doc={doc} pageNumber={page.sourcePage} rotation={page.rotation} selected={selectedIds.includes(page.id)} deleting={false}
                    label={`Output page ${position}, source page ${page.sourcePage}`} caption={`Output ${position} · source ${page.sourcePage}`} detail={`${page.rotation}°`}
                    onToggle={() => setPicked(ids => ids.includes(page.id) ? ids.filter(id => id !== page.id) : [...ids, page.id])} />
                  <div className="organize-card-actions">
                    {organizing ? <>
                      <span ref={prepareDragHandle} className="btn-ghost organize-drag" aria-hidden="true" title="Drag to reorder; use Earlier/Later with a keyboard."
                        onPointerDown={e => { if (!e.isPrimary || e.button !== 0 || dragging.current !== null) return; e.preventDefault(); dragging.current = page.id; e.currentTarget.setPointerCapture(e.pointerId); setDropPosition(index) }}
                        onPointerMove={e => {
                          if (!e.isPrimary || dragging.current === null) return
                          if (e.clientY < 60) window.scrollBy(0, -24)
                          else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 24)
                          setDropPosition(positionAt(e))
                        }}
                        onPointerUp={e => {
                          if (!e.isPrimary) return
                          const to = positionAt(e)
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
                          if (dragging.current !== null && to !== null) move(dragging.current, to)
                          dragging.current = null
                          setDropPosition(null)
                        }}
                        onPointerCancel={e => { if (e.isPrimary) { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); dragging.current = null; setDropPosition(null) } }}>Drag</span>
                      <button type="button" className="btn-ghost" aria-label={`Move earlier at position ${position}`} disabled={index === 0} onClick={() => move(page.id, index - 1)}>Earlier</button>
                      <button type="button" className="btn-ghost" aria-label={`Move later at position ${position}`} disabled={position === pages.length} onClick={() => move(page.id, index + 1)}>Later</button>
                    </> : null}
                    <button type="button" className="btn-ghost" aria-label={`Rotate right at position ${position}`} onClick={() => edit({ type: 'rotate', ids: [page.id], delta: 90 }, `Output page ${position} rotated right.`)}>Rotate ↻</button>
                    {organizing ? <>
                      <button type="button" className="btn-ghost" aria-label={`Duplicate at position ${position}`} disabled={pages.length >= QUOTAS.maxPages} onClick={() => edit({ type: 'duplicate', id: page.id }, `Output page ${position} duplicated. Copies can be edited independently.`)}>Duplicate</button>
                      <button type="button" className="btn-ghost" aria-label={`Delete at position ${position}`} disabled={pages.length === 1} onClick={() => edit({ type: 'delete', ids: [page.id] }, `Output page ${position} removed. Undo restores it.`)}>Delete</button>
                    </> : null}
                  </div>
                </div>
              })}
            </div>
            <nav className="page-pagination" aria-label="Output thumbnails">
              <button type="button" className="btn-ghost" disabled={start === 0} onClick={() => setViewStart(start - VIEW_SIZE)}>Previous pages</button>
              <span>Output pages {start + 1}–{Math.min(start + VIEW_SIZE, pages.length)} of {pages.length}</span>
              <button type="button" className="btn-ghost" disabled={start + VIEW_SIZE >= pages.length} onClick={() => setViewStart(start + VIEW_SIZE)}>Next pages</button>
            </nav>
          </> : null}
          <p className="page-selection-status" role={current?.error ? 'alert' : 'status'}>{current?.error ? current.error.message : !doc ? 'Reading the document…' : message || 'Select pages or use the controls below each thumbnail.'}</p>
        </section> : null}
        <PreviewPanel title={organizing ? 'Organize preview' : 'Rotation preview'} summary={doc ? `${pages.length}-page PDF · ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'} · ${removed.length} source page${removed.length === 1 ? '' : 's'} removed` : 'Choose a PDF to edit locally.'}
          details={doc ? [`Output source order: ${pages.map(p => p.sourcePage).join(', ')}`, `Final rotations: ${pages.map(p => `${p.rotation}°`).join(', ')}`, ...(removed.length ? [`Source pages to remove: ${removed.join(', ')}`] : []), 'A new copy is created. Your original stays untouched; changes can invalidate digital signatures. Document-level forms and bookmarks may not be preserved.'] : undefined}
          actionLabel={organizing ? 'Create organized copy' : 'Create rotated copy'} onConfirm={run} disabled={!canRun}
          disabledReason={!doc ? 'Choose a readable PDF first.' : !dirty ? 'Make at least one change above.' : 'Review and confirm the removed source pages below.'} onCancel={onExit} />
        {removed.length ? <label className="page-delete-confirmation"><input type="checkbox" checked={confirmed === reviewKey} onChange={e => setConfirmed(e.target.checked ? reviewKey : null)} /><span>I reviewed the output order and source pages to remove. Create a new copy without those pages.</span></label> : null}
      </> : null}
      {phase === 'processing' ? <ProcessingPanel label="Creating and verifying your new copy" progress={progress} onCancel={() => job.current?.cancel()} /> : null}
      {phase === 'result' && result ? <ResultPanel outputs={[result]} onDownload={download} onRetry={resetJob} retryLabel="Adjust settings" onReset={reset} onContinue={onExit} /> : null}
      {phase === 'failed' && error ? <FailurePanel error={error} onRetry={resetJob} onReset={reset} /> : null}
      {phase === 'cancelled' ? <CancelledPanel onReset={reset} onAdjust={resetJob} /> : null}
    </div>
  )
}
