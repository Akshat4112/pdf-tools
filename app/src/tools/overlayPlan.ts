import { toolError } from '../registry'
import { OVERLAY_SUPPORTED_CODEPOINTS } from '../assets/overlayCoverage'

export type OverlayMode = 'page-numbers' | 'watermark'
export type OverlayPosition = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right' | 'center' | 'diagonal-center'
export interface OverlayOptions { text: string; startNumber: number; position: OverlayPosition; fontSize: number; opacity: number; margin: number; color: string; replaceUnsupported: boolean }
export const overlayDefaults = (mode: OverlayMode): OverlayOptions => ({ text: 'CONFIDENTIAL', startNumber: 1, position: mode === 'watermark' ? 'diagonal-center' : 'bottom-center', fontSize: mode === 'watermark' ? 36 : 12, opacity: mode === 'watermark' ? 0.4 : 1, margin: 18, color: mode === 'watermark' ? '#666666' : '#171717', replaceUnsupported: false })
const supported = new Set(OVERLAY_SUPPORTED_CODEPOINTS)
export function unsupportedCharacters(text: string): string[] { return [...new Set(Array.from(text.normalize('NFC')).filter(char => !supported.has(char.codePointAt(0)!)))] }
export function normalizeOverlayOptions(mode: OverlayMode, input: Partial<OverlayOptions> = {}): OverlayOptions {
  const value = { ...overlayDefaults(mode), ...input }
  const positions: OverlayPosition[] = ['bottom-left','bottom-center','bottom-right','top-left','top-center','top-right','center','diagonal-center']
  if (!['page-numbers','watermark'].includes(mode) || !positions.includes(value.position) || (mode === 'page-numbers' && value.position === 'diagonal-center') || !Number.isFinite(value.fontSize) || value.fontSize < 8 || value.fontSize > 120 || !Number.isFinite(value.opacity) || value.opacity < 0.01 || value.opacity > 1 || !Number.isFinite(value.margin) || value.margin < 0 || value.margin > 144 || !Number.isSafeInteger(value.startNumber) || value.startNumber < 1 || value.startNumber > 999999999 || !/^#[0-9a-f]{6}$/i.test(value.color) || typeof value.replaceUnsupported !== 'boolean') throw toolError('E-CONFIG-01', 'Choose a valid position, font size (8–120 pt), opacity (1–100%), margin (0–144 pt) and starting number (1–999999999).', 'fix-field')
  if(typeof value.text!=='string')throw toolError('E-CONFIG-01','Enter watermark text.','fix-field')
  value.text = value.text.normalize('NFC').trim()
  if (mode === 'watermark') {
    if (!value.text || Array.from(value.text).length > 120 || Array.from(value.text).some(char => char.codePointAt(0)! < 32 || char.codePointAt(0) === 127)) throw toolError('E-CONFIG-01', 'Enter 1–120 characters on one line for the watermark.', 'fix-field')
    if (unsupportedCharacters(value.text).length) {
      if (!value.replaceUnsupported) throw toolError('E-CONFIG-01', 'Some characters are outside the bundled font. Edit the text or explicitly choose replacement with question marks.', 'fix-field')
      value.text = Array.from(value.text).map(char => supported.has(char.codePointAt(0)!) ? char : '?').join('')
    }
  }
  return value
}
export interface OverlayViewport { width: number; height: number; transform: number[] }
export interface OverlayPlacement { x: number; y: number; angle: number; width: number; height: number; matrix: [number, number, number, number, number, number] }
/** Lay out upright text in visible, physical-point space, then invert PDF.js's exact viewport. */
export function overlayPlacement(view: OverlayViewport, textWidth: number, ascent: number, descent: number, options: OverlayOptions): OverlayPlacement {
  const { width, height, transform: m } = view
  if (m.length !== 6 || ![width,height,...m,textWidth,ascent,descent].every(Number.isFinite) || width <= 0 || height <= 0 || textWidth <= 0) throw toolError('E-CONFIG-01', 'The page has invalid overlay geometry.', 'fix-field')
  const angle = options.position === 'diagonal-center' ? 45 : 0, radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians)
  const corners = [[0,-descent],[textWidth,-descent],[0,ascent],[textWidth,ascent]].map(([x,y]) => [x*c-y*s,x*s+y*c])
  const minX = Math.min(...corners.map(p=>p[0])), maxX = Math.max(...corners.map(p=>p[0])), minY = Math.min(...corners.map(p=>p[1])), maxY = Math.max(...corners.map(p=>p[1]))
  const boxWidth = maxX-minX, boxHeight = maxY-minY, margin = options.margin
  if (boxWidth + 2*margin > width || boxHeight + 2*margin > height) throw toolError('E-CONFIG-01', 'The overlay does not fit this page. Reduce the font size or margin, or shorten the text.', 'fix-field')
  const targetX = options.position.endsWith('left') ? margin : options.position.endsWith('right') ? width-margin-boxWidth : (width-boxWidth)/2
  const targetY = options.position.startsWith('top') ? height-margin-boxHeight : options.position.startsWith('bottom') ? margin : (height-boxHeight)/2
  const [a,b,cc,d,e,f] = m, determinant = a*d-b*cc
  if (!Number.isFinite(determinant) || determinant === 0) throw toolError('E-CONFIG-01', 'The page transformation is not invertible.', 'fix-field')
  // inverse(viewport) × flipY(height): visible bottom-left points -> original PDF units.
  const matrix: OverlayPlacement['matrix'] = [d/determinant,-b/determinant,cc/determinant,-a/determinant,(-d*e+cc*f-cc*height)/determinant,(b*e-a*f+a*height)/determinant]
  return { x: targetX-minX, y: targetY-minY, angle, width: boxWidth, height: boxHeight, matrix }
}
