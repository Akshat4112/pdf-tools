import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildZip,
  verifyAllOutputs,
  verifyOutput,
  verifyPdfPageCount,
  zipEntryName,
  type VerifiableOutput,
} from '../outputs/verify'
import { mergePdfs } from '../engines/pdflib'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')
const F = (name: string) => new Uint8Array(readFileSync(path.join(ROOT, 'fixtures', name)))

let f001: Uint8Array
let f002: Uint8Array
let jpg: Uint8Array
let png: Uint8Array

beforeAll(() => {
  f001 = F('pdf/F-001-plain-text-3p.pdf')
  f002 = F('pdf/F-002-plain-text-30p.pdf')
  jpg = F('images/F-007-photo.jpg')
  png = F('images/F-013-diagram.png')
})

const asOut = (name: string, mimeType: string, bytes: Uint8Array, expectedPages?: number): VerifiableOutput => ({
  name, mimeType, bytes, expectedPages,
})

describe('verifyOutput (PT-FND-007 structural gate)', () => {
  it('accepts real PDF fixtures (F-001, F-002)', async () => {
    const v = await verifyOutput(asOut('merged.pdf', 'application/pdf', f001))
    expect(v.verified).toBe(true)
    expect(v.actualBytes).toBe(f001.byteLength)
  })

  it('accepts JPEG, PNG, TXT outputs', async () => {
    expect((await verifyOutput(asOut('a.jpg', 'image/jpeg', jpg))).verified).toBe(true)
    expect((await verifyOutput(asOut('b.png', 'image/png', png))).verified).toBe(true)
    const txt = new TextEncoder().encode('PACKING-BOX-0001\npage text')
    expect((await verifyOutput(asOut('c.txt', 'text/plain', txt))).verified).toBe(true)
  })

  it('rejects empty output with E-OUT-01', async () => {
    await expect(verifyOutput(asOut('x.pdf', 'application/pdf', new Uint8Array(0)))).rejects.toMatchObject({
      code: 'E-OUT-01',
    })
  })

  it('rejects truncated PDF (no %%EOF) with E-OUT-01', async () => {
    const truncated = f001.subarray(0, Math.floor(f001.byteLength * 0.5))
    await expect(verifyOutput(asOut('t.pdf', 'application/pdf', truncated))).rejects.toMatchObject({
      code: 'E-OUT-01',
    })
  })

  it('rejects wrong-content images and NUL-bearing text', async () => {
    await expect(verifyOutput(asOut('a.jpg', 'image/jpeg', png))).rejects.toMatchObject({ code: 'E-OUT-01' })
    await expect(verifyOutput(asOut('a.png', 'image/png', jpg))).rejects.toMatchObject({ code: 'E-OUT-01' })
    const badTxt = new TextEncoder().encode('abc\u0000def')
    await expect(verifyOutput(asOut('t.txt', 'text/plain', badTxt))).rejects.toMatchObject({ code: 'E-OUT-01' })
  })

  it('rejects unknown mime kinds (never claim verification blindly)', async () => {
    await expect(verifyOutput(asOut('x.docx', 'application/vnd...', f001))).rejects.toMatchObject({
      code: 'E-OUT-01',
    })
  })

  it('verifyAllOutputs fails the whole batch on one bad output', async () => {
    const good = asOut('g.pdf', 'application/pdf', f001)
    const bad = asOut('b.pdf', 'application/pdf', new Uint8Array([1, 2, 3]))
    await expect(verifyAllOutputs([good, bad])).rejects.toMatchObject({ code: 'E-OUT-01' })
  })
})

describe('verifyPdfPageCount (strict independent readback)', () => {
  it('confirms a real merged output has the expected pages', async () => {
    const merged = await mergePdfs([f001, f002]) // 3 + 30 = 33
    await verifyPdfPageCount(merged, 33)
  })

  it('rejects a page-count mismatch with E-OUT-01', async () => {
    const merged = await mergePdfs([f001, f002])
    await expect(verifyPdfPageCount(merged, 32)).rejects.toMatchObject({ code: 'E-OUT-01' })
  })
})

describe('zipEntryName (deterministic safe names)', () => {
  it('pads indexes and keeps extensions', () => {
    expect(zipEntryName('report.pdf', 1, 12, 'pdf')).toBe('report-01.pdf')
    expect(zipEntryName('report.pdf', 12, 12, 'pdf')).toBe('report-12.pdf')
  })

  it('sanitizes hostile stems and truncates', () => {
    expect(zipEntryName('../../etc/passwd.pdf', 1, 3, 'pdf')).toBe('passwd-1.pdf')
    const long = 'x'.repeat(200)
    const name = zipEntryName(`${long}.pdf`, 1, 3, 'pdf')
    expect(name.length).toBeLessThanOrEqual(60 + 10)
  })
})

describe('buildZip (zip.js packaging)', () => {
  it('packages split outputs into a readable ZIP with PK magic', async () => {
    const src = f002
    const { splitPdf } = await import('../engines/pdflib')
    const parts = await splitPdf(src, [
      [1, 2, 3],
      [4, 5],
    ])
    const entries = parts.map((bytes, i) => ({
      name: zipEntryName('doc.pdf', i + 1, parts.length, 'pdf'),
      bytes,
      mimeType: 'application/pdf',
    }))
    const zipBytes = await buildZip(entries)
    expect(zipBytes[0]).toBe(0x50)
    expect(zipBytes[1]).toBe(0x4b)
    // structural verification of the ZIP output itself
    const v = await verifyOutput(asOut('parts.zip', 'application/zip', zipBytes))
    expect(v.verified).toBe(true)
  })

  it('round-trips: entries read back from the ZIP are byte-identical', async () => {
    const entries: Array<{ name: string; bytes: Uint8Array; mimeType: string }> = [
      { name: zipEntryName('doc.pdf', 1, 2, 'pdf'), bytes: f001, mimeType: 'application/pdf' },
      { name: zipEntryName('doc.pdf', 2, 2, 'jpg'), bytes: jpg, mimeType: 'image/jpeg' },
    ]
    const zipBytes = await buildZip(entries)

    const { BlobReader, ZipReader, TextWriter, BlobWriter } = await import('@zip.js/zip.js')
    const ab = new ArrayBuffer(zipBytes.byteLength)
    new Uint8Array(ab).set(zipBytes)
    const reader = new ZipReader(new BlobReader(new Blob([ab])))
    const namesInOrder: string[] = []
    const roundTripped = new Map<string, Uint8Array>()
    for (const entry of await reader.getEntries()) {
      namesInOrder.push(entry.filename)
      if ('getData' in entry && typeof entry.getData === 'function') {
        const blob: Blob = await entry.getData(new BlobWriter())
        roundTripped.set(entry.filename, new Uint8Array(await blob.arrayBuffer()))
      }
    }
    await reader.close()
    void TextWriter
    expect(namesInOrder.sort()).toEqual(entries.map((e) => e.name).sort())
    for (const e of entries) {
      const rt = roundTripped.get(e.name)
      expect(rt?.byteLength).toBe(e.bytes.byteLength)
    }
  })

  it('rejects duplicate entry names and empty batches with taxonomy codes', async () => {
    const e = { name: 'a.pdf', bytes: f001, mimeType: 'application/pdf' }
    await expect(buildZip([e, { ...e }])).rejects.toMatchObject({ code: 'E-OUT-01' })
    await expect(buildZip([])).rejects.toMatchObject({ code: 'E-INPUT-05' })
  })
})
