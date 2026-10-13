import { parsePageRanges } from '../lib/pageRanges'
import { remainingPages } from './deleteFlow'
import { toolError } from '../registry'

export type PageSelectionMode = 'extract-pages' | 'delete-pages'

/** Shared preview contract: use the engines' parser and deletion complement. */
export function pageSelectionPlan(mode: PageSelectionMode, expression: string, pageCount: number) {
  const selected = parsePageRanges(expression, pageCount).pages
  const output = mode === 'extract-pages' ? selected : remainingPages(pageCount, selected)
  if (output.length === 0) {
    throw toolError('E-CONFIG-01', 'Deleting every page would leave an empty document. Keep at least one page.', 'fix-field')
  }
  return { selected, output }
}

/** Thumbnail picks append to extraction order; deleting preserves source order. */
export function togglePage(expression: string, page: number, pageCount: number): string {
  let pages: number[] = []
  try { pages = parsePageRanges(expression, pageCount).pages } catch { /* a pick replaces an invalid expression */ }
  return (pages.includes(page) ? pages.filter((p) => p !== page) : [...pages, page]).join(', ')
}

/** Confirmation binds to the actual source and effective removal set, never a boolean alone. */
export function deletionReviewKey(fileId: number, pages: readonly number[]): string {
  return `${fileId}:${[...pages].sort((a, b) => a - b).join(',')}`
}
