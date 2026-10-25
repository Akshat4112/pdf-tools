import { describe, it, expect } from 'vitest'
import { TOOL_CONTENT, toolArticleHtml } from '../lib/toolContent'
import { TOOLS } from '../registry'
import { parsePageRanges, splitOnePerPage } from '../lib/pageRanges'
import { pageSelectionPlan } from '../tools/pageSelectionPlan'
import { EMPTY_ORGANIZE, organizeReducer } from '../tools/organizePlan'

describe('public tool guides', () => {
  it('escapes HTML even when a supplied title includes markup', () => {
    const html = toolArticleHtml('merge', '"><img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<script')
  })
  it('covers shipped routes with distinct explanations and examples', () => {
    expect(Object.keys(TOOL_CONTENT).sort()).toEqual(TOOLS.filter(t => t.implemented).map(t => t.id).sort())
    expect(new Set(Object.values(TOOL_CONTENT).map(c => c.intro)).size).toBe(14)
    expect(new Set(Object.values(TOOL_CONTENT).map(c => c.example)).size).toBe(14)
  })
  it('keeps published page-selection and organization examples true to the actual plans', () => {
    expect(pageSelectionPlan('extract-pages', '3, 1', 3).output).toEqual([3, 1])
    expect(pageSelectionPlan('delete-pages', '2', 3).output).toEqual([1, 3])
    expect(splitOnePerPage(3)).toEqual([[1], [2], [3]])
    expect(parsePageRanges('1, 3', 3).pages).toEqual([1, 3])
    const state = organizeReducer(EMPTY_ORGANIZE, { type: 'load', rotations: [0, 0, 0] })
    const moved = organizeReducer(state, { type: 'move', id: 3, to: 0 })
    expect(moved.pages.map(p => p.sourcePage)).toEqual([3, 1, 2])
    const rotated = organizeReducer(state, { type: 'rotate', ids: [2], delta: 90 })
    expect(rotated.pages.map(p => p.rotation)).toEqual([0, 90, 0])
  })
})
