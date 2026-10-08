/**
 * Typed tool and engine registry — PT-FND-002.
 *
 * The registry is the single source of truth for which tools exist, their
 * identifiers, input/output contracts, limits and engine requirements.
 * The UI renders the catalog from this registry; engines are looked up by ID.
 *
 * Rules encoded here (from spec chain):
 * - PT-PD-001 §2: only the 14 R1 capabilities are exposed; anything else must
 *   not appear as an enabled entry.
 * - PT-PD-002 §5: error taxonomy codes E-* are the only failure vocabulary.
 * - PT-SP-002 §3: measured quotas (initial values, UI displays them).
 * - PT-SP-001 §2.2: pdf-lib inputs must be offset-0 Uint8Arrays (engine adapter
 *   contract enforces normalization).
 */

export type ToolId =
  | 'merge' | 'split' | 'rotate' | 'delete-pages' | 'extract-pages'
  | 'organize' | 'images-to-pdf' | 'pdf-to-jpg' | 'pdf-to-png'
  | 'reader' | 'page-numbers' | 'watermark' | 'pdf-to-text' | 'doc-info'

export type EngineId = 'pdfjs' | 'pdflib' | 'zip' | 'fflate'

export type InputKind = 'pdf' | 'jpeg' | 'png'
export type OutputKind = 'pdf' | 'jpeg' | 'png' | 'zip' | 'txt' | 'view'

/** Failure taxonomy from PT-PD-002 §5 — the only error vocabulary. */
export type ErrorCode =
  | 'E-INPUT-01' | 'E-INPUT-02' | 'E-INPUT-03' | 'E-INPUT-04' | 'E-INPUT-05'
  | 'E-CONFIG-01' | 'E-PROC-01' | 'E-PROC-02'
  | 'E-OUT-01' | 'E-OUT-02' | 'E-SYS-01'

export interface ToolError extends Error {
  code: ErrorCode
  /** recovery affordance hint key — UI must render a matching action */
  recovery:
    | 'show-formats' | 'explain-encryption' | 'retry-file' | 'show-limits'
    | 'focus-picker' | 'fix-field' | 'retry-job' | 'reduce-scope' | 'retry-download' | 'suggest-browser'
}

export function toolError(code: ErrorCode, message: string, recovery: ToolError['recovery']): ToolError {
  const err = new Error(message) as ToolError
  err.code = code
  err.recovery = recovery
  return err
}

/** Measured quotas — PT-SP-002 §3 (initial; re-verified by PT-QA-002). */
export const QUOTAS = {
  maxInputBytes: 50 * 1024 * 1024,
  maxPages: 300,
  renderDpis: [96, 150, 200] as const,
  defaultDpi: 150,
  maxHeldBitmaps: 10,
  maxThumbnails: 60,
  jobTimeoutMs: 30_000,
} as const

export interface ToolDefinition {
  id: ToolId
  /** feature ID from the tracker/spec (PT-FT-xxx) */
  featureId: string
  title: string
  description: string
  acceptedInputs: readonly InputKind[]
  outputKind: OutputKind
  /** engines that must be loaded before this tool can run */
  engines: readonly EngineId[]
  /** true when the tool only reads (never writes a modified document) */
  readOnly: boolean
  /** route slug under /pdf-tools/ (PT-UX-004) */
  route: string
}

export const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'merge', featureId: 'PT-FT-001', title: 'Merge PDF',
    description: 'Combine PDFs in your chosen order into one document.',
    acceptedInputs: ['pdf'], outputKind: 'pdf', engines: ['pdflib'],
    readOnly: false, route: '/merge',
  },
  {
    id: 'split', featureId: 'PT-FT-002', title: 'Split PDF',
    description: 'Split by page ranges, every N pages, or one file per page.',
    acceptedInputs: ['pdf'], outputKind: 'zip', engines: ['pdflib', 'zip'],
    readOnly: false, route: '/split',
  },
  {
    id: 'rotate', featureId: 'PT-FT-003', title: 'Rotate PDF',
    description: 'Rotate selected or all pages in 90° steps.',
    acceptedInputs: ['pdf'], outputKind: 'pdf', engines: ['pdflib'],
    readOnly: false, route: '/rotate',
  },
  {
    id: 'delete-pages', featureId: 'PT-FT-004', title: 'Delete pages',
    description: 'Remove selected pages into a new copy.',
    acceptedInputs: ['pdf'], outputKind: 'pdf', engines: ['pdflib'],
    readOnly: false, route: '/delete-pages',
  },
  {
    id: 'extract-pages', featureId: 'PT-FT-005', title: 'Extract pages',
    description: 'Pull selected pages into a new PDF, in the order you choose.',
    acceptedInputs: ['pdf'], outputKind: 'pdf', engines: ['pdflib'],
    readOnly: false, route: '/extract-pages',
  },
  {
    id: 'organize', featureId: 'PT-FT-006', title: 'Organize PDF',
    description: 'Reorder, rotate, duplicate and delete pages with undo.',
    acceptedInputs: ['pdf'], outputKind: 'pdf', engines: ['pdflib'],
    readOnly: false, route: '/organize',
  },
  {
    id: 'images-to-pdf', featureId: 'PT-FT-007', title: 'JPG/PNG to PDF',
    description: 'Turn JPG or PNG images into one PDF with size and margin options.',
    acceptedInputs: ['jpeg', 'png'], outputKind: 'pdf', engines: ['pdflib'],
    readOnly: false, route: '/images-to-pdf',
  },
  {
    id: 'pdf-to-jpg', featureId: 'PT-FT-008', title: 'PDF to JPG',
    description: 'Render pages to JPG images at a chosen DPI.',
    acceptedInputs: ['pdf'], outputKind: 'zip', engines: ['pdfjs', 'zip'],
    readOnly: false, route: '/pdf-to-jpg',
  },
  {
    id: 'pdf-to-png', featureId: 'PT-FT-009', title: 'PDF to PNG',
    description: 'Render pages to PNG images with an explicit background choice.',
    acceptedInputs: ['pdf'], outputKind: 'zip', engines: ['pdfjs', 'zip'],
    readOnly: false, route: '/pdf-to-png',
  },
  {
    id: 'reader', featureId: 'PT-FT-010', title: 'PDF reader',
    description: 'Read, search, copy and print — entirely locally.',
    acceptedInputs: ['pdf'], outputKind: 'view', engines: ['pdfjs'],
    readOnly: true, route: '/reader',
  },
  {
    id: 'page-numbers', featureId: 'PT-FT-011', title: 'Page numbers',
    description: 'Add page numbers with start, position and page selection.',
    acceptedInputs: ['pdf'], outputKind: 'pdf', engines: ['pdflib'],
    readOnly: false, route: '/page-numbers',
  },
  {
    id: 'watermark', featureId: 'PT-FT-012', title: 'Text watermark',
    description: 'Stamp a text watermark with position, opacity and page selection.',
    acceptedInputs: ['pdf'], outputKind: 'pdf', engines: ['pdflib'],
    readOnly: false, route: '/watermark',
  },
  {
    id: 'pdf-to-text', featureId: 'PT-FT-013', title: 'PDF to text',
    description: 'Export the text layer of a PDF as a UTF-8 .txt file.',
    acceptedInputs: ['pdf'], outputKind: 'txt', engines: ['pdfjs'],
    readOnly: true, route: '/pdf-to-text',
  },
  {
    id: 'doc-info', featureId: 'PT-FT-014', title: 'Document information',
    description: 'Inspect page count, dimensions, metadata and indicators.',
    acceptedInputs: ['pdf'], outputKind: 'view', engines: ['pdfjs'],
    readOnly: true, route: '/doc-info',
  },
] as const

export function getTool(id: ToolId): ToolDefinition {
  const t = TOOLS.find((tool) => tool.id === id)
  if (!t) throw new Error(`Unknown tool id: ${id}`)
  return t
}

export function toolByRoute(route: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.route === route)
}

/** Engines required by a tool, for lazy-loading orchestration (PT-FND-003). */
export function enginesFor(id: ToolId): readonly EngineId[] {
  return getTool(id).engines
}

/**
 * Normalize any byte source to an offset-0 Uint8Array before pdf-lib use.
 * PT-SP-001 §2.2: pdf-lib's DataView(imageData.buffer) ignores byteOffset —
 * pooled/subarray views break parsing and embedding.
 */
export function toOffsetZeroU8(source: Uint8Array | ArrayBufferView | ArrayBuffer): Uint8Array {
  // already a full, offset-0 view of its own buffer
  if (source instanceof Uint8Array && source.byteOffset === 0 && source.byteLength === source.buffer.byteLength) {
    return source
  }
  // Uint8Array at a non-zero offset (pooled/subarray) — copy to fresh buffer
  if (source instanceof Uint8Array) {
    const out = new Uint8Array(source.byteLength)
    out.set(source)
    return out
  }
  // ArrayBuffer or ArrayBufferView
  const ab = source instanceof ArrayBuffer ? source : (source as ArrayBufferView).buffer
  const off = source instanceof ArrayBuffer ? 0 : (source as ArrayBufferView).byteOffset
  const len = source instanceof ArrayBuffer ? source.byteLength : (source as ArrayBufferView).byteLength
  const out = new Uint8Array(len)
  out.set(new Uint8Array(ab, off, len))
  return out
}
