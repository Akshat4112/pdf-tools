/**
 * File validation and error taxonomy — PT-FND-006.
 *
 * The single gate every selected file passes BEFORE any engine work:
 *   1. extension/mime contract (per tool input kind, from the registry)
 *   2. magic-byte sniff (extension lies are rejected honestly, not by crash)
 *   3. byte/page quotas (PT-SP-002 measured values)
 *   4. PDF structure sniff: header present, encrypted flag detected early
 *      (E-INPUT-02 BEFORE any parse attempt — PT-PD-001 support boundary)
 *   5. every failure maps to exactly one taxonomy code with a recovery affordance
 *
 * This module runs on the main thread at selection time — it must stay cheap:
 * no full parse, no engine import, bounded reads.
 */

import { QUOTAS, toolError } from '../registry'

export type InputKind = 'pdf' | 'image'

export interface ValidatedFileMeta {
  /** sanitized, DOM-safe display name */
  displayName: string
  /** resolved kind after sniffing, never trusting the extension alone */
  kind: 'pdf' | 'jpeg' | 'png'
  byteLength: number
  /** PDF only: true when the encryption dictionary was found (never decrypted) */
  encrypted: boolean
}

/** PT-SEC-001: display-safe names (same rules as FileSession). */
function sanitize(raw: string): string {
  const name = (raw ?? '')
    .split(/[\\/]/)
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>"'`;&${}\\]/g, '')
    .trim()
  return name.length > 120 ? name.slice(0, 120) : name || 'document'
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // %PDF
const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function startsWith(bytes: Uint8Array, magic: number[], within: number): boolean {
  // PDF spec allows a header within the first 1024 bytes; images must start at 0.
  const limit = Math.min(bytes.byteLength, within)
  outer: for (let start = 0; start < limit; start++) {
    if (bytes.byteLength - start < magic.length) break
    let matched = true
    for (let i = 0; i < magic.length; i++) {
      if (bytes[start + i] !== magic[i]) {
        matched = false
        continue outer
      }
    }
    if (matched) return true
  }
  return false
}

/**
 * Detect PDF encryption WITHOUT parsing or decrypting: scan the raw bytes for
 * the /Encrypt marker in the trailer/dictionary region. Bounded to the first
 * and last 4 KB + a middle slice — cheap and sufficient for the early-reject
 * contract (the full parse in the engine double-checks and also rejects).
 */
export function sniffPdfEncryption(bytes: Uint8Array): boolean {
  const marker = '/Encrypt'
  const regions: Array<[number, number]> = [
    [0, Math.min(bytes.byteLength, 4096)],
    [Math.max(0, bytes.byteLength - 4096), bytes.byteLength],
  ]
  for (const [from, to] of regions) {
    const slice = bytes.subarray(from, to)
    const text = latin1(slice)
    if (text.includes(marker)) return true
  }
  return false
}

function latin1(bytes: Uint8Array): string {
  let out = ''
  const chunk = 4096
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)))
  }
  return out
}

/**
 * Validate a selected file. Throws taxonomy ToolError on every failure path;
 * returns honest metadata on success. Never loads an engine.
 */
export function validateFile(
  rawName: string,
  bytes: Uint8Array,
  expected: InputKind,
  opts: { maxBytes?: number } = {},
): ValidatedFileMeta {
  const displayName = sanitize(rawName)

  // ---- size gate first (cheapest, no scanning) ----
  if (!bytes || bytes.byteLength === 0) {
    throw toolError('E-INPUT-03', 'The file is empty.', 'retry-file')
  }
  const maxBytes = opts.maxBytes ?? QUOTAS.maxInputBytes
  if (bytes.byteLength > maxBytes) {
    throw toolError(
      'E-INPUT-04',
      `This file exceeds the current limit of ${Math.round(maxBytes / 1048576)} MB.`,
      'show-limits',
    )
  }

  // ---- magic sniff: resolve the true kind ----
  let kind: ValidatedFileMeta['kind'] | null = null
  if (startsWith(bytes, PDF_MAGIC, 1024)) kind = 'pdf'
  else if (startsWith(bytes, JPEG_MAGIC, 1)) kind = 'jpeg'
  else if (startsWith(bytes, PNG_MAGIC, 1)) kind = 'png'

  if (!kind) {
    throw toolError(
      'E-INPUT-03',
      'This file could not be read as a PDF or image.',
      'retry-file',
    )
  }

  // ---- kind contract vs tool expectation ----
  if (expected === 'pdf' && kind !== 'pdf') {
    throw toolError('E-INPUT-01', 'This tool accepts PDF files.', 'show-formats')
  }
  if (expected === 'image' && kind === 'pdf') {
    throw toolError('E-INPUT-01', 'This tool accepts JPG and PNG images.', 'show-formats')
  }

  // ---- encrypted early-reject (PDF only; never attempt decryption) ----
  let encrypted = false
  if (kind === 'pdf' && sniffPdfEncryption(bytes)) {
    encrypted = true
    throw toolError(
      'E-INPUT-02',
      'This PDF is password-protected. Unlocking is not available in this release.',
      'explain-encryption',
    )
  }

  return { displayName, kind, byteLength: bytes.byteLength, encrypted }
}

/**
 * Batch-validate a selection: one bad file must not block the others
 * (PT-PD-002 §3 S2: "no page blocks on a single bad file"). Returns per-file
 * outcomes — the UI marks failures with reasons and keeps valid files.
 */
export interface FileOutcome {
  index: number
  ok: boolean
  meta?: ValidatedFileMeta
  error?: ReturnType<typeof toolError>
}

export function validateSelection(
  files: Array<{ name: string; bytes: Uint8Array }>,
  expected: InputKind,
  opts: { maxBytes?: number } = {},
): FileOutcome[] {
  return files.map((f, index) => {
    try {
      const meta = validateFile(f.name, f.bytes, expected, opts)
      return { index, ok: true, meta }
    } catch (err) {
      return { index, ok: false, error: err as ReturnType<typeof toolError> }
    }
  })
}
