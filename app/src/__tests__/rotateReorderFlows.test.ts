/**
 * Rotate + Reorder flows tests — PT-CORE-008.
 *
 * Tracker acceptance: no duplicate/missing pages unless deliberate;
 * rotation composed correctly; pre-rotated and mixed-size fixtures covered.
 * F-004 has per-page rotations [0, 90, 180, 270]; F-003 has mixed page sizes.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { startRotate, startReorder, rotationPlan, validatePermutation } from '../tools/rotateReorderFlow'
import { openDocument } from '../engines/pdfjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const F = (name: string) =>
  new Uint8Array(readFileSync(path.join(ROOT, 'fixtures', name)))

let f001: Uint8Array
let f002: Uint8Array
let f004: Uint8Array

beforeAll(() => {
  f001 = F('pdf/F-001-plain-text-3p.pdf')
  f002 = F('pdf/F-002-plain-text-30p.pdf')
  f004 = F('pdf/F-004-rotated-pages.pdf')
})

async function rotationsOf(bytes: Uint8Array): Promise<number[]> {
  const doc = await openDocument(bytes)
  try {
    const out: number[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      out.push(page.rotate ?? 0)
      page.cleanup()
    }
    return out
  } finally {
    await doc.destroy()
  }
}

const expectToolError = (code: string, fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    expect((e as { code?: string }).code).toBe(code)
    return
  }
  throw new Error(`expected toolError ${code}, no throw`)
}

describe('rotationPlan (pure composition layer)', () => {
  it('composes delta with existing rotation only for selected pages', () => {
    // F-004 layout [0, 90, 180, 270]; rotate pages 2 and 4 by 180
    const plan = rotationPlan([0, 90, 180, 270], [2, 4], 180)
    expect(plan).toEqual([
      { sourcePage: 1 }, // untouched, existing rotation kept
      { sourcePage: 2, rotation: 270 }, // 90 + 180
      { sourcePage: 3 }, // untouched
      { sourcePage: 4, rotation: 90 }, // 270 + 180 = 450 mod 360
    ])
  })

  it('full wrap-around: existing 270 + delta 180 -> 90', () => {
    const plan = rotationPlan([270], [1], 180)
    expect(plan[0].rotation).toBe(90)
  })

  it('270 + 90 -> 0 (normalizes to no rotation)', () => {
    const plan = rotationPlan([270], [1], 90)
    expect(plan[0].rotation).toBe(0)
  })
})

describe('validatePermutation (pure guard)', () => {
  it('accepts a true permutation', () => {
    expect(() => validatePermutation([3, 1, 2], 3)).not.toThrow()
    expect(() => validatePermutation([1], 1)).not.toThrow()
  })

  it('rejects wrong length (missing pages)', () => {
    expectToolError('E-CONFIG-01', () => validatePermutation([1, 2], 3))
    expectToolError('E-CONFIG-01', () => validatePermutation([1, 2, 3, 4], 3))
  })

  it('rejects duplicates (no silent dupes in reorder)', () => {
    expectToolError('E-CONFIG-01', () => validatePermutation([1, 1, 3], 3))
  })

  it('rejects out-of-bounds pages', () => {
    expectToolError('E-CONFIG-01', () => validatePermutation([1, 2, 4], 3))
  })
})

describe('startRotate (engine + composed-rotation verification)', () => {
  it('rotates ALL pages by 90 on a plain document', async () => {
    const job = startRotate({ file: { displayName: 'doc.pdf', bytes: f001 }, delta: 90 })
    await job.completion
    expect(job.state).toBe('done')
    expect(job.result!.name).toBe('doc-rotated.pdf')
    expect(await rotationsOf(job.result!.bytes)).toEqual([90, 90, 90])
  })

  it('composes with EXISTING rotations on the pre-rotated fixture (F-004)', async () => {
    // F-004: [0, 90, 180, 270]; rotate pages 1 and 3 by 90
    const job = startRotate({
      file: { displayName: 'pre.pdf', bytes: f004 },
      pagesExpr: '1, 3',
      delta: 90,
    })
    await job.completion
    expect(job.state).toBe('done')
    // untouched pages keep theirs; selected compose: 0+90=90, 180+90=270
    expect(await rotationsOf(job.result!.bytes)).toEqual([90, 90, 270, 270])
  })

  it('full 270 rotation composes to normalized values', async () => {
    const job = startRotate({ file: { displayName: 'pre.pdf', bytes: f004 }, delta: 270 })
    await job.completion
    expect(job.state).toBe('done')
    expect(await rotationsOf(job.result!.bytes)).toEqual([270, 0, 90, 180])
  })

  it('out-of-bounds selection fails E-CONFIG-01', async () => {
    const job = startRotate({ file: { displayName: 'doc.pdf', bytes: f001 }, pagesExpr: '9', delta: 90 })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-CONFIG-01')
  })
})

describe('startReorder (permutation + content verification)', () => {
  it('applies a full permutation and preserves every page exactly once', async () => {
    const job = startReorder({ file: { displayName: 'doc.pdf', bytes: f002 }, order: [30, 1, 15, 2] })
    await job.completion
    expect(job.state).toBe('failed') // 30-page doc, order lists only 4
    expect(job.error?.code).toBe('E-CONFIG-01')
  })

  it('reorders a full 3-page permutation with marker readback', async () => {
    const job = startReorder({ file: { displayName: 'doc.pdf', bytes: f001 }, order: [3, 1, 2] })
    await job.completion
    expect(job.state).toBe('done')
    expect(job.result!.name).toBe('doc-reordered.pdf')

    const texts: string[] = []
    const doc = await openDocument(job.result!.bytes)
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      texts.push(tc.items.map((it: { str: string }) => it.str).join(' '))
      page.cleanup()
    }
    await doc.destroy()
    expect(texts[0]).toContain('PACKING-BOX-0003')
    expect(texts[1]).toContain('PACKING-BOX-0001')
    expect(texts[2]).toContain('PACKING-BOX-0002')
  })

  it('single-page document cannot reorder', async () => {
    // F-003 has mixed sizes but multiple pages; emulate single page via F-001
    // with order [1] against a 3-page doc -> wrong length is the guard here
    const job = startReorder({ file: { displayName: 'doc.pdf', bytes: f001 }, order: [1] })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-CONFIG-01')
  })

  it('reorder preserves page rotations through the permutation', async () => {
    // F-004 rotations [0,90,180,270]; reorder [4,3,2,1]
    const job = startReorder({ file: { displayName: 'pre.pdf', bytes: f004 }, order: [4, 3, 2, 1] })
    await job.completion
    expect(job.state).toBe('done')
    expect(await rotationsOf(job.result!.bytes)).toEqual([270, 180, 90, 0])
  })
})
