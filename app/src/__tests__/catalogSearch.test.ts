import { describe, it, expect } from 'vitest'
import { matchesTool, formatCue } from '../catalog/search'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ToolCard } from '../components/ToolCatalog'
import { getTool } from '../registry'

describe('task and format discovery', () => {
  it('finds familiar task vocabulary without changing feature availability', () => {
    expect(matchesTool(getTool('merge'), 'JOIN documents')).toBe(true)
    expect(matchesTool(getTool('images-to-pdf'), 'photos')).toBe(true)
    expect(matchesTool(getTool('doc-info'), 'properties')).toBe(true)
    expect(matchesTool(getTool('pdf-to-jpg'), 'jpeg')).toBe(true)
    expect(matchesTool(getTool('merge'), 'OCR')).toBe(false)
    expect(matchesTool({ ...getTool('merge'), implemented: false }, 'join')).toBe(true)
  })
  it('combines normalized query words and preserves registry feature lookup', () => {
    expect(matchesTool(getTool('merge'), '  combine, PDF! ')).toBe(true)
    expect(matchesTool(getTool('merge'), 'combine unicorn')).toBe(false)
    expect(matchesTool(getTool('merge'), 'PT-FT-001')).toBe(true)
    expect(matchesTool(getTool('merge'), '  ')).toBe(true)
    expect(matchesTool(getTool('merge'), '<script>')).toBe(false)
  })
  it('renders unavailable capabilities as inert cards with an honest label', () => {
    const html = renderToStaticMarkup(createElement(ToolCard, { tool: { ...getTool('merge'), implemented: false } }))
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('Not available yet')
    expect(html).not.toContain('href=')
    expect(html).not.toContain('Open tool')
  })
  it('labels actual view and download formats accurately', () => {
    expect(formatCue(getTool('reader'))).toBe('PDF → View')
    expect(formatCue(getTool('split'))).toBe('PDF → PDF / ZIP')
    expect(formatCue(getTool('images-to-pdf'))).toBe('JPG / PNG → PDF')
    expect(formatCue(getTool('pdf-to-jpg'))).toBe('PDF → JPG / ZIP')
  })
})
