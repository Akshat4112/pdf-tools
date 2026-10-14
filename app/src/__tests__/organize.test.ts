import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { EMPTY_ORGANIZE, initialPages, organizeReducer, planKey, UNDO_LIMIT, validateOrganizePlan } from '../tools/organizePlan'
import { startOrganize } from '../tools/organizeFlow'
import { openDocument, exportText } from '../engines/pdfjs'
import { QUOTAS } from '../registry'

const fixture = (name: string) => new Uint8Array(readFileSync(resolve('../fixtures/pdf', name)))
const loaded = () => organizeReducer(EMPTY_ORGANIZE, { type: 'load', rotations: [0, 90, 180, 270] })

describe('Organize editor and undo', () => {
  it('moves identities in both directions without dropping source references', () => {
    const s = loaded()
    const moved = organizeReducer(s, { type: 'move', id: 4, to: 0 })
    expect(moved.pages.map(p => p.sourcePage)).toEqual([4, 1, 2, 3])
    expect(organizeReducer(moved, { type: 'move', id: 4, to: 3 }).pages).toEqual(s.pages)
    expect(s.pages).toEqual(initialPages([0, 90, 180, 270]))
  })
  it('duplicates keep rotation and identity independently', () => {
    const s = organizeReducer(loaded(), { type: 'duplicate', id: 2 })
    expect(s.pages[1].rotation).toBe(90)
    expect(s.pages[2]).toMatchObject({ sourcePage: 2, rotation: 90, id: 5 })
    const rotated = organizeReducer(s, { type: 'rotate', ids: [5], delta: 90 })
    expect(rotated.pages.slice(1, 3).map(p => p.rotation)).toEqual([90, 180])
    expect(organizeReducer(rotated, { type: 'undo' }).pages).toEqual(s.pages)
  })
  it('deletes deliberately, blocks a zero-page result, and undo restores exact order', () => {
    const s = loaded()
    expect(organizeReducer(s, { type: 'delete', ids: [1, 2, 3, 4] })).toBe(s)
    const next = organizeReducer(s, { type: 'delete', ids: [1, 3] })
    expect(next.pages.map(p => p.sourcePage)).toEqual([2, 4])
    expect(organizeReducer(next, { type: 'undo' }).pages).toEqual(s.pages)
  })
  it('composes left/right rotations and restores original edits with undo', () => {
    const s = loaded()
    const next = organizeReducer(s, { type: 'rotate', ids: [1, 4], delta: -90 })
    expect(next.pages.map(p => p.rotation)).toEqual([270, 90, 180, 180])
    const restored = organizeReducer(next, { type: 'restore', rotations: [0, 90, 180, 270] })
    expect(restored.pages).toEqual(s.pages)
    expect(organizeReducer(restored, { type: 'undo' }).pages).toEqual(next.pages)
  })
  it('bounds undo and prevents reuse of an undone duplicate identity', () => {
    let s = loaded()
    for (let i = 0; i < UNDO_LIMIT + 10; i++) s = organizeReducer(s, { type: 'rotate', ids: [1], delta: 90 })
    expect(s.history).toHaveLength(UNDO_LIMIT)
    const duplicated = organizeReducer(s, { type: 'duplicate', id: 1 })
    const undone = organizeReducer(duplicated, { type: 'undo' })
    expect(organizeReducer(undone, { type: 'duplicate', id: 1 }).pages[1].id).toBeGreaterThan(duplicated.pages[1].id)
    expect(organizeReducer(undone, { type: 'load', rotations: [0] }).history).toEqual([])
  })
  it('ignores stale IDs, invalid moves, no-ops and duplicates beyond the quota', () => {
    const s = loaded()
    expect(organizeReducer(s, { type: 'move', id: 1, to: 0 })).toBe(s)
    expect(organizeReducer(s, { type: 'move', id: 1, to: 0.5 })).toBe(s)
    expect(organizeReducer(s, { type: 'rotate', ids: [99], delta: 90 })).toBe(s)
    const full = organizeReducer(EMPTY_ORGANIZE, { type: 'load', rotations: Array(QUOTAS.maxPages).fill(0) })
    expect(organizeReducer(full, { type: 'duplicate', id: 1 })).toBe(full)
  })
  it.each([NaN, Infinity, 0, -1, 1.5, 5])('rejects invalid source page %s', sourcePage => {
    expect(() => validateOrganizePlan([{ sourcePage }], 4)).toThrow()
  })
  it.each([NaN, Infinity, -90, 45, 360])('rejects invalid final rotation %s', rotation => {
    expect(() => validateOrganizePlan([{ sourcePage: 1, rotation }], 4)).toThrow()
  })
  it('validates quotas and generates source-sensitive review keys', () => {
    expect(() => validateOrganizePlan([], 4)).toThrow()
    expect(() => validateOrganizePlan(Array(301).fill({ sourcePage: 1 }), 4)).toThrow()
    expect(planKey([{ sourcePage: 1, rotation: 0 }])).not.toBe(planKey([{ sourcePage: 1, rotation: 90 }]))
  })
})

describe('Organize export fidelity', () => {
  it('copies duplicated source pages with independent rotations (writer regression)', async () => {
    const bytes = fixture('F-004-rotated-pages.pdf')
    const before = new Uint8Array(bytes)
    const job = startOrganize({ file: { displayName: 'pre.pdf', bytes }, plan: [
      { sourcePage: 4, rotation: 0 }, { sourcePage: 2, rotation: 180 }, { sourcePage: 2, rotation: 90 },
    ] })
    await job.completion
    expect(job.state).toBe('done')
    expect(bytes).toEqual(before)
    const out = await PDFDocument.load(job.result!.bytes)
    expect(out.getPages().map(p => p.getRotation().angle)).toEqual([0, 180, 90])
    const doc = await openDocument(job.result!.bytes)
    try {
      const texts = (await exportText(doc)).text.split('\f')
      expect(texts[0]).toContain('ROTATE-FIXTURE-PAGE-4')
      expect(texts[1]).toContain('ROTATE-FIXTURE-PAGE-2')
      expect(texts[2]).toContain('ROTATE-FIXTURE-PAGE-2')
    } finally { await doc.destroy() }
  })
  it('snapshots a mixed-size plan and validates output order and dimensions', async () => {
    const bytes = fixture('F-003-mixed-sizes.pdf')
    const input = [{ sourcePage: 3, rotation: 90 }, { sourcePage: 1, rotation: 0 }]
    const job = startOrganize({ file: { displayName: 'mixed.pdf', bytes }, plan: input })
    input.reverse()
    input[0].rotation = 180
    await job.completion
    expect(job.state).toBe('done')
    const src = await PDFDocument.load(bytes)
    const out = await PDFDocument.load(job.result!.bytes)
    expect(out.getPages().map(p => p.getSize())).toEqual([src.getPage(2).getSize(), src.getPage(0).getSize()])
    expect(out.getPages().map(p => p.getRotation().angle)).toEqual([90, 0])
  })
  it('Rotate mode composes existing rotations and refuses reorder or deletion', async () => {
    const bytes = fixture('F-004-rotated-pages.pdf')
    const plan = initialPages([90, 90, 270, 270])
    const job = startOrganize({ file: { displayName: 'pre.pdf', bytes }, mode: 'rotate', plan })
    await job.completion
    expect(job.state).toBe('done')
    expect(job.result?.name).toBe('pre-rotated.pdf')
    for (const wrong of [plan.slice(1), [...plan].reverse()]) {
      const bad = startOrganize({ file: { displayName: 'pre.pdf', bytes }, mode: 'rotate', plan: wrong })
      await bad.completion
      expect(bad.error?.code).toBe('E-CONFIG-01')
    }
  })
  it('rejects an invalid plan without any downloadable output', async () => {
    const job = startOrganize({ file: { displayName: 'doc.pdf', bytes: fixture('F-001-plain-text-3p.pdf') }, plan: [{ sourcePage: 1.5 }] })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-CONFIG-01')
    expect(job.result).toBeUndefined()
  })
  it('cancelled exports never expose a result', async () => {
    const job = startOrganize({ file: { displayName: 'doc.pdf', bytes: fixture('F-001-plain-text-3p.pdf') }, plan: [{ sourcePage: 1 }] })
    job.cancel()
    await job.completion
    expect(job.state).toBe('cancelled')
    expect(job.result).toBeUndefined()
  })
})
