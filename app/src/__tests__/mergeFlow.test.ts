import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { startMerge } from '../tools/mergeFlow'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const F = (name: string) => new Uint8Array(readFileSync(path.join(ROOT, 'fixtures', name)))

let f001: Uint8Array
let f002: Uint8Array
let f003: Uint8Array
let f010: Uint8Array
let f011: Uint8Array

beforeAll(() => {
  f001 = F('pdf/F-001-plain-text-3p.pdf')
  f002 = F('pdf/F-002-plain-text-30p.pdf')
  f003 = F('pdf/F-003-mixed-sizes.pdf')
  f010 = F('pdf/F-010-encrypted-aes256.pdf')
  f011 = F('pdf/F-011-malformed-truncated.pdf')
})

describe('merge flow (PT-CORE-001)', () => {
  it('merges ordered inputs, verifies page count independently, names output', async () => {
    const job = startMerge({
      files: [
        { displayName: 'lecture.pdf', bytes: f001 },
        { displayName: 'reading.pdf', bytes: f002 },
      ],
    })
    await job.completion
    expect(job.state).toBe('done')
    expect(job.result?.name).toBe('lecture-merged.pdf')
    expect(job.result?.verified).toBe(true)
    expect(job.result?.actualBytes).toBeGreaterThan(1000)
  })

  it('merged output opens with the summed page count (3 + 30 + 4 = 37)', async () => {
    const job = startMerge({
      files: [
        { displayName: 'a.pdf', bytes: f001 },
        { displayName: 'b.pdf', bytes: f002 },
        { displayName: 'c.pdf', bytes: f003 },
      ],
    })
    await job.completion
    expect(job.state).toBe('done')
    const { openDocument, exportText } = await import('../engines/pdfjs')
    const doc = await openDocument(job.result!.bytes)
    expect(doc.numPages).toBe(37)
    // marker preservation across file boundary (page 4 = F-002 page 1)
    const text = await exportText(doc)
    expect(text.text).toContain('PACKING-BOX-0001')
    expect(text.text).toContain('MIXED-SIZE-PAGE-1')
    await doc.destroy()
  })

  it('single-file selection fails with E-INPUT-05 (never a 1-file merge)', async () => {
    const job = startMerge({ files: [{ displayName: 'only.pdf', bytes: f001 }] })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-INPUT-05')
  })

  it('encrypted input fails the whole job with E-INPUT-02 (no partial result)', async () => {
    const job = startMerge({
      files: [
        { displayName: 'good.pdf', bytes: f001 },
        { displayName: 'locked.pdf', bytes: f010 },
      ],
    })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-INPUT-02')
    expect(job.result).toBeUndefined()
  })

  it('malformed input fails with E-INPUT-03 (F-011 truncated)', async () => {
    const job = startMerge({
      files: [
        { displayName: 'good.pdf', bytes: f001 },
        { displayName: 'broken.pdf', bytes: f011 },
      ],
    })
    await job.completion
    expect(job.state).toBe('failed')
    expect(job.error?.code).toBe('E-INPUT-03')
  })

  it('cancel() before completion discards the result (no partial output rule)', async () => {
    const job = startMerge({
      files: [
        { displayName: 'a.pdf', bytes: f001 },
        { displayName: 'b.pdf', bytes: f002 },
      ],
    })
    // cancel immediately: tiny fixtures finish in <1ms, so we cancel synchronously
    // before any await — the orchestrator must discard whatever the executor returns.
    job.cancel()
    await job.completion
    // either the executor saw the token (cancelled) or finished before the token
    // check and the result was still discarded (cancelled) — never 'done' with a result
    expect(job.state).not.toBe('done')
    expect(job.result).toBeUndefined()
  })

  it('progress is reported and reaches 1 on success', async () => {
    const seen: number[] = []
    const job = startMerge(
      {
        files: [
          { displayName: 'a.pdf', bytes: f001 },
          { displayName: 'b.pdf', bytes: f002 },
        ],
      },
      { onProgress: (p) => seen.push(p.fraction) },
    )
    await job.completion
    expect(job.state).toBe('done')
    expect(seen[seen.length - 1]).toBe(1)
  })
})
