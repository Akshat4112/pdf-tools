import { describe, expect, it } from 'vitest'
import { TOOLS } from '../registry'
import { GERMAN_TOOL_SEO } from './germanToolSeo'

describe('PT-SEO-010 German tool-page editorial inventory', () => {
  it('covers each shipped tool exactly once without adding pending tools', () => {
    const shipped = TOOLS.filter(tool => tool.implemented).map(tool => tool.id).sort()
    expect(Object.keys(GERMAN_TOOL_SEO).sort()).toEqual(shipped)
  })

  it('includes distinct title, useful metadata and reviewed limitations for every shipped tool', () => {
    for (const tool of TOOLS.filter(tool => tool.implemented)) {
      const copy = GERMAN_TOOL_SEO[tool.id]
      expect(copy.title.endsWith(' — PDF Tools')).toBe(true)
      expect(copy.title.length).toBeLessThanOrEqual(70)
      expect(copy.description.length).toBeGreaterThan(70)
      expect(copy.description.length).toBeLessThanOrEqual(160)
      expect(copy.heading.length).toBeGreaterThan(12)
      expect(copy.steps).toHaveLength(3)
      for (const step of copy.steps) expect(step.length).toBeGreaterThan(20)
      expect(copy.limitation.length).toBeGreaterThan(60)
    }
    expect(new Set(Object.values(GERMAN_TOOL_SEO).map(copy => copy.title)).size).toBe(TOOLS.filter(tool => tool.implemented).length)
  })

  it('does not promise OCR, secure redaction or validated signing', () => {
    for (const copy of Object.values(GERMAN_TOOL_SEO)) {
      const prose = [copy.title, copy.heading, copy.description, ...copy.steps].join(' ').toLowerCase()
      expect(prose).not.toContain('sicher schwärzen')
      expect(prose).not.toContain('digitale signatur prüfen')
      expect(prose).not.toContain('ocr-texterkennung ausführen')
    }
  })
})
