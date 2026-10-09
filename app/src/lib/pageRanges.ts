/**
 * Page range parser — PT-CORE-003.
 *
 * Shared module for all range-driven tools (split, extract, delete, PDF→images,
 * page numbering). Extracted from engines/pdfjs.ts (where it was born during
 * PT-FND-005) so tool screens and engines share ONE implementation and ONE
 * error vocabulary.
 *
 * Contract (PT-PD-002 §5 taxonomy):
 * - '3-7, 12'  -> ordered, deduped 1-based page list [3,4,5,6,7,12]
 * - empty      -> E-INPUT-05 (focus-picker)
 * - junk token -> E-CONFIG-01 naming the token (fix-field)
 * - out of bounds -> E-CONFIG-01 naming the document's page count (fix-field)
 * - backwards range -> E-CONFIG-01 (fix-field)
 *
 * Split modes (PT-FT-002) build on this: ranges / every N / one-per-page.
 */

import { toolError } from '../registry'

export interface ParsedRange {
  /** 1-based page numbers, deduped, in the order given */
  pages: number[]
}

export function parsePageRanges(expr: string, pageCount: number): ParsedRange {
  const trimmed = expr.trim()
  if (!trimmed) {
    throw toolError('E-INPUT-05', 'Select at least one page to continue.', 'focus-picker')
  }
  const pages: number[] = []
  for (const partRaw of trimmed.split(',')) {
    const part = partRaw.trim()
    if (!part) continue
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)
    if (!m) {
      throw toolError('E-CONFIG-01', `'${part}' is not a valid page or range.`, 'fix-field')
    }
    const start = parseInt(m[1], 10)
    const end = m[2] ? parseInt(m[2], 10) : start
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw toolError(
        'E-CONFIG-01',
        `Range '${part}' is not valid for a ${pageCount}-page document.`,
        'fix-field',
      )
    }
    if (start > end) {
      throw toolError('E-CONFIG-01', `Range '${part}' runs backwards.`, 'fix-field')
    }
    for (let i = start; i <= end; i++) pages.push(i)
  }
  if (pages.length === 0) {
    throw toolError('E-INPUT-05', 'Select at least one page to continue.', 'focus-picker')
  }
  return { pages: Array.from(new Set(pages)) }
}

/**
 * Split by fixed chunk size: 'every N pages' mode.
 * Returns 1-based groups covering the whole document.
 */
export function splitEveryN(pageCount: number, n: number): number[][] {
  if (!Number.isInteger(n) || n < 1) {
    throw toolError('E-CONFIG-01', 'Chunk size must be a whole number of pages.', 'fix-field')
  }
  if (n > pageCount) {
    throw toolError(
      'E-CONFIG-01',
      `Chunk size ${n} is larger than the ${pageCount}-page document.`,
      'fix-field',
    )
  }
  const groups: number[][] = []
  for (let start = 1; start <= pageCount; start += n) {
    const end = Math.min(start + n - 1, pageCount)
    groups.push(Array.from({ length: end - start + 1 }, (_, i) => start + i))
  }
  return groups
}

/** One PDF per page mode. */
export function splitOnePerPage(pageCount: number): number[][] {
  return Array.from({ length: pageCount }, (_, i) => [i + 1])
}

/**
 * Parse a split configuration from comma-separated range expressions into
 * explicit groups: '1-5, 8, 12-30' -> [[1..5],[8],[12..30]].
 * Order preserved; dedup happens WITHIN a group, not across groups (PT-FT-002
 * preview shows exactly these groups).
 */
export function parseRangeGroups(expr: string, pageCount: number): number[][] {
  const trimmed = expr.trim()
  if (!trimmed) {
    throw toolError('E-INPUT-05', 'Select at least one range to continue.', 'focus-picker')
  }
  const groups: number[][] = []
  for (const partRaw of trimmed.split(',')) {
    const part = partRaw.trim()
    if (!part) continue
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)
    if (!m) {
      throw toolError('E-CONFIG-01', `'${part}' is not a valid page or range.`, 'fix-field')
    }
    const start = parseInt(m[1], 10)
    const end = m[2] ? parseInt(m[2], 10) : start
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw toolError(
        'E-CONFIG-01',
        `Range '${part}' is not valid for a ${pageCount}-page document.`,
        'fix-field',
      )
    }
    if (start > end) {
      throw toolError('E-CONFIG-01', `Range '${part}' runs backwards.`, 'fix-field')
    }
    const group: number[] = []
    for (let i = start; i <= end; i++) group.push(i)
    groups.push(Array.from(new Set(group)))
  }
  if (groups.length === 0) {
    throw toolError('E-INPUT-05', 'Select at least one range to continue.', 'focus-picker')
  }
  return groups
}

/** Page count from a parsed plan — shared sanity for previews. */
export function countPages(pages: readonly number[]): number {
  return new Set(pages).size
}
