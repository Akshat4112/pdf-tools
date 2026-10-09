import { describe, expect, it } from 'vitest'
import {
  countPages,
  parsePageRanges,
  parseRangeGroups,
  splitEveryN,
  splitOnePerPage,
} from '../lib/pageRanges'

const expectCode = (code: string, fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    expect((e as { code?: string }).code).toBe(code)
    return
  }
  throw new Error(`expected ${code}, no throw`)
}

describe('parsePageRanges (PT-CORE-003, shared implementation)', () => {
  it('parses mixed ranges, dedupes, preserves order', () => {
    expect(parsePageRanges('1-3, 2, 5', 30).pages).toEqual([1, 2, 3, 5])
    expect(parsePageRanges('9', 30).pages).toEqual([9])
    expect(parsePageRanges(' 4 - 6 ', 30).pages).toEqual([4, 5, 6])
  })

  it('taxonomy errors: empty, junk, out-of-bounds, backwards', () => {
    expectCode('E-INPUT-05', () => parsePageRanges('  ', 30))
    expectCode('E-CONFIG-01', () => parsePageRanges('abc', 30))
    expect(() => parsePageRanges('31', 30)).toThrow(/30-page/)
    expectCode('E-CONFIG-01', () => parsePageRanges('5-2', 30))
  })
})

describe('parseRangeGroups (PT-FT-002 split-by-ranges)', () => {
  it('builds explicit groups in order', () => {
    expect(parseRangeGroups('1-5, 8, 12-13', 30)).toEqual([
      [1, 2, 3, 4, 5], [8], [12, 13],
    ])
  })

  it('dedupes within a group but keeps overlapping groups distinct', () => {
    const g = parseRangeGroups('3-5, 4-5, 3', 30)
    expect(g).toEqual([[3, 4, 5], [4, 5], [3]])
  })

  it('empty expression is E-INPUT-05; bad tokens are E-CONFIG-01', () => {
    expectCode('E-INPUT-05', () => parseRangeGroups('', 30))
    expectCode('E-CONFIG-01', () => parseRangeGroups('1,x', 30))
  })

  it('bounds checked against the real page count', () => {
    expect(() => parseRangeGroups('1-31', 30)).toThrow(/30-page/)
  })
})

describe('splitEveryN (PT-FT-002 every-N mode)', () => {
  it('chunks evenly with a short tail', () => {
    expect(splitEveryN(30, 10)).toHaveLength(3)
    expect(splitEveryN(25, 10)).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      [21, 22, 23, 24, 25],
    ])
    expect(splitEveryN(3, 1)).toEqual([[1], [2], [3]])
  })

  it('rejects zero/negative/non-integer and oversize chunks', () => {
    expectCode('E-CONFIG-01', () => splitEveryN(30, 0))
    expectCode('E-CONFIG-01', () => splitEveryN(30, -2))
    expectCode('E-CONFIG-01', () => splitEveryN(30, 1.5))
    expectCode('E-CONFIG-01', () => splitEveryN(10, 11))
  })
})

describe('splitOnePerPage (PT-FT-002 per-page mode)', () => {
  it('one group per page', () => {
    expect(splitOnePerPage(3)).toEqual([[1], [2], [3]])
    expect(splitOnePerPage(1)).toEqual([[1]])
  })
})

describe('countPages sanity helper', () => {
  it('counts unique pages (preview must match output)', () => {
    expect(countPages([1, 2, 3, 2])).toBe(3)
  })
})
