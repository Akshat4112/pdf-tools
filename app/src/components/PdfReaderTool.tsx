import { useLocale } from '../i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFViewer, EventBus, PDFFindController } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import 'pdfjs-dist/legacy/web/pdf_viewer.css'
import { FileSelection, type WorkspaceFile } from './FileSelection'
import { openDocument, type PdfjsDocument } from '../engines/pdfjs'
import { restrictPdfLinks } from '../security/pdfPolicy'
import { toolError, type ToolError } from '../registry'
import { clearPrintFrame, prepareReaderPrint } from '../tools/readerPrint'

interface ReaderSearchMatch { pageIndex: number; matchIndex: number; ordinal: number }
/** Version-pinned bridge: PDF.js has no public arbitrary-match navigation API. */
function navigateReaderMatch(viewer: PDFViewer, bus: EventBus, item: ReaderSearchMatch): void {
  const controller = viewer.findController
  if (!controller?.selected) return
  const navigation = controller as PDFFindController & { _offset: { pageIdx: number; matchIdx: number | null; wrapped: boolean }; _scrollMatches: boolean }
  Object.assign(controller.selected, { pageIdx: item.pageIndex, matchIdx: item.matchIndex })
  Object.assign(navigation._offset, { pageIdx: item.pageIndex, matchIdx: item.matchIndex, wrapped: false })
  navigation._scrollMatches = true
  viewer.currentPageNumber = item.pageIndex + 1
  bus.dispatch('updatetextlayermatches', { source: controller, pageIndex: -1 })
}

export function PdfReaderTool({ onExit }: { onExit(): void }) {
  const { t } = useLocale()
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const selected = files.find(file => !file.error)
  return <div className="tool-screen pdf-reader-tool">
    <header className="tool-header"><h1 className="tool-heading">{t("PDF reader")}</h1><p className="tool-subtitle">{t("Read, search, select text and print in your browser. Your PDF stays on this device.")}</p></header>
    <FileSelection expected="pdf" multiple={false} files={files} onChange={setFiles} />
    {selected ? <ReaderWorkspace key={selected.id} file={selected} /> : null}
    <div className="panel-actions"><button className="btn-ghost" onClick={() => setFiles([])}>{t("Start over")}</button><button className="btn-ghost" onClick={onExit}>{t("Back to all tools")}</button></div>
  </div>
}

function ReaderWorkspace({ file }: { file: WorkspaceFile }) {
  const { t } = useLocale()
  const container = useRef<HTMLDivElement>(null), pages = useRef<HTMLDivElement>(null)
  const viewer = useRef<PDFViewer | null>(null), bus = useRef<EventBus | null>(null), documentRef = useRef<PdfjsDocument | null>(null)
  const printRef = useRef<{ frame: HTMLIFrameElement; controller: AbortController } | null>(null)
  const [ready, setReady] = useState(false), [error, setError] = useState<ToolError | null>(null)
  const [page, setPage] = useState(1), [pageText, setPageText] = useState('1'), [count, setCount] = useState(0)
  const [zoom, setZoom] = useState('page-width'), [query, setQuery] = useState(''), [caseSensitive, setCaseSensitive] = useState(false)
  const [matches, setMatches] = useState({ current: 0, total: 0 }), [findState, setFindState] = useState(0)
  const [resultStart, setResultStart] = useState(0)
  const [matchPageCounts, setMatchPageCounts] = useState<number[]>([])
  const [textStatus, setTextStatus] = useState(''), [pageError, setPageError] = useState('')
  const [printRange, setPrintRange] = useState(''), [printStatus, setPrintStatus] = useState(''), [printing, setPrinting] = useState(false), [printReady, setPrintReady] = useState(false)
  const stopPrint = useCallback(() => {
    const current = printRef.current; printRef.current = null
    if (current) { current.controller.abort(); clearPrintFrame(current.frame) }
  }, [])

  useEffect(() => {
    let disposed = false, loaded: PdfjsDocument | undefined, instance: PDFViewer | undefined
    const lifecycle = new AbortController()
    void (async () => {
      try {
        loaded = await openDocument(file.bytes, { strict: true, maxCanvasBytes: 8_000_000 })
        if (disposed) { await loaded.destroy(); return }
        // The adapter initializes the matching core module before the viewer reads pdfjsLib.
        const { EventBus, PDFViewer, PDFLinkService, PDFFindController } = await import('pdfjs-dist/legacy/web/pdf_viewer.mjs')
        if (disposed) { await loaded.destroy(); return }
        const eventBus = new EventBus(), linkService = new PDFLinkService({ eventBus })
        restrictPdfLinks(linkService)
        const findController = new PDFFindController({ eventBus, linkService, delay: 100, updateMatchesCountOnProgress: false })
        instance = new PDFViewer({ container: container.current!, viewer: pages.current!, eventBus, linkService, findController,
          annotationMode: 1, annotationEditorMode: -1, textLayerMode: 1, enableAutoLinking: false,
          scriptingManager: undefined, downloadManager: undefined,
          imageResourcesPath: `${import.meta.env.BASE_URL}assets/pdfjs-images/`,
          maxCanvasPixels: 2_000_000, maxCanvasDim: 4096, enableDetailCanvas: false,
          // PDF.js runtime accepts a lifetime signal (missing from the distributed declaration).
          ...{ abortSignal: lifecycle.signal },
        })
        instance.scrollMode = 3 // one page at a time; canvas cache remains bounded
        linkService.setViewer(instance)
        eventBus.on('pagesinit', () => { if (!disposed) { instance!.currentScaleValue = 'page-width'; setReady(true) } })
        eventBus.on('pagechanging', ({ pageNumber }: { pageNumber: number }) => { if (!disposed) { setPage(pageNumber); setPageText(String(pageNumber)); setPageError('') } })
        eventBus.on('pagerendered', ({ error }: { error?: unknown }) => { if (!disposed) setPageError(error ? 'This page could not be rendered. Try another page or PDF.' : '') })
        const updateMatchCounts = (matchesCount: { current: number; total: number }) => {
          if (disposed) return
          setMatches(matchesCount); setMatchPageCounts((instance?.findController?.pageMatches ?? []).map(matches => matches?.length ?? 0))
        }
        eventBus.on('updatefindmatchescount', ({ matchesCount }: { matchesCount: { current: number; total: number } }) => updateMatchCounts(matchesCount))
        eventBus.on('updatefindcontrolstate', ({ state, matchesCount }: { state: number; matchesCount: { current: number; total: number } }) => { if (!disposed) { setFindState(state); updateMatchCounts(matchesCount) } })
        const native = loaded as unknown as PDFDocumentProxy
        linkService.setDocument(native); instance.setDocument(native)
        viewer.current = instance; bus.current = eventBus; documentRef.current = loaded
        setCount(loaded.numPages); setPrintRange(loaded.numPages === 1 ? '1' : `1-${loaded.numPages}`)
      } catch (failure) { if (!disposed) setError(typeof (failure as ToolError).code === 'string' ? failure as ToolError : toolError('E-PROC-02', 'The reader could not start. Choose a different PDF or try again.', 'retry-file')) }
    })()
    return () => {
      disposed = true; stopPrint(); lifecycle.abort()
      instance?.setDocument(null); viewer.current = null; bus.current = null; documentRef.current = null
      if (loaded) void loaded.destroy().catch(() => {})
    }
  }, [file, stopPrint])

  useEffect(() => {
    const doc = documentRef.current
    if (!ready || !doc) return
    let disposed = false
    setTextStatus('Checking page text…')
    void doc.getPage(page).then(item => item.getTextContent()).then(content => {
      if (!disposed) setTextStatus(content.items.some(item => item.str?.trim()) ? 'Select text directly on the page to copy it. Reading order can vary in complex layouts.' : 'No selectable text on this page. Scanned pages need OCR for search and copying; OCR is not available yet.')
    }).catch(() => { if (!disposed) setTextStatus('Text could not be extracted from this page.') })
    return () => { disposed = true }
  }, [page, ready])

  useEffect(() => {
    if (!ready) return
    bus.current?.dispatch('find', { source: null, type: '', query, caseSensitive, entireWord: false, highlightAll: true, findPrevious: false, matchDiacritics: false })
  }, [ready, query, caseSensitive])
  useEffect(() => {
    if (!ready || !container.current) return
    const resize = new ResizeObserver(() => { if (['page-width', 'page-fit'].includes(zoom) && viewer.current) { viewer.current.currentScaleValue = zoom; viewer.current.update() } })
    resize.observe(container.current)
    return () => resize.disconnect()
  }, [ready, zoom])

  const navigate = (number: number) => {
    if (!Number.isInteger(number) || number < 1 || number > count) { setPageError(`Choose a page from 1 to ${count}.`); return }
    if (viewer.current) viewer.current.currentPageNumber = number
    setPage(number); setPageText(String(number)); setPageError('')
  }
  const changeZoom = (value: string) => { setZoom(value); if (viewer.current) viewer.current.currentScaleValue = value }
  const findAgain = (previous: boolean) => bus.current?.dispatch('find', { source: null, type: 'again', query, caseSensitive, entireWord: false, highlightAll: true, findPrevious: previous, matchDiacritics: false })
  const resultItems: ReaderSearchMatch[] = []
  let ordinal = 0
  if (query && findState !== 3) for (const [pageIndex, pageMatches] of matchPageCounts.entries()) {
    for (let matchIndex = 0; matchIndex < (pageMatches ?? 0); matchIndex++) {
      if (ordinal >= resultStart && resultItems.length < 20) resultItems.push({ pageIndex, matchIndex, ordinal: ordinal + 1 })
      ordinal++
    }
  }
  const jumpMatch = (item: typeof resultItems[number]) => {
    if (!viewer.current || !bus.current) return
    navigateReaderMatch(viewer.current, bus.current, item)
    setMatches({ current: item.ordinal, total: matches.total }); setFindState(0)
  }
  const preparePrint = async () => {
    const doc = documentRef.current
    if (!doc) return
    stopPrint(); setPrintReady(false); setPrinting(true); setPrintStatus('Checking print dimensions…')
    const frame = document.createElement('iframe'), controller = new AbortController()
    frame.title = 'PDF print workspace'; frame.className = 'reader-print-frame'
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
    document.body.append(frame)
    const operation = { frame, controller }; printRef.current = operation
    try {
      await prepareReaderPrint(doc, printRange, frame, controller.signal, (done, total) => { if (printRef.current === operation) setPrintStatus(`Preparing print: ${done} of ${total} pages`) })
      if (printRef.current !== operation) return
      setPrintReady(true); setPrintStatus('Print pages are ready. Open the browser print dialog, then clear the print copy when finished.')
    } catch (failure) {
      if (printRef.current !== operation) return
      stopPrint(); setPrinting(false); setPrintStatus((failure as ToolError).message ?? 'Print preparation failed. Try fewer pages.')
    } finally { if (!controller.signal.aborted) setPrinting(false) }
  }
  const cancelPrint = () => { stopPrint(); setPrinting(false); setPrintReady(false); setPrintStatus('Print copy cleared. Your PDF and reader settings are retained.') }
  const print = () => {
    const target = printRef.current?.frame.contentWindow
    if (!target) return
    try { target.focus(); target.print() } catch { setPrintStatus('This browser could not open the print dialog. Try printing from a desktop browser.') }
  }

  return <section className="panel reader-workspace" aria-label="PDF reader workspace" onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && ready) { event.preventDefault(); document.getElementById('reader-search')?.focus() }
  }}>
    {error ? <p role="alert">{error.message}</p> : <>
      <div className="reader-toolbar" aria-label="Reader controls">
        <button className="btn-ghost" disabled={!ready || page <= 1} onClick={() => navigate(page - 1)}>{t("Previous page")}</button>
        <form onSubmit={event => { event.preventDefault(); navigate(pageText.trim() ? Number(pageText) : NaN) }}><label htmlFor="reader-page">{t("Page")}</label><input id="reader-page" inputMode="numeric" value={pageText} disabled={!ready} onChange={event => setPageText(event.target.value)} /><span>of {count || '…'}</span><button className="btn-ghost" disabled={!ready}>{t("Go")}</button></form>
        <button className="btn-ghost" disabled={!ready || page >= count} onClick={() => navigate(page + 1)}>{t("Next page")}</button>
        <label htmlFor="reader-zoom">{t("Zoom")}<select id="reader-zoom" disabled={!ready} value={zoom} onChange={event => changeZoom(event.target.value)}><option value="page-width">{t("Fit width")}</option><option value="page-fit">{t("Fit page")}</option>{[0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map(scale => <option key={scale} value={scale}>{scale * 100}%</option>)}</select></label>
      </div>
      <div className="reader-search"><label htmlFor="reader-search">{t("Search this PDF")}<input id="reader-search" type="search" value={query} maxLength={256} disabled={!ready} onChange={event => { setResultStart(0); setQuery(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); findAgain(event.shiftKey) } }} /></label><label className="reader-case"><input type="checkbox" checked={caseSensitive} disabled={!ready} onChange={event => { setResultStart(0); setCaseSensitive(event.target.checked) }} />{t("Match case")}</label><button className="btn-ghost" disabled={!ready || !query || !matches.total} onClick={() => findAgain(true)}>{t("Previous match")}</button><button className="btn-ghost" disabled={!ready || !query || !matches.total} onClick={() => findAgain(false)}>{t("Next match")}</button></div>
      <p className="panel-hint" role="status" aria-label="Search results">{!ready ? 'Opening PDF…' : !query ? 'Search text across all pages. Scans need OCR; text in images is not searchable.' : findState === 3 ? 'Searching…' : matches.total ? `${matches.current} of ${matches.total} matches${findState === 2 ? ' · Wrapped around' : ''}` : 'No matches. Scanned pages need OCR to become searchable.'}</p>
      {resultItems.length ? <div role="group" aria-label="Search match list"><ol start={resultStart + 1} className="reader-match-list">{resultItems.map(item => <li key={item.ordinal}><button className="btn-ghost" onClick={() => jumpMatch(item)} aria-current={matches.current === item.ordinal ? 'true' : undefined}>Page {item.pageIndex + 1}, match {item.matchIndex + 1}: {query}</button></li>)}</ol><div className="panel-actions"><button className="btn-ghost" disabled={resultStart === 0} onClick={() => setResultStart(start => Math.max(0, start - 20))}>{t("Previous results")}</button><span>Results {resultStart + 1}–{resultStart + resultItems.length} of {matches.total}</span><button className="btn-ghost" disabled={resultStart + 20 >= matches.total} onClick={() => setResultStart(start => start + 20)}>{t("Next results")}</button></div></div> : null}
      <p className="panel-hint" role="status" aria-label="Page text status">{textStatus}</p>
      {pageError ? <p role="alert">{pageError}</p> : null}
    </>}
    <div className="reader-viewport-shell" hidden={Boolean(error)}><div ref={container} className="reader-viewport" tabIndex={0} role="region" aria-label="PDF pages"><div ref={pages} className="pdfViewer" /></div></div>
    {ready ? <div className="reader-print"><h2 className="panel-title">{t("Print")}</h2><p className="panel-hint">Print copies are rendered locally at 96 DPI with a 64 MB pixel budget. Choose a smaller range for long documents. Page sizes and rotation are retained; browser paper settings can scale pages. Interactive controls are read-only and PDF scripts are never run.</p><label htmlFor="reader-print-range">{t("Pages to print")}<input id="reader-print-range" value={printRange} disabled={printing} onChange={event => { cancelPrint(); setPrintRange(event.target.value) }} /></label><div className="panel-actions"><button className="btn-ghost" disabled={printing} onClick={() => { cancelPrint(); setPrintRange(String(page)) }}>{t("Use current page")}</button><button className="btn-ghost" disabled={printing} onClick={() => { cancelPrint(); setPrintRange(count === 1 ? '1' : `1-${count}`) }}>{t("Use all pages")}</button><button className="btn-primary" disabled={printing} onClick={() => void preparePrint()}>{t("Prepare print pages")}</button>{printReady ? <button className="btn-primary" onClick={print}>{t("Open print dialog")}</button> : null}{printing || printReady ? <button className="btn-ghost" onClick={cancelPrint}>{printing ? 'Cancel print preparation' : 'Clear print copy'}</button> : null}</div><p role="status" aria-label="Print status" className="panel-hint">{printStatus}</p></div> : null}
  </section>
}
