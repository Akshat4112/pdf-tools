/**
 * File selection workspace — PT-UX-002.
 *
 * The shared S1/S2 component (PT-PD-002 §3) every tool embeds:
 * - accessible file picker + drag/drop target (keyboard and touch complete)
 * - per-file rows with sanitized display names rendered as TEXT (never markup)
 * - validation runs on selection (PT-FND-006) and failures are marked with
 *   reason + Remove, never blocking other files
 * - measured limits displayed up front (PT-SP-002 §3)
 * - reorder (merge order) by pointer buttons and keyboard
 * - Clear files wired to the session reset (PT-PD-003 §5)
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { QUOTAS, toolError, type InputKind } from '../registry'
import { formatBytes } from './format'
import { validateSelection, type InputKind as ValidateKind } from '../validation/validate'
import type { ToolError } from '../registry'
import { sanitizeFileName } from '../session/fileSession'

/** registry per-file kind -> validator expectation */
function toValidateKind(kind: InputKind): ValidateKind {
  return kind === 'pdf' ? 'pdf' : 'image'
}

export interface WorkspaceFile {
  id: number
  displayName: string
  bytes: Uint8Array
  sizeLabel: string
  error?: ToolError
}

let nextWspId = 1

interface FileSelectionProps {
  expected: InputKind
  multiple: boolean
  files: WorkspaceFile[]
  onChange(files: WorkspaceFile[]): void
  /** i18n hook point (PT-UX-005); defaults en */
  labels?: Partial<FileSelectionLabels>
  /** Read-only inspection can report locked PDFs without unlocking. */
  allowEncrypted?: boolean
  maxFiles?: number
  maxTotalBytes?: number
}

export interface FileSelectionLabels {
  dropzone: string
  browse: string
  clear: string
  limits: string
  moveUp: string
  moveDown: string
  remove: string
  emptyHint: string
}

const DEFAULT_LABELS: FileSelectionLabels = {
  dropzone: 'Drop files here',
  browse: 'Choose files',
  clear: 'Clear files',
  limits: `Up to ${QUOTAS.maxInputBytes / (1024 * 1024)} MB per file · ${QUOTAS.maxPages} pages · processed locally`,
  moveUp: 'Move earlier',
  moveDown: 'Move later',
  remove: 'Remove this file',
  emptyHint: 'No files selected yet.',
}

function formatLimit(maxBytes: number): string {
  return `Up to ${Math.round(maxBytes / (1024 * 1024))} MB per file · ${QUOTAS.maxPages} pages · processed locally`
}

export function FileSelection({
  expected,
  multiple,
  files,
  onChange,
  labels: labelOverrides,
  allowEncrypted = false,
  maxFiles,
  maxTotalBytes,
}: FileSelectionProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  const [selectionError, setSelectionError] = useState<ToolError | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const previousFiles = useRef(files)
  useLayoutEffect(() => { if (previousFiles.current !== files) { generation.current++; previousFiles.current = files } }, [files])
  const change = (next: WorkspaceFile[]) => { generation.current++; setSelectionError(null); onChange(next) }

  const limitsLine = useMemo(() => formatLimit(QUOTAS.maxInputBytes), [])

  const ingest = useCallback(
    (incoming: Array<{ name: string; bytes: Uint8Array; error?: ToolError; size?: number }>) => {
      if (incoming.length === 0) return
      const outcomes = validateSelection(incoming, toValidateKind(expected), { allowEncrypted })
      const accepted: WorkspaceFile[] = []
      for (const o of outcomes) {
        const src = incoming[o.index]
        accepted.push({
          id: nextWspId++,
          displayName: o.ok ? o.meta!.displayName : sanitizeFileName(src.name),
          bytes: src.bytes,
          sizeLabel: formatBytes(src.size ?? src.bytes.byteLength),
          error: src.error ?? (o.ok ? undefined : o.error),
        })
      }
      // multiple=false keeps only the newest valid file (single-file tools)
      const next = multiple ? [...files, ...accepted] : accepted.slice(-1)
      onChange(next)
    },
    [expected, files, multiple, onChange, allowEncrypted],
  )

  const readFiles = async (list: File[]) => {
    const token = ++generation.current
    setSelectionError(null)
    if (maxFiles && list.length + files.length > maxFiles) {
      setSelectionError(toolError('E-INPUT-04', `Choose at most ${maxFiles} files. Remove files or choose a smaller batch.`, 'show-limits'))
      return
    }
    const readable = list.filter(f => f.size <= QUOTAS.maxInputBytes)
    if (maxTotalBytes && readable.reduce((sum,f) => sum + f.size, files.reduce((sum,f) => sum + f.bytes.length, 0)) > maxTotalBytes) {
      setSelectionError(toolError('E-INPUT-04', 'The selection exceeds 50 MB in total. Choose fewer or smaller images.', 'show-limits'))
      return
    }
    const incoming: Array<{ name: string; bytes: Uint8Array; error?: ToolError; size?: number }> = []
    for (const file of list) {
      if (!mounted.current || token !== generation.current) return
      if (file.size > QUOTAS.maxInputBytes) {
        incoming.push({ name: file.name, size: file.size, bytes: new Uint8Array(), error: toolError('E-INPUT-04', 'This file exceeds 50 MB. Choose a smaller file.', 'show-limits') })
        continue
      }
      try { incoming.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }) }
      catch { incoming.push({ name: file.name, size: file.size, bytes: new Uint8Array(), error: toolError('E-INPUT-03', 'This file could not be read. Choose it again.', 'retry-file') }) }
    }
    if (!mounted.current || token !== generation.current) return
    ingest(incoming)
  }

  const onInputChange = async (e: { target: { files: FileList | null } }) => {
    const list = e.target.files
    if (list) await readFiles(Array.from(list))
    if (mounted.current && inputRef.current) inputRef.current.value = ''
  }
  const onDrop = async (e: DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    await readFiles(Array.from(e.dataTransfer.files))
  }
  const remove = (id: number) => change(files.filter((f) => f.id !== id))
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= files.length) return
    const next = [...files]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    change(next)
  }

  const validCount = files.filter((f) => !f.error).length
  const hasErrors = files.some((f) => f.error)

  return (
    <section
      className="workspace"
      aria-label="File selection"
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
    >
      <div className={`dropzone${dragActive ? ' is-active' : ''}`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <p className="dropzone-hint">{labels.dropzone}</p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => inputRef.current?.click()}
        >
          {labels.browse}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          multiple={multiple}
          // accept built from expected kind (registry contract)
          accept={expected === 'pdf' ? 'application/pdf,.pdf' : 'image/jpeg,image/png,.jpg,.jpeg,.png'}
          onChange={onInputChange}
          aria-label={labels.browse}
        />
      </div>

      <p className="limits-line">{labelOverrides?.limits ?? limitsLine}</p>
      {selectionError ? <p className="file-error" role="alert">{selectionError.message}</p> : null}

      {files.length === 0 ? (
        <p className="workspace-empty" role="status">{labels.emptyHint}</p>
      ) : (
        <>
          <p className="workspace-count" role="status">
            {validCount} of {files.length} file{files.length === 1 ? '' : 's'} ready
            {hasErrors ? ' — remove files marked with errors' : ''}
          </p>
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={f.id} className={f.error ? 'file-row is-error' : 'file-row'}>
                <span className="file-index" aria-hidden="true">{i + 1}</span>
                <span className="file-name" title={f.displayName}>{f.displayName}</span>
                <span className="file-size">{f.sizeLabel}</span>
                {f.error ? (
                  <span className="file-error" role="alert">
                    {f.error.message}
                  </span>
                ) : null}
                <span className="file-actions">
                  {multiple ? (
                    <>
                      <button
                        type="button"
                        className="btn-icon"
                        aria-label={`${labels.moveUp}: ${f.displayName}`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5m0 0l-6 6m6-6l6 6" /></svg>
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        aria-label={`${labels.moveDown}: ${f.displayName}`}
                        disabled={i === files.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14m0 0l6-6m-6 6l-6-6" /></svg>
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`${labels.remove}: ${f.displayName}`}
                    onClick={() => remove(f.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost" onClick={() => change([])}>
            {labels.clear}
          </button>
        </>
      )}
    </section>
  )
}
