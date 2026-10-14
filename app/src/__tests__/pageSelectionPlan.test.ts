import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { deletionReviewKey, pageSelectionPlan, togglePage } from '../tools/pageSelectionPlan'
import { getTool } from '../registry'
import { ToolEntry } from '../components/ToolEntry'

describe('page-selection preview contract', () => {
  it('keeps custom extraction order and deduplicates repeated ranges', () => {
    expect(pageSelectionPlan('extract-pages', '5, 1-2, 5, 2', 5)).toEqual({ selected: [5, 1, 2], output: [5, 1, 2] })
  })
  it('previews deletion as the complement in original order', () => {
    expect(pageSelectionPlan('delete-pages', '5, 2', 5)).toEqual({ selected: [5, 2], output: [1, 3, 4] })
  })
  it('allows extraction of all pages, but rejects deleting all or the only page', () => {
    expect(pageSelectionPlan('extract-pages', '1-3', 3).output).toEqual([1, 2, 3])
    expect(() => pageSelectionPlan('delete-pages', '1-3', 3)).toThrowError(/Keep at least one page/)
    expect(() => pageSelectionPlan('delete-pages', '1', 1)).toThrowError(/Keep at least one page/)
  })
  it.each(['', '0', '6', '3-2', 'bad'])('blocks invalid expression %j before processing', (expression) => {
    expect(() => pageSelectionPlan('extract-pages', expression, 5)).toThrow()
  })
  it('synchronizes a typed range with additions and removals from thumbnails', () => {
    expect(togglePage('4, 1-2', 3, 5)).toBe('4, 1, 2, 3')
    expect(togglePage('4, 1-2', 1, 5)).toBe('4, 2')
    expect(togglePage('1', 1, 5)).toBe('')
    expect(togglePage('bad', 2, 5)).toBe('2')
  })
  it('binds deletion review to the file and effective page set', () => {
    expect(deletionReviewKey(1, [2, 5])).toBe(deletionReviewKey(1, [5, 2]))
    expect(deletionReviewKey(1, [2])).not.toBe(deletionReviewKey(1, [3]))
    expect(deletionReviewKey(1, [2])).not.toBe(deletionReviewKey(2, [2]))
  })
})

describe('working tool entry points', () => {
  it.each(['extract-pages', 'delete-pages'] as const)('mounts %s with a file picker and disabled initial action', (id) => {
    const tool = getTool(id)
    expect(tool.implemented).toBe(true)
    const html = renderToStaticMarkup(createElement(ToolEntry, { tool, onExit: () => {} }))
    expect(html).toContain('type="file"')
    expect(html).toContain('aria-label="Preview"')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('Nothing to try here yet')
  })
  it.each(['organize', 'rotate'] as const)('mounts the working %s workspace', (id) => {
    const tool = getTool(id)
    expect(tool.implemented).toBe(true)
    const html = renderToStaticMarkup(createElement(ToolEntry, { tool, onExit: () => {} }))
    expect(html).toContain(id === 'organize' ? 'Create organized copy' : 'Create rotated copy')
    expect(html).not.toContain('not available yet')
  })
})
