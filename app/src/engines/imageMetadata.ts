import { QUOTAS, toolError } from '../registry'
import { validateFile } from '../validation/validate'

/** Initial conservative guards, pending mobile memory benchmarks. */
export const IMAGE_LIMITS = Object.freeze({ maxPixels: 16_000_000, totalPixels: 25_600_000, totalBytes: QUOTAS.maxInputBytes, maxPagePt: 14_400 })
export interface ImageMetadata { kind: 'jpeg' | 'png'; width: number; height: number; orientation: number }
const corrupt = () => toolError('E-INPUT-03', 'This image or its orientation metadata is damaged.', 'retry-file')
const unsupported = () => toolError('E-INPUT-01', 'Use a static PNG or an 8-bit baseline/progressive JPG.', 'show-formats')

/** Bounded TIFF IFD0 reads; never follows thumbnail/camera-data pointers. */
export function readExifOrientation(bytes: Uint8Array): number {
  if (bytes.length < 8) throw corrupt()
  const little = bytes[0] === 73 && bytes[1] === 73
  if (!little && !(bytes[0] === 77 && bytes[1] === 77)) throw corrupt()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint16(2, little) !== 42) throw corrupt()
  const offset = view.getUint32(4, little)
  if (offset < 8 || offset + 2 > bytes.length) throw corrupt()
  const count = view.getUint16(offset, little)
  if (offset + 2 + count * 12 + 4 > bytes.length) throw corrupt()
  let orientation = 1, found = false
  for (let i = 0; i < count; i++) {
    const at = offset + 2 + i * 12
    if (view.getUint16(at, little) !== 0x112) continue
    if (found || view.getUint16(at + 2, little) !== 3 || view.getUint32(at + 4, little) !== 1) throw corrupt()
    orientation = view.getUint16(at + 8, little)
    if (orientation < 1 || orientation > 8) throw corrupt()
    found = true
  }
  return orientation
}
function dimensions(width: number, height: number) {
  if (!width || !height) throw corrupt()
  if (width * height > IMAGE_LIMITS.maxPixels) throw toolError('E-INPUT-04', 'An image exceeds 16 million pixels. Resize it and try again.', 'show-limits')
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let i = 0; i < 8; i++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
export function pngCrc(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
export function readImageMetadata(bytes: Uint8Array): ImageMetadata {
  const kind = validateFile('image', bytes, 'image').kind as 'jpeg' | 'png'
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width = 0, height = 0, orientation = 1, exif = false
  if (kind === 'png') {
    let pos = 8, data = false, end = false, palette = false, dataEnded = false
    while (pos + 12 <= bytes.length) {
      const len = view.getUint32(pos), next = pos + 12 + len
      if (len > 0x7fffffff || next > bytes.length) throw corrupt()
      const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
      if (!/^[A-Za-z]{4}$/.test(type) || pngCrc(bytes.subarray(pos + 4, pos + 8 + len)) !== view.getUint32(pos + 8 + len)) throw corrupt()
      if (pos === 8 && type !== 'IHDR') throw corrupt()
      const at = pos + 8
      if (type === 'IHDR') {
        if (pos !== 8 || len !== 13) throw corrupt()
        width = view.getUint32(at); height = view.getUint32(at + 4); dimensions(width, height)
        const depth = bytes[at + 8], color = bytes[at + 9]
        const depths: Record<number, number[]> = { 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] }
        if (!depths[color]?.includes(depth) || bytes[at + 10] !== 0 || bytes[at + 11] !== 0 || bytes[at + 12] > 1) throw corrupt()
      } else if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') throw unsupported()
      else if (type === 'eXIf') {
        if (exif) throw corrupt()
        orientation = readExifOrientation(bytes.subarray(at, at + len)); exif = true
      } else if (type === 'PLTE') {
        if (palette || data || !len || len % 3 || len > 768) throw corrupt()
        palette = true
      } else if (type === 'IDAT') {
        if (dataEnded || (bytes[25] === 3 && !palette)) throw corrupt()
        data = true
      } else if (type === 'IEND') {
        if (len || !data || next !== bytes.length) throw corrupt()
        end = true; break
      } else if (type[0] === type[0].toUpperCase()) throw unsupported()
      if (data && type !== 'IDAT') dataEnded = true
      pos = next
    }
    if (!end) throw corrupt()
  } else {
    let pos = 2, scan = false
    while (pos + 4 <= bytes.length) {
      if (bytes[pos++] !== 255) throw corrupt()
      while (bytes[pos] === 255) pos++
      if (pos + 3 > bytes.length) throw corrupt()
      const marker = bytes[pos++]
      const len = view.getUint16(pos), end = pos + len
      if (len < 2 || end > bytes.length) throw corrupt()
      if (marker === 0xda) {
        const components = bytes[pos + 2]
        if (!components || components > 4 || len !== 6 + 2 * components || end >= bytes.length - 2) throw corrupt()
        scan = true; break
      }
      if (marker === 0xd9 || marker === 0 || marker === 0xd8) throw corrupt()
      const at = pos + 2
      if (marker === 0xe1 && len >= 8 && String.fromCharCode(...bytes.subarray(at, at + 6)) === 'Exif\0\0') {
        if (exif) throw corrupt()
        orientation = readExifOrientation(bytes.subarray(at + 6, end)); exif = true
      }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4,0xc8,0xcc].includes(marker)) {
        if (![0xc0,0xc2].includes(marker)) throw unsupported()
        if (width || len < 8 || bytes[at] !== 8 || ![1,3,4].includes(bytes[at + 5])) throw unsupported()
        height = view.getUint16(at + 1); width = view.getUint16(at + 3)
        if (len !== 8 + 3 * bytes[at + 5]) throw corrupt()
        dimensions(width, height)
      }
      pos = end
    }
    if (!scan || !width || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 0xd9) throw corrupt()
  }
  return { kind, width, height, orientation }
}
