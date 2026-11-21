import { toolError } from '../registry'

/** One filename policy at selection, verification, ZIP and download boundaries.
 * Names remain plain text; this is not an HTML escaping function. */
function clean(raw: string): string {
  return raw.normalize('NFC').split(/[\\/]/).pop()!
    // Control, bidi/zero-width formatting and platform-reserved characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff<>:"'`;&${}|?*]/g, '')
    .replace(/^[\s.]+|[\s.]+$/g, '')
}

export function sanitizeFileName(raw: string, fallback = 'document'): string {
  let name = clean(raw ?? '') || clean(fallback) || 'document'
  if (/^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?: *\.| *$)/i.test(name)) name = `_${name}`
  // Preserve a short extension when bounding the name, without splitting a surrogate pair.
  const extension = name.match(/\.[a-z0-9]{1,10}$/i)?.[0] ?? ''
  const stem = extension ? name.slice(0, -extension.length) : name
  // Bound both UTF-16 units and UTF-8 bytes (common filesystem component limit).
  const encoder = new TextEncoder()
  let bounded = ''
  let bytes = encoder.encode(extension).length
  for (const character of stem) {
    const size = encoder.encode(character).length
    if (bounded.length + character.length + extension.length > 120 || bytes + size > 255) break
    bounded += character
    bytes += size
  }
  name = bounded + extension
  return name.replace(/[\s.]+$/g, '') || 'document'
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf', 'application/zip': 'zip', 'text/plain': 'txt',
  'image/jpeg': 'jpg', 'image/png': 'png',
}

/** A verified file's declared format decides its download extension. */
export function safeDownloadName(raw: string, mimeType: string): string {
  const name = sanitizeFileName(raw, 'output')
  const extension = Object.hasOwn(EXTENSIONS, mimeType) ? EXTENSIONS[mimeType] : undefined
  if (!extension) throw toolError('E-OUT-01', 'Unsupported download format.', 'retry-job')
  const stem = name.replace(/\.[^.]*$/, '') || 'output'
  return sanitizeFileName(`${stem}.${extension}`, `output.${extension}`)
}
