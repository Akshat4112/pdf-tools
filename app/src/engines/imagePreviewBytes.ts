/** Remove EXIF only from a temporary preview copy so native auto-orientation cannot run twice. */
export function imagePreviewBytes(bytes: Uint8Array, kind: 'jpeg' | 'png'): Uint8Array {
  // Caller already ran readImageMetadata, so segment lengths and chunk bounds are validated.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const parts: Uint8Array[] = [bytes.subarray(0, kind === 'png' ? 8 : 2)]
  let pos = kind === 'png' ? 8 : 2
  while (pos < bytes.length) {
    if (kind === 'png') {
      const end = pos + view.getUint32(pos) + 12
      if (String.fromCharCode(...bytes.subarray(pos + 4, pos + 8)) !== 'eXIf') parts.push(bytes.subarray(pos, end))
      pos = end
    } else {
      const start = pos
      while (bytes[pos] === 255) pos++
      const marker = bytes[pos++]
      if (marker === 0xda) { parts.push(bytes.subarray(start)); break }
      const end = pos + view.getUint16(pos)
      const exif = marker === 0xe1 && String.fromCharCode(...bytes.subarray(pos + 2, pos + 8)) === 'Exif\0\0'
      if (!exif) parts.push(bytes.subarray(start, end))
      pos = end
    }
  }
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) { out.set(part, at); at += part.length }
  return out
}
