import { describe, expect, it } from 'vitest'
import {
  QUOTAS,
  TOOLS,
  enginesFor,
  getTool,
  toolByRoute,
  toolError,
  toOffsetZeroU8,
  type ToolId,
} from '../registry'

describe('tool registry (PT-FND-002)', () => {
  it('exposes exactly the 14 R1 capabilities', () => {
    expect(TOOLS).toHaveLength(14)
    const featureIds = new Set(TOOLS.map((t) => t.featureId))
    for (let i = 1; i <= 14; i++) {
      expect(featureIds.has(`PT-FT-${String(i).padStart(3, '0')}`)).toBe(true)
    }
  })

  it('has unique tool ids and routes', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(14)
    expect(new Set(TOOLS.map((t) => t.route)).size).toBe(14)
  })

  it('every tool producing a PDF output uses the writing engine; view-only tools do not', () => {
    for (const t of TOOLS) {
      if (t.outputKind === 'pdf') {
        expect(t.readOnly).toBe(false)
        expect(t.engines).toContain('pdflib')
      }
      if (t.readOnly) {
        expect(t.engines).not.toContain('pdflib')
      }
    }
  })

  it('reader tools never load the writing engine', () => {
    const readOnlyTools = TOOLS.filter((t) => t.readOnly)
    expect(readOnlyTools.length).toBeGreaterThan(0)
    for (const t of readOnlyTools) {
      expect(t.engines).not.toContain('pdflib')
    }
  })

  it('split/pdf-to-images declare zip packaging engine', () => {
    expect(enginesFor('split')).toContain('zip')
    expect(enginesFor('pdf-to-jpg')).toContain('zip')
    expect(enginesFor('pdf-to-png')).toContain('zip')
    expect(enginesFor('pdf-to-png')).toContain('pdfjs')
  })

  it('routes resolve back to their tool', () => {
    for (const t of TOOLS) {
      expect(toolByRoute(t.route)?.id).toBe(t.id)
    }
    expect(toolByRoute('/nope')).toBeUndefined()
  })

  it('getTool throws on unknown id', () => {
    expect(() => getTool('nonsense' as ToolId)).toThrow()
  })

  it('quotas carry measured PT-SP-002 values', () => {
    expect(QUOTAS.maxInputBytes).toBe(50 * 1024 * 1024)
    expect(QUOTAS.maxPages).toBe(300)
    expect(QUOTAS.renderDpis).toEqual([96, 150, 200])
    expect(QUOTAS.defaultDpi).toBe(150)
    expect(QUOTAS.maxHeldBitmaps).toBe(10)
    expect(QUOTAS.maxThumbnails).toBe(60)
  })

  it('toolError produces taxonomy-coded errors with recovery hints', () => {
    const e = toolError('E-INPUT-02', 'encrypted', 'explain-encryption')
    expect(e.code).toBe('E-INPUT-02')
    expect(e.recovery).toBe('explain-encryption')
    expect(e).toBeInstanceOf(Error)
  })
})

describe('toOffsetZeroU8 (PT-SP-001 §2.2 rule)', () => {
  it('returns offset-0 arrays unchanged when already normalized', () => {
    const u8 = new Uint8Array([1, 2, 3])
    expect(toOffsetZeroU8(u8)).toBe(u8)
  })

  it('copies subarray views to a fresh offset-0 buffer', () => {
    const big = new Uint8Array(100).fill(7)
    const view = big.subarray(37, 41) // byteOffset 37, like a pooled Buffer
    const out = toOffsetZeroU8(view)
    expect(out.byteOffset).toBe(0)
    expect(out.byteLength).toBe(4)
    expect(Array.from(out)).toEqual([7, 7, 7, 7])
    expect(out).not.toBe(view)
  })

  it('copies ArrayBuffer inputs', () => {
    const ab = new ArrayBuffer(5)
    const out = toOffsetZeroU8(ab)
    expect(out.byteLength).toBe(5)
    expect(out.byteOffset).toBe(0)
  })
})
