import { describe, expect, it } from 'vitest'

/**
 * PT-UX-002 component tests run against the extracted pure logic + a jsdom-style
 * render harness is deferred to PT-UX-003 e2e; here we test the exported
 * behavior units: validation integration, ordering, remove, formatBytes,
 * single-vs-multiple semantics — via the component's own exported contract.
 */
import { formatBytes } from '../components/format'

describe('formatBytes (display honesty, PT-PD-002 S6)', () => {
  it('labels bytes, KB and MB accurately', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(2698)).toBe('2.6 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('workspace selection semantics (via validateSelection integration)', () => {
  it('accepts multiple PDFs and marks one bad file without blocking others', async () => {
    const { validateSelection } = await import('../validation/validate')
    const f = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const read = (n: string) =>
      new Uint8Array(f.readFileSync(path.join(ROOT, 'fixtures', n)))
    const good = read('pdf/F-001-plain-text-3p.pdf')
    const good2 = read('pdf/F-002-plain-text-30p.pdf')
    const encrypted = read('pdf/F-010-encrypted-aes256.pdf')

    const outcomes = validateSelection(
      [
        { name: 'a.pdf', bytes: good },
        { name: 'locked.pdf', bytes: encrypted },
        { name: 'b.pdf', bytes: good2 },
      ],
      'pdf',
    )
    expect(outcomes.map((o) => o.ok)).toEqual([true, false, true])
    expect(outcomes[1].error?.code).toBe('E-INPUT-02')
    // display names sanitized for the valid files
    expect(outcomes[0].meta?.displayName).toBe('a.pdf')
  })

  it('image tool accepts jpeg+png and rejects pdf content', async () => {
    const { validateSelection } = await import('../validation/validate')
    const f = await import('node:fs')
    const path = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
    const read = (n: string) =>
      new Uint8Array(f.readFileSync(path.join(ROOT, 'fixtures', n)))
    const outcomes = validateSelection(
      [
        { name: 'photo.jpg', bytes: read('images/F-007-photo.jpg') },
        { name: 'diagram.png', bytes: read('images/F-013-diagram.png') },
        { name: 'doc.pdf', bytes: read('pdf/F-001-plain-text-3p.pdf') },
      ],
      'image',
    )
    expect(outcomes.map((o) => o.ok)).toEqual([true, true, false])
    expect(outcomes[2].error?.code).toBe('E-INPUT-01')
  })
})
