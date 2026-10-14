import { IMAGE_LIMITS, type ImageMetadata } from '../engines/imageMetadata'
import { QUOTAS, toolError } from '../registry'

export interface ImagePdfOptions {
  pageSize: 'a4' | 'letter' | 'original'
  orientation: 'auto' | 'portrait' | 'landscape'
  marginPt: number
  fit: 'contain' | 'cover'
  dpi: 96 | 150 | 200
  background: 'white'
}
export const DEFAULT_IMAGE_OPTIONS: Readonly<ImagePdfOptions> = Object.freeze({ pageSize: 'a4', orientation: 'auto', marginPt: 18, fit: 'contain', dpi: 150, background: 'white' })
export interface ImagePagePlan {
  widthPt: number; heightPt: number
  frame: { x: number; y: number; width: number; height: number }
  matrix: [number, number, number, number, number, number]
}
const invalid = () => toolError('E-CONFIG-01', 'Choose valid page sizing, fit, DPI and margins.', 'fix-field')

/** Shared pure geometry for the later preview and writer. Units are PDF points. */
export function planImagePage(image: ImageMetadata, opts: ImagePdfOptions): ImagePagePlan {
  if (!['a4','letter','original'].includes(opts.pageSize) || !['auto','portrait','landscape'].includes(opts.orientation) || !['contain','cover'].includes(opts.fit) || !QUOTAS.renderDpis.includes(opts.dpi) || opts.background !== 'white' || !Number.isFinite(opts.marginPt) || opts.marginPt < 0) throw invalid()
  if (!Number.isInteger(image.orientation) || image.orientation < 1 || image.orientation > 8 || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width <= 0 || image.height <= 0) throw invalid()
  const swap = image.orientation >= 5
  const iw = swap ? image.height : image.width, ih = swap ? image.width : image.height
  let [widthPt, heightPt] = opts.pageSize === 'letter' ? [612,792] : [595.276,841.89]
  if (opts.pageSize === 'original') {
    if (opts.orientation !== 'auto') throw invalid()
    widthPt = iw * 72 / opts.dpi + 2 * opts.marginPt
    heightPt = ih * 72 / opts.dpi + 2 * opts.marginPt
  } else if (opts.orientation === 'landscape' || (opts.orientation === 'auto' && iw > ih)) [widthPt,heightPt] = [heightPt,widthPt]
  if (widthPt > IMAGE_LIMITS.maxPagePt || heightPt > IMAGE_LIMITS.maxPagePt || opts.marginPt * 2 >= Math.min(widthPt,heightPt)) throw invalid()
  const frame = { x: opts.marginPt, y: opts.marginPt, width: widthPt - 2 * opts.marginPt, height: heightPt - 2 * opts.marginPt }
  const scale = (opts.fit === 'contain' ? Math.min : Math.max)(frame.width / iw, frame.height / ih)
  const w = iw * scale, h = ih * scale, x = (widthPt - w) / 2, y = (heightPt - h) / 2
  // Bottom-left PDF coordinates, including mirrored EXIF orientations.
  const transforms = [[1,0,0,1,0,0],[-1,0,0,1,1,0],[-1,0,0,-1,1,1],[1,0,0,-1,0,1],[0,-1,-1,0,1,1],[0,-1,1,0,0,1],[0,1,1,0,0,0],[0,1,-1,0,1,0]]
  const [a,b,c,d,e,f] = transforms[image.orientation - 1]
  return { widthPt, heightPt, frame, matrix: [w*a,h*b,w*c,h*d,x+w*e,y+h*f] }
}
