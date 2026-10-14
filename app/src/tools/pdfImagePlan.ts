import { assertDpi, assertPixelBudget, type PdfjsPage } from '../engines/pdfjs'
import { QUOTAS, toolError } from '../registry'

export interface PdfImageOptions { format: 'jpeg' | 'png'; dpi: number; quality: number; background: 'white' | 'transparent' }
export const DEFAULT_PDF_IMAGE_OPTIONS: Readonly<PdfImageOptions> = Object.freeze({ format: 'jpeg', dpi: QUOTAS.defaultDpi, quality: 0.8, background: 'white' })
/** Conservative canvas/output guards; physical mobile memory benchmarks remain a separate task. */
export const PDF_IMAGE_LIMITS = Object.freeze({ maxDimensionPx: 8192, maxPixels: 16_000_000, maxEncodedBytes: QUOTAS.maxInputBytes })
export function normalizePdfImageOptions(input: Partial<PdfImageOptions> = {}): PdfImageOptions {
  const options = { ...DEFAULT_PDF_IMAGE_OPTIONS, ...input }
  assertDpi(options.dpi)
  if (!['jpeg','png'].includes(options.format) || !['white','transparent'].includes(options.background) || !Number.isFinite(options.quality) || options.quality < 0 || options.quality > 1) throw toolError('E-CONFIG-01', 'Choose JPG/PNG, valid background and JPEG quality from 0 to 1.', 'fix-field')
  if (options.format === 'jpeg' && options.background !== 'white') throw toolError('E-CONFIG-01', 'JPG uses a white background. Choose PNG for transparency.', 'fix-field')
  return options
}
export interface PdfImagePagePlan { sourcePage: number; width: number; height: number; rotation: number; viewport: { width: number; height: number } }
/** PDF.js viewports include CropBox, UserUnit and intrinsic rotation. Round up to keep the whole page. */
export function planPdfImagePage(page: PdfjsPage, sourcePage: number, options: PdfImageOptions): PdfImagePagePlan {
  assertDpi(options.dpi)
  const viewport = page.getViewport({ scale: options.dpi / 72 })
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) throw toolError('E-INPUT-03', 'This PDF page has invalid dimensions.', 'retry-file')
  const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height)
  if (width > PDF_IMAGE_LIMITS.maxDimensionPx || height > PDF_IMAGE_LIMITS.maxDimensionPx || width * height > PDF_IMAGE_LIMITS.maxPixels) throw toolError('E-PROC-02', 'This page exceeds the image size limit. Reduce DPI or select a smaller page.', 'reduce-scope')
  assertPixelBudget(width, height, 1)
  return { sourcePage, width, height, rotation: page.rotate, viewport }
}
