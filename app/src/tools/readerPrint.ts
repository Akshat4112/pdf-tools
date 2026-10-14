import { assertRenderedImages, type PdfjsDocument } from '../engines/pdfjs'
import { parsePageRanges } from '../lib/pageRanges'
import { CancelledError } from '../jobs/orchestrator'
import { toolError } from '../registry'

export const PRINT_PIXEL_BUDGET = 16_000_000 // 64 MB of retained RGBA canvases

/** Print only app-created raster pages: no original PDF, scripts, links or forms enter the frame. */
export async function prepareReaderPrint(doc: PdfjsDocument, expression: string, frame: HTMLIFrameElement, signal: AbortSignal, progress: (done: number, total: number) => void): Promise<void> {
  const numbers = parsePageRanges(expression, doc.numPages).pages
  const plans: { number: number; width: number; height: number; pointsWidth: number; pointsHeight: number }[] = []
  const check = () => { if (signal.aborted) throw new CancelledError() }
  let pixels = 0
  // Preflight every selected page before allocating any print canvases.
  for (const number of numbers) {
    check()
    const page = await doc.getPage(number)
    check()
    const viewport = page.getViewport({ scale: 96 / 72 }), points = page.getViewport({ scale: 1 })
    const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height)
    pixels += width * height
    if (![width, height, points.width, points.height].every(value => Number.isFinite(value) && value > 0) || width > 8192 || height > 8192 || pixels > PRINT_PIXEL_BUDGET) {
      throw toolError('E-PROC-02', 'These pages exceed the 64 MB print pixel budget. Choose fewer pages or a smaller page range.', 'reduce-scope')
    }
    plans.push({ number, width, height, pointsWidth: points.width, pointsHeight: points.height })
  }
  check()
  const target = frame.contentDocument
  if (!target) throw toolError('E-PROC-02', 'The browser could not open the print workspace. Try again.', 'retry-file')
  target.title = 'PDF Tools print'
  const style = target.createElement('style')
  // All interpolation below is validated numeric geometry; no PDF text/markup is inserted.
  style.textContent = 'body{margin:0}canvas{display:block;max-width:100%;height:auto}section{break-after:page;overflow:hidden}section:last-child{break-after:auto}' + plans.map((plan, index) => `@page pdfPage${index}{size:${plan.pointsWidth}pt ${plan.pointsHeight}pt;margin:0}.print-page-${index}{page:pdfPage${index};width:${plan.pointsWidth}pt;height:${plan.pointsHeight}pt}`).join('')
  target.head.append(style)
  for (const [index, plan] of plans.entries()) {
    check()
    const page = await doc.getPage(plan.number)
    check()
    const section = target.createElement('section'), canvas = target.createElement('canvas')
    section.className = `print-page-${index}`; section.dataset.sourcePage = String(plan.number)
    canvas.width = plan.width; canvas.height = plan.height
    canvas.style.width = `${plan.pointsWidth}pt`; canvas.style.height = `${plan.pointsHeight}pt`
    section.append(canvas); target.body.append(section)
    const context = canvas.getContext('2d')
    if (!context) throw toolError('E-PROC-02', 'Canvas rendering is unavailable in this browser.', 'retry-file')
    const task = page.render({ canvas, canvasContext: context, viewport: page.getViewport({ scale: 96 / 72 }), background: '#ffffff', annotationMode: 1 })
    const cancel = () => task.cancel?.()
    signal.addEventListener('abort', cancel, { once: true })
    try { await task.promise; check(); await assertRenderedImages(page, () => signal.aborted); check() }
    finally { signal.removeEventListener('abort', cancel) }
    progress(index + 1, plans.length)
  }
  check()
}

export function clearPrintFrame(frame: HTMLIFrameElement): void {
  for (const canvas of frame.contentDocument?.querySelectorAll('canvas') ?? []) { canvas.width = 0; canvas.height = 0 }
  frame.remove()
}
