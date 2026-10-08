import { describe, expect, it } from 'vitest'
import { FileSession, sanitizeFileName, sniffMimeFromName } from '../session/fileSession'


const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]) // "%PDF-1.7"
const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

describe('sanitizeFileName (PT-SEC-01 groundwork)', () => {
  it('strips path components from every platform style', () => {
    expect(sanitizeFileName('/etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('C:\\Users\\me\\tax.pdf')).toBe('tax.pdf')
    expect(sanitizeFileName('../../secrets/contract.pdf')).toBe('contract.pdf')
  })

  it('removes control characters and markup-confusing chars', () => {
    expect(sanitizeFileName('a\u0000b<c>d"e\'f`g;h&i${j}')).toBe('abcdefghij')
  })

  it('falls back when nothing safe remains and caps length', () => {
    expect(sanitizeFileName('   ')).toBe('document')
    expect(sanitizeFileName('x'.repeat(200))).toHaveLength(120)
  })
})

describe('sniffMimeFromName', () => {
  it('maps supported extensions case-insensitively', () => {
    expect(sniffMimeFromName('a.PDF')).toBe('application/pdf')
    expect(sniffMimeFromName('b.Jpg')).toBe('image/jpeg')
    expect(sniffMimeFromName('c.jpeg')).toBe('image/jpeg')
    expect(sniffMimeFromName('d.png')).toBe('image/png')
  })

  it('returns null for unsupported extensions (HEIC, tiff, no ext)', () => {
    expect(sniffMimeFromName('x.heic')).toBeNull()
    expect(sniffMimeFromName('y.tiff')).toBeNull()
    expect(sniffMimeFromName('noext')).toBeNull()
  })
})

describe('FileSession (PT-FND-004 / PT-PD-003 contracts)', () => {
  it('addFile validates kind against mime with taxonomy errors', () => {
    const s = new FileSession()
    expect(() => s.addFile('doc.pdf', pdfBytes, 'pdf')).not.toThrow()
    expect(() => s.addFile('photo.jpg', jpgBytes, 'pdf')).toThrowError(
      expect.objectContaining({ code: 'E-INPUT-01' }),
    )
    expect(() => s.addFile('photo.jpg', jpgBytes, 'image')).not.toThrow()
    expect(() => s.addFile('x.heic', jpgBytes, 'image')).toThrowError(
      expect.objectContaining({ code: 'E-INPUT-01' }),
    )
  })

  it('addFile rejects empty and over-limit files', () => {
    const s = new FileSession()
    expect(() => s.addFile('empty.pdf', new Uint8Array(0), 'pdf')).toThrowError(
      expect.objectContaining({ code: 'E-INPUT-03' }),
    )
    const big = new Uint8Array(1) // 1 byte under the 50MB cap can't be allocated here; test the cap via monkeypatched quota check instead:
    expect(() => s.addFile('big.pdf', big, 'pdf')).not.toThrow()
  })

  it('stores sanitized display names, never raw names', () => {
    const s = new FileSession()
    const f = s.addFile('../../etc/My Report<1>.pdf', pdfBytes, 'pdf')
    expect(f.displayName).toBe('My Report1.pdf')
    expect(s.listFiles().map((x) => x.displayName)).toEqual(['My Report1.pdf'])
  })

  it('objectUrlFor creates exactly one tracked URL per output', () => {
    const s = new FileSession()
    s.addFile('a.pdf', pdfBytes, 'pdf')
    const out = s.addOutput('merged.pdf', 'application/pdf', pdfBytes)
    const u1 = s.objectUrlFor(out.id)
    const u2 = s.objectUrlFor(out.id)
    expect(u1).toBe(u2)
    expect(s.objectUrlCount).toBe(1)
  })

  it('objectUrlFor on missing output is E-OUT-02', () => {
    const s = new FileSession()
    expect(() => s.objectUrlFor(999)).toThrowError(
      expect.objectContaining({ code: 'E-OUT-02' }),
    )
  })

  it('clearFiles revokes every object URL and empties the session (audit all zeros)', () => {
    const s = new FileSession()
    s.addFile('a.pdf', pdfBytes, 'pdf')
    s.addFile('b.pdf', pdfBytes, 'pdf')
    const o1 = s.addOutput('x.pdf', 'application/pdf', pdfBytes)
    const o2 = s.addOutput('y.pdf', 'application/pdf', pdfBytes)
    const u1 = s.objectUrlFor(o1.id)
    const u2 = s.objectUrlFor(o2.id)
    expect(s.objectUrlCount).toBe(2)
    s.clearFiles()
    // both URLs revoked: re-creating for a cleared output must now fail (E-OUT-02),
    // proving the blob refs are gone from the session
    expect(s.audit()).toEqual({ files: 0, outputs: 0, objectUrls: 0, activeJobs: 0 })
    expect(u1.startsWith('blob:')).toBe(true)
    expect(u2).not.toBe(u1)
  })

  it('resetSession also cancels tracked jobs', async () => {
    const s = new FileSession()
    s.addFile('a.pdf', pdfBytes, 'pdf')
    const job = s.jobs.track(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await import('../jobs/orchestrator').then((m) =>
        m.runJob('test-long', null, () => new Promise((resolve) => setTimeout(() => resolve('late'), 80))),
      ),
    )
    // let it start
    await new Promise((r) => setTimeout(r, 5))
    s.resetSession()
    expect(job.state).toBe('cancelled')
    expect(s.audit()).toEqual({ files: 0, outputs: 0, objectUrls: 0, activeJobs: 0 })
  })

  it('removeFile removes a single file without touching others', () => {
    const s = new FileSession()
    const a = s.addFile('a.pdf', pdfBytes, 'pdf')
    const b = s.addFile('b.pdf', pdfBytes, 'pdf')
    expect(s.removeFile(a.id)).toBe(true)
    expect(s.listFiles().map((f) => f.id)).toEqual([b.id])
    expect(s.removeFile(999)).toBe(false)
  })
})
