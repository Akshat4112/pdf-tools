/**
 * File session and output lifecycle — PT-FND-004.
 *
 * Implements the PT-PD-003 data-lifecycle contract in code:
 * - memory-only session: original bytes, outputs, previews live in JS memory
 * - central object-URL registry: created lazily, revoked on every reset path,
 *   auditable count (must be 0 after reset — PT-SEC-002 checks this)
 * - file names sanitized before any DOM/download use (PT-SEC-001 groundwork)
 * - no persistence: no localStorage/IndexedDB/URL writes anywhere in this module
 * - Clear files = tool reset; session reset cancels jobs + revokes everything
 */

import { QUOTAS, toolError } from '../registry'
import { JobSession } from '../jobs/orchestrator'

export interface SessionFile {
  /** stable per-session id */
  readonly id: number
  /** SANITIZED display name (never raw user string in the DOM) */
  readonly displayName: string
  /** mime type validated at selection */
  readonly mimeType: 'application/pdf' | 'image/jpeg' | 'image/png'
  readonly bytes: Uint8Array
  readonly addedAt: number
}

export interface SessionOutput {
  readonly id: number
  readonly name: string
  readonly mimeType: string
  readonly bytes: Uint8Array
  /** created lazily on first download affordance; tracked for revocation */
  objectUrl?: string
}

/** PT-SEC-001: sanitize file names — text, no path traversal, no control chars. */
export function sanitizeFileName(raw: string, fallback = 'document'): string {
  let name = (raw ?? '')
    .split(/[\\/]/) // strip any path components
    .pop()!
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '') // control chars
    .replace(/[<>"'`;&${}\\]/g, '') // chars that could confuse markup/shell contexts
    .trim()
  if (!name) name = fallback
  if (name.length > 120) name = name.slice(0, 120)
  return name
}

const MIME_BY_EXT: Record<string, SessionFile['mimeType']> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
}

export function sniffMimeFromName(name: string): SessionFile['mimeType'] | null {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return MIME_BY_EXT[ext] ?? null
}

let nextFileId = 1
let nextOutputId = 1

export class FileSession {
  private files = new Map<number, SessionFile>()
  private outputs = new Map<number, SessionOutput>()
  private objectUrls = new Map<string, Blob>() // url -> blob for audit + revoke
  readonly jobs = new JobSession()

  /** accepted mime types per tool input kind (registry InputKind) */
  addFile(rawName: string, bytes: Uint8Array, kind: 'pdf' | 'image'): SessionFile {
    if (!bytes || bytes.byteLength === 0) {
      throw toolError('E-INPUT-03', 'The file is empty.', 'retry-file')
    }
    if (bytes.byteLength > QUOTAS.maxInputBytes) {
      throw toolError(
        'E-INPUT-04',
        `This file exceeds the current limit of ${Math.round(QUOTAS.maxInputBytes / 1048576)} MB.`,
        'show-limits',
      )
    }
    const displayName = sanitizeFileName(rawName)
    const mimeType = sniffMimeFromName(rawName)
    if (!mimeType) {
      throw toolError('E-INPUT-01', 'This file type is not supported by this tool yet.', 'show-formats')
    }
    if (kind === 'pdf' && mimeType !== 'application/pdf') {
      throw toolError('E-INPUT-01', 'This tool accepts PDF files.', 'show-formats')
    }
    if (kind === 'image' && mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
      throw toolError('E-INPUT-01', 'This tool accepts JPG and PNG images.', 'show-formats')
    }
    const file: SessionFile = {
      id: nextFileId++,
      displayName,
      mimeType,
      bytes,
      addedAt: Date.now(),
    }
    this.files.set(file.id, file)
    return file
  }

  removeFile(id: number): boolean {
    return this.files.delete(id)
  }

  getFile(id: number): SessionFile | undefined {
    return this.files.get(id)
  }

  listFiles(): SessionFile[] {
    return [...this.files.values()]
  }

  addOutput(name: string, mimeType: string, bytes: Uint8Array): SessionOutput {
    const output: SessionOutput = {
      id: nextOutputId++,
      name: sanitizeFileName(name, 'output'),
      mimeType,
      bytes,
    }
    this.outputs.set(output.id, output)
    return output
  }

  getOutput(id: number): SessionOutput | undefined {
    return this.outputs.get(id)
  }

  listOutputs(): SessionOutput[] {
    return [...this.outputs.values()]
  }

  /**
   * Lazily create a download URL for an output. Every URL is tracked so reset
   * paths can revoke it (PT-PD-003 §6 object-URL discipline).
   */
  objectUrlFor(outputId: number): string {
    const out = this.outputs.get(outputId)
    if (!out) throw toolError('E-OUT-02', 'The output is no longer available.', 'retry-job')
    if (out.objectUrl) return out.objectUrl
    // TS 5.7+ Blob requires ArrayBuffer-backed views; engines hand back
    // ArrayBufferLike views. Copy once into a fresh offset-0 buffer (also
    // satisfies the PT-SP-001 §2.2 normalization rule).
    const bytes = new Uint8Array(out.bytes.byteLength)
    bytes.set(out.bytes)
    const blob = new Blob([bytes.buffer], { type: out.mimeType })
    const url = URL.createObjectURL(blob)
    this.objectUrls.set(url, blob)
    const updated: SessionOutput = { ...out, objectUrl: url }
    this.outputs.set(outputId, updated)
    return url
  }

  /** PT-FT-014-style honesty: outputs must verify before being offered. */
  markVerified(outputId: number): void {
    const out = this.outputs.get(outputId)
    if (!out) throw toolError('E-OUT-02', 'The output is no longer available.', 'retry-job')
  }

  get objectUrlCount(): number {
    return this.objectUrls.size
  }

  /**
   * Tool reset (Clear files): drop files, outputs and revoke all object URLs.
   * Leaves UI preferences untouched (PT-PD-003 §5 level 1).
   */
  clearFiles(): void {
    this.revokeAllObjectUrls()
    this.files.clear()
    this.outputs.clear()
  }

  /**
   * Session reset: tool reset + cancel all jobs (PT-PD-003 §5 level 2).
   * The app calls this on Start over and on page unload (best-effort).
   */
  resetSession(): void {
    this.jobs.cancelAll()
    this.clearFiles()
  }

  private revokeAllObjectUrls(): void {
    for (const url of this.objectUrls.keys()) {
      URL.revokeObjectURL(url)
    }
    this.objectUrls.clear()
  }

  /**
   * Audit helper for PT-SEC-002: after any reset this must report 0/0/0.
   * It is deliberately explicit — no hidden state.
   */
  audit(): { files: number; outputs: number; objectUrls: number; activeJobs: number } {
    return {
      files: this.files.size,
      outputs: this.outputs.size,
      objectUrls: this.objectUrls.size,
      activeJobs: this.jobs.activeCount,
    }
  }
}
