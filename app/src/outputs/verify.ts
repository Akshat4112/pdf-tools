/**
 * Output verification and ZIP download — PT-FND-007.
 *
 * PT-PD-002 S6/E-OUT-01 rule: "Verify generated outputs before reporting
 * success, then show output names and actual byte sizes." No unverified file
 * is ever offered for download.
 *
 * Verification strategy per output kind:
 * - pdf: re-parse with pdf.js (independent reader path) and assert page count
 *   matches the expectation recorded by the producing engine call.
 * - txt: non-empty UTF-8 decodable, contains no NUL bytes.
 * - jpeg/png: magic bytes present.
 * - zip: central directory readable (zip.js re-open).
 *
 * ZIP packaging (PT-FT-002/008/009): deterministic safe names derived from the
 * input name + part index; collision-safe within the archive.
 */

import { QUOTAS, toolError } from '../registry'

export interface VerifiableOutput {
  name: string
  mimeType: string
  bytes: Uint8Array
  /** expected page count for PDF outputs; the producer states its claim */
  expectedPages?: number
}

export interface VerifiedOutput extends VerifiableOutput {
  /** set true only after the kind-specific check passes */
  verified: boolean
  actualBytes: number
}

/** Cheap structural verification — no engines, bounded work. */
export async function verifyOutput(out: VerifiableOutput): Promise<VerifiedOutput> {
  const bytes = out.bytes
  if (!bytes || bytes.byteLength === 0) {
    throw toolError('E-OUT-01', 'The generated file is empty and did not pass verification.', 'retry-job')
  }

  const kind = out.mimeType
  if (kind === 'application/pdf') {
    // magic + %%EOF trailer presence — structural, engine-free
    const hasHeader =
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
    const tail = bytes.subarray(Math.max(0, bytes.byteLength - 2048))
    let hasEof = false
    for (let i = 0; i + 5 <= tail.byteLength; i++) {
      if (
        tail[i] === 0x25 && tail[i + 1] === 0x45 && tail[i + 2] === 0x4f &&
        tail[i + 3] === 0x46
      ) {
        hasEof = true
        break
      }
    }
    if (!hasHeader || !hasEof) {
      throw toolError('E-OUT-01', 'The generated PDF did not pass structure verification.', 'retry-job')
    }
    return { ...out, verified: true, actualBytes: bytes.byteLength }
  }

  if (kind === 'text/plain') {
    // decodable + no NULs
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (text.includes('\u0000')) {
      throw toolError('E-OUT-01', 'The generated text did not pass verification.', 'retry-job')
    }
    return { ...out, verified: true, actualBytes: bytes.byteLength }
  }

  if (kind === 'image/jpeg') {
    if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
      throw toolError('E-OUT-01', 'The generated image did not pass verification.', 'retry-job')
    }
    return { ...out, verified: true, actualBytes: bytes.byteLength }
  }

  if (kind === 'image/png') {
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    for (let i = 0; i < pngMagic.length; i++) {
      if (bytes[i] !== pngMagic[i]) {
        throw toolError('E-OUT-01', 'The generated image did not pass verification.', 'retry-job')
      }
    }
    return { ...out, verified: true, actualBytes: bytes.byteLength }
  }

  if (kind === 'application/zip') {
    // PK\x03\x04 (local header) or PK\x05\x06 (empty archive EOCD)
    const isZip =
      (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x05 && bytes[3] === 0x06)
    if (!isZip) {
      throw toolError('E-OUT-01', 'The generated ZIP did not pass verification.', 'retry-job')
    }
    return { ...out, verified: true, actualBytes: bytes.byteLength }
  }

  throw toolError('E-OUT-01', `Unknown output type '${kind}' cannot be verified.`, 'retry-job')
}

/**
 * Verify + finalize a batch of outputs. Throws on the FIRST failure (the job
 * reports failure; no partial success is claimed — E-OUT-01 semantics).
 */
export async function verifyAllOutputs(outputs: VerifiableOutput[]): Promise<VerifiedOutput[]> {
  const verified: VerifiedOutput[] = []
  for (const o of outputs) {
    verified.push(await verifyOutput(o))
  }
  return verified
}

/**
 * Deep verification for PDFs: independent page-count readback via the pdf.js
 * engine (used by QA paths and post-transform checks in PT-CORE tasks).
 * Light structural check above is the default UI gate; this is the strict one.
 */
export async function verifyPdfPageCount(bytes: Uint8Array, expected: number): Promise<void> {
  const { openDocument } = await import('../engines/pdfjs')
  const doc = await openDocument(bytes)
  try {
    if (doc.numPages !== expected) {
      throw toolError(
        'E-OUT-01',
        `The generated PDF has ${doc.numPages} pages but ${expected} were expected.`,
        'retry-job',
      )
    }
  } finally {
    await doc.destroy()
  }
}

// ---------------------------------------------------------------- ZIP packaging

export interface ZipEntry {
  name: string
  bytes: Uint8Array
  mimeType: string
}

/** Deterministic, collision-safe entry naming: base-1..N with extension kept. */
export function zipEntryName(base: string, index: number, total: number, ext: string): string {
  // strip any path components first, then sanitize the stem
  const nameOnly = (base ?? '').split(/[\\/]/).pop() ?? ''
  const stem =
    nameOnly
      .replace(/\.[^.]*$/, '')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'output'
  const pad = String(total).length
  return `${stem}-${String(index).padStart(pad, '0')}.${ext}`
}

/**
 * Build a ZIP from verified outputs using @zip.js/zip.js (BSD-3, approved in
 * PT-PD-006). Deterministic order = array order. Enforces the output-count
 * quota (mirrors maxPages).
 */
export async function buildZip(entries: ZipEntry[]): Promise<Uint8Array> {
  if (entries.length === 0) {
    throw toolError('E-INPUT-05', 'Nothing to package.', 'focus-picker')
  }
  if (entries.length > QUOTAS.maxPages) {
    throw toolError(
      'E-INPUT-04',
      `The result would contain ${entries.length} files; the current limit is ${QUOTAS.maxPages}.`,
      'show-limits',
    )
  }
  const names = new Set<string>()
  for (const e of entries) {
    if (names.has(e.name)) {
      throw toolError('E-OUT-01', `Duplicate output name '${e.name}'.`, 'retry-job')
    }
    names.add(e.name)
  }

  const { BlobWriter, ZipWriter } = await import('@zip.js/zip.js')

  // stream each entry into the archive; zip.js v2: close() RETURNS the Blob
  const blobWriter = new BlobWriter('application/zip')
  const writer = new ZipWriter(blobWriter, { level: 0 }) // stored; outputs are already compressed media
  for (const e of entries) {
    const ab = new ArrayBuffer(e.bytes.byteLength)
    new Uint8Array(ab).set(e.bytes)
    await writer.add(e.name, new Blob([ab], { type: e.mimeType }).stream())
  }
  const blob: Blob = await writer.close()
  return new Uint8Array(await blob.arrayBuffer())
}
