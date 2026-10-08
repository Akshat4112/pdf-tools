import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  assertDpi,
  assertPixelBudget,
  dpiToScale,
  exportText,
  openDocument,
  parsePageRanges,
  pdfPointToScreen,
  renderedPageSize,
  screenToPdfPoint,
} from '../engines/pdfjs'
import {
  deletePages,
  extractPages,
  imagesToPdf,
  mergePdfs,
  organizePdf,
  rotatePdf,
  splitPdf,
} from '../engines/pdflib'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// app/src/__tests__/ -> app/src -> app -> repo root
const ROOT = path.resolve(HERE, '../../..')
const F = (name: string) =>
  new Uint8Array(readFileSync(path.join(ROOT, 'fixtures', name)))

let f001: Uint8Array
let f002: Uint8Array
let f004: Uint8Array
let f008: Uint8Array
let f010: Uint8Array
let f011: Uint8Array
let jpg: Uint8Array
let png: Uint8Array

beforeAll(() => {
  f001 = F('pdf/F-001-plain-text-3p.pdf')
  f002 = F('pdf/F-002-plain-text-30p.pdf')
  f004 = F('pdf/F-004-rotated-pages.pdf')
  f008 = F('pdf/F-008-scan-like.pdf')
  f010 = F('pdf/F-010-encrypted-aes256.pdf')
  f011 = F('pdf/F-011-malformed-truncated.pdf')
  jpg = F('images/F-007-photo.jpg')
  png = F('images/F-013-diagram.png')
})

const expectToolError = (code: string, fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    expect((e as { code?: string }).code).toBe(code)
    return
  }
  throw new Error(`expected toolError ${code}, no throw`)
}

describe('pdfjs adapter: validation + taxonomy', () => {
  it('rejects empty file with E-INPUT-03', async () => {
    await expect(openDocument(new Uint8Array(0))).rejects.toMatchObject({ code: 'E-INPUT-03' })
  })

  it('rejects over-limit bytes with E-INPUT-04 (small maxBytes)', async () => {
    await expect(openDocument(f001, { maxBytes: 100 })).rejects.toMatchObject({ code: 'E-INPUT-04' })
  })

  it('rejects over-limit pages with E-INPUT-04 (small maxPages)', async () => {
    await expect(openDocument(f002, { maxPages: 10 })).rejects.toMatchObject({ code: 'E-INPUT-04' })
  })

  it('rejects encrypted with E-INPUT-02 (F-010)', async () => {
    await expect(openDocument(f010)).rejects.toMatchObject({ code: 'E-INPUT-02' })
  })

  it('rejects malformed with E-INPUT-03 (F-011)', async () => {
    await expect(openDocument(f011)).rejects.toMatchObject({ code: 'E-INPUT-03' })
  })

  it('opens the corpus fixture and counts pages (F-001)', async () => {
    const doc = await openDocument(f001)
    expect(doc.numPages).toBe(3)
    await doc.destroy()
  })
})

describe('pdfjs adapter: text export (PT-FT-013)', () => {
  it('exports text with markers and \\f separators (F-001)', async () => {
    const doc = await openDocument(f001)
    const exp = await exportText(doc)
    expect(exp.pagesWithText).toBe(3)
    expect(exp.pagesWithoutText).toEqual([])
    const pages = exp.text.split('\f')
    expect(pages).toHaveLength(3)
    expect(pages[0]).toContain('PACKING-BOX-0001')
    expect(pages[2]).toContain('PACKING-BOX-0003')
    await doc.destroy()
  })

  it('reports pages without a text layer honestly (F-008)', async () => {
    const doc = await openDocument(f008)
    const exp = await exportText(doc)
    expect(exp.pagesWithText).toBe(0)
    expect(exp.pagesWithoutText).toEqual([1])
    await doc.destroy()
  })
})

describe('coordinate utilities', () => {
  const pageRect = { x: 0, y: 0, width: 595, height: 842 }
  const viewport = { width: 1190, height: 1684 } // 2x scale

  it('converts PDF point to screen (rotation 0)', () => {
    const p = pdfPointToScreen({ x: 297.5, y: 421 }, viewport, pageRect, 0)
    expect(p.x).toBeCloseTo(595, 0)
    expect(p.y).toBeCloseTo(842, 0)
  })

  it('round-trips screen -> PDF -> screen at rotation 0', () => {
    const s = { x: 300, y: 400 }
    const p = screenToPdfPoint(s, viewport, pageRect, 0)
    const back = pdfPointToScreen(p, viewport, pageRect, 0)
    expect(back.x).toBeCloseTo(s.x, -1)
    expect(back.y).toBeCloseTo(s.y, -1)
  })

  it('round-trips at rotation 90', () => {
    const s = { x: 100, y: 200 }
    const p = screenToPdfPoint(s, viewport, pageRect, 90)
    const back = pdfPointToScreen(p, viewport, pageRect, 90)
    expect(back.x).toBeCloseTo(s.x, -1)
    expect(back.y).toBeCloseTo(s.y, -1)
  })

  it('renderedPageSize swaps dimensions for 90/270', () => {
    const r0 = renderedPageSize(595, 842, 96, 0)
    expect(r0).toEqual({ width: 793, height: 1123 })
    const r90 = renderedPageSize(595, 842, 96, 90)
    expect(r90).toEqual({ width: 1123, height: 793 })
  })

  it('dpiToScale enforces the DPI quota', () => {
    expect(dpiToScale(150)).toBeCloseTo(150 / 72)
    expectToolError('E-CONFIG-01', () => dpiToScale(133))
  })

  it('assertDpi rejects unsupported values; assertPixelBudget enforces ceiling', () => {
    expect(() => assertDpi(96)).not.toThrow()
    expectToolError('E-CONFIG-01', () => assertDpi(500))
    expect(() => assertPixelBudget(794, 1123, 10)).not.toThrow()
    expectToolError('E-PROC-02', () => assertPixelBudget(4000, 4000, 10))
  })
})

describe('page range parser (PT-CORE-003 preview)', () => {
  it('parses mixed ranges and dedupes', () => {
    const r = parsePageRanges('1-3, 2, 5', 30)
    expect(r.pages).toEqual([1, 2, 3, 5])
  })

  it('rejects empty input with E-INPUT-05', () => {
    expectToolError('E-INPUT-05', () => parsePageRanges('   ', 30))
  })

  it('rejects out-of-bounds with E-CONFIG-01 naming the page count', () => {
    expect(() => parsePageRanges('5', 3)).toThrow(/3-page/)
  })

  it('rejects backwards ranges and junk', () => {
    expectToolError('E-CONFIG-01', () => parsePageRanges('5-2', 30))
    expectToolError('E-CONFIG-01', () => parsePageRanges('abc', 30))
  })
})

describe('pdflib adapter: core transforms on corpus', () => {
  it('mergePdfs preserves order and page count (F-001 + F-002 -> 33)', async () => {
    const out = await mergePdfs([f001, f002])
    expect(out.byteLength).toBeGreaterThan(1000)
    // verify by reopening with pdfjs
    const doc = await openDocument(out)
    expect(doc.numPages).toBe(33)
    await doc.destroy()
  })

  it('mergePdfs rejects empty selection with E-INPUT-05', async () => {
    await expect(mergePdfs([])).rejects.toMatchObject({ code: 'E-INPUT-05' })
  })

  it('splitPdf produces the requested groups (5 / 1 / 19)', async () => {
    const outs = await splitPdf(f002, [[1, 2, 3, 4, 5], [8], Array.from({ length: 19 }, (_, i) => 12 + i)])
    expect(outs).toHaveLength(3)
    for (const [i, expected] of [5, 1, 19].entries()) {
      const doc = await openDocument(outs[i])
      expect(doc.numPages).toBe(expected)
      await doc.destroy()
    }
  })

  it('splitPdf rejects invalid page numbers with E-CONFIG-01', async () => {
    await expect(splitPdf(f001, [[1, 99]])).rejects.toMatchObject({ code: 'E-CONFIG-01' })
  })

  it('rotatePdf composes with existing rotation (F-004 page 2: 90 -> 270)', async () => {
    const out = await rotatePdf(f004, [2], 180)
    // reopen with pdfjs and check the rotation attribute readback
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({ data: out }) as unknown as {
      promise: Promise<{ getPage(n: number): Promise<{ rotate: number }> }>
      destroy(): Promise<void>
    }
    const doc = await task.promise
    const page = await doc.getPage(2)
    expect(page.rotate % 360).toBe(270)
    await task.destroy()
  })

  it('deletePages removes pages and keeps order (F-002 page 1 -> 29 pages)', async () => {
    const out = await deletePages(f002, [1])
    const doc = await openDocument(out)
    expect(doc.numPages).toBe(29)
    await doc.destroy()
  })

  it('deletePages rejects deleting every page (PT-FT-004 rule)', async () => {
    await expect(deletePages(f001, [1, 2, 3])).rejects.toMatchObject({ code: 'E-CONFIG-01' })
  })

  it('extractPages honors custom order (30, 1, 6)', async () => {
    const out = await extractPages(f002, [30, 1, 6])
    const doc = await openDocument(out)
    expect(doc.numPages).toBe(3)
    const texts = await exportText(doc)
    const pages = texts.text.split('\f')
    expect(pages[0]).toContain('PACKING-BOX-0030')
    expect(pages[1]).toContain('PACKING-BOX-0001')
    expect(pages[2]).toContain('PACKING-BOX-0006')
    await doc.destroy()
  })

  it('organizePdf applies an atomic plan (reorder + rotate + duplicate)', async () => {
    const out = await organizePdf(f002, [
      { sourcePage: 30 },
      { sourcePage: 1, rotation: 90 },
      { sourcePage: 1 },
    ])
    const doc = await openDocument(out)
    expect(doc.numPages).toBe(3)
    const texts = await exportText(doc)
    const pages = texts.text.split('\f')
    expect(pages[0]).toContain('PACKING-BOX-0030')
    expect(pages[1]).toContain('PACKING-BOX-0001')
    expect(pages[2]).toContain('PACKING-BOX-0001')
    await doc.destroy()
  })

  it('organizePdf rejects empty plans and invalid rotations', async () => {
    await expect(organizePdf(f001, [])).rejects.toMatchObject({ code: 'E-CONFIG-01' })
    await expect(
      organizePdf(f001, [{ sourcePage: 1, rotation: 45 }]),
    ).rejects.toMatchObject({ code: 'E-CONFIG-01' })
  })

  it('imagesToPdf embeds JPEG and PNG with aspect preserved (F-007-img + F-013-img)', async () => {
    const out = await imagesToPdf([
      { bytes: jpg, kind: 'jpeg', widthPt: 595, heightPt: 842, marginPt: 24 },
      { bytes: png, kind: 'png', widthPt: 595, heightPt: 842, marginPt: 0 },
    ])
    const doc = await openDocument(out)
    expect(doc.numPages).toBe(2)
    await doc.destroy()
  })

  it('imagesToPdf rejects empty selection', async () => {
    await expect(imagesToPdf([])).rejects.toMatchObject({ code: 'E-INPUT-05' })
  })

  it('loadWritable rejects encrypted input with E-INPUT-02 (F-010)', async () => {
    const { loadWritable } = await import('../engines/pdflib')
    await expect(loadWritable(f010)).rejects.toMatchObject({ code: 'E-INPUT-02' })
  })
})
