/**
 * Extract + Delete flows tests — PT-CORE-006.
 *
 * Tracker acceptance: exact remaining/extracted pages match the plan,
 * all-delete rejected, first/last/noncontiguous/all-page cases covered.
 * Content is verified through the independent reader (PACKING-BOX markers),
 * not just page counts.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { startExtract } from '../tools/extractFlow'
import { startDelete, remainingPages } from '../tools/deleteFlow'
import { openDocument } from '../engines/pdfjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const F = (name: string) =>
  new Uint8Array(readFileSync(path.join(ROOT, 'fixtures', name)))

let f001: Uint8Array
let f002: Uint8Array
let f012: Uint8Array

beforeAll(() => {
  f001 = F('pdf/F-001-plain-text-3p.pdf')
  f002 = F('pdf/F-002-plain-text-30p.pdf')
  f012 = F('pdf/F-012-empty.pdf')
})

/** Read per-page text through the independent reader (pdf.js). */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await openDocument(bytes)
  try {
    const texts: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      texts.push(tc.items.map((it: { str: string }) => it.str).join(' '))
      page.cleanup()
    }
    return texts
  } finally {
    await doc.destroy()
  }
}

const marker = (n: number) => `PACKING-BOX-${String(n).padStart(4, '0')}`

describe('remainingPages (pure plan layer)', () => {
  it('removes first, last, middle and noncontiguous selections in order', () => {
    expect(remainingPages(5, [1])).toEqual([2, 3, 4, 5]) // first
    expect(remainingPages(5, [5])).toEqual([1, 2, 3, 4]) // last
    expect(remainingPages(5, [3])).toEqual([1, 2, 4, 5]) // middle
    expect(remainingPages(10, [2, 5, 8, 9])).toEqual([1, 3, 4, 6, 7, 10]) // noncontiguous
  })

  it('all-delete yields an empty remainder (the guard case)', () => {
    expect(remainingPages(3, [1, 2, 3])).toEqual([])
    expect(remainingPages(3, [1, 3, 2])).toEqual([])
  })

  it('ignores duplicates in the selection', () => {
    expect(remainingPages(4, [2, 2, 3])).toEqual([1, 4])
  })
})

describe('startExtract (PT-FT-005)', () => {
  it('extracts in the chosen order — noncontiguous, custom order', async () => {
    const job = startExtract({ file: { displayName: 'doc.pdf', bytes: f002 }, pagesExpr: '30, 3, 15' })
    await job.completion
    expect(job.state).toBe('done')
    const out = job.result!
    expect(out.name).toBe('doc-extracted.pdf')
    expect(out.verified).toBe(true)

    const texts = await pageTexts(out.bytes)
    expect(texts.length).toBe(3)
    expect(texts[0]).toContain(marker(30)) // order is the user's, not sorted
    expect(texts[1]).toContain(marker(3))
    expect(texts[2]).toContain(marker(15))
  })

  it('extracting a contiguous first range keeps sequence', async () => {
    const job = startExtract({ file: { displayName: 'doc.pdf', bytes: f002 }, pagesExpr: '1-3' })
    await job.completion
    expect(job.state).toBe('done')
    const texts = await pageTexts(job.result!.bytes)
    expect(texts.length).toBe(3)
    expect(texts[0]).toContain(marker(1))
    expect(texts[2]).toContain(marker(3))
  })

  it('extracting ALL pages is allowed (full copy, not an error)', async () => {
    const job = startExtract({ file: { displayName: 'doc.pdf', bytes: f001 }, pagesExpr: '1-3' })
    await job.completion
    expect(job.state).toBe('done')
    expect(job.result!.name).toBe('doc-extracted.pdf')
    const texts = await pageTexts(job.result!.bytes)
    expect(texts.length).toBe(3)
  })

  it('out-of-bounds page fails with E-CONFIG-01', async () => {
    const job = startExtract({ file: { displayName: 'doc.pdf', bytes: f001 }, pagesExpr: '4' })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-CONFIG-01')
  })

  it('empty expression fails with E-INPUT-05', async () => {
    const job = startExtract({ file: { displayName: 'doc.pdf', bytes: f001 }, pagesExpr: '  ' })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-INPUT-05')
  })
})

describe('startDelete (PT-FT-004)', () => {
  it('deletes a noncontiguous selection; remainder matches the plan exactly', async () => {
    const job = startDelete({ file: { displayName: 'doc.pdf', bytes: f002 }, pagesExpr: '2, 5-6, 30' })
    await job.completion
    expect(job.state).toBe('done')
    const out = job.result!
    expect(out.name).toBe('doc-pages-removed.pdf')

    const expected = remainingPages(30, [2, 5, 6, 30]) // [1,3,4,7..29]
    const texts = await pageTexts(out.bytes)
    expect(texts.length).toBe(expected.length)
    // content readback: each remaining page shows its own marker
    for (let i = 0; i < expected.length; i++) {
      expect(texts[i]).toContain(marker(expected[i]))
    }
  })

  it('deleting the FIRST page only', async () => {
    const job = startDelete({ file: { displayName: 'doc.pdf', bytes: f001 }, pagesExpr: '1' })
    await job.completion
    expect(job.state).toBe('done')
    const texts = await pageTexts(job.result!.bytes)
    expect(texts.length).toBe(2)
    expect(texts[0]).toContain(marker(2))
    expect(texts[1]).toContain(marker(3))
  })

  it('deleting the LAST page only', async () => {
    const job = startDelete({ file: { displayName: 'doc.pdf', bytes: f001 }, pagesExpr: '3' })
    await job.completion
    expect(job.state).toBe('done')
    const texts = await pageTexts(job.result!.bytes)
    expect(texts.length).toBe(2)
    expect(texts[0]).toContain(marker(1))
    expect(texts[1]).toContain(marker(2))
  })

  it('all-delete is rejected up front with E-CONFIG-01', async () => {
    const job = startDelete({ file: { displayName: 'doc.pdf', bytes: f001 }, pagesExpr: '1, 2, 3' })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-CONFIG-01')
    expect(job.error?.message).toMatch(/empty document/i)
    expect(job.result).toBeUndefined()
  })

  it('all-delete via range expression is also rejected', async () => {
    const job = startDelete({ file: { displayName: 'doc.pdf', bytes: f002 }, pagesExpr: '1-30' })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-CONFIG-01')
  })

  it('single-page document cannot delete anything (empty result guard)', async () => {
    // F-012 is empty (0 pages) — the guard must reject before the engine
    const job = startDelete({ file: { displayName: 'empty.pdf', bytes: f012 }, pagesExpr: '1' })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-INPUT-03')
  })
})
