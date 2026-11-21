import { describe, expect, it } from 'vitest'
import { sanitizeFileName, safeDownloadName } from '../security/fileNames'
import { FileSession } from '../session/fileSession'
import { validateFile } from '../validation/validate'
import { buildZip, verifyOutput, zipEntryName } from '../outputs/verify'

const pdf = new TextEncoder().encode('%PDF-1.7\n%%EOF')

describe('PT-SEC-001 filename boundaries', () => {
  it.each([
    ['../../secret.pdf', 'secret.pdf'], ['C:\\private\\tax.pdf', 'tax.pdf'],
    ['.hidden.pdf. ', 'hidden.pdf'], ['..', 'document'],
    ['CON.pdf', '_CON.pdf'], ['lpt1.txt', '_lpt1.txt'],
    ['CON .pdf', '_CON .pdf'], ['COM¹.pdf', '_COM¹.pdf'],
    ['ab\u202ecd\u2066ef\u0085.pdf', 'abcdef.pdf'],
    ['a:b?c*d|e.pdf', 'abcde.pdf'], ['Re\u0301sume\u0301.pdf', 'Résumé.pdf'],
  ])('normalizes %j at the selection boundary', (raw, expected) => {
    expect(sanitizeFileName(raw)).toBe(expected)
    expect(validateFile(raw, pdf, 'pdf').displayName).toBe(expected)
  })

  it('uses the same policy when storing supported input files', () => {
    expect(new FileSession().addFile('CON.pdf', pdf, 'pdf').displayName).toBe('_CON.pdf')
    expect(new FileSession().addFile('ab\u202ecd.pdf', pdf, 'pdf').displayName).toBe('abcd.pdf')
  })

  it('bounds long Unicode names without losing their extension or splitting characters', () => {
    const result = sanitizeFileName('📄'.repeat(150) + '.pdf')
    expect(result.length).toBeLessThanOrEqual(120)
    expect(result).toMatch(/\.pdf$/)
    expect(result).not.toMatch(/[\ud800-\udbff]$/)
    expect(sanitizeFileName('', '../../CON.')).toBe('_CON')
  })

  it.each(['報告', 'नमस्ते', '📄'])('bounds UTF-8 filename bytes for %s', (unit) => {
    const raw = unit.repeat(150) + '.pdf'
    for (const [mime, ext] of [
      ['application/pdf', 'pdf'], ['application/zip', 'zip'],
      ['image/png', 'png'], ['image/jpeg', 'jpg'], ['text/plain', 'txt'],
    ]) {
      const name = safeDownloadName(raw, mime)
      expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255)
      expect(name.length).toBeLessThanOrEqual(120)
      expect(name.endsWith('.' + ext)).toBe(true)
      expect(name).toBe(sanitizeFileName(name))
    }
  })

  it.each([
    ['application/pdf', 'pdf'], ['text/plain', 'txt'], ['application/zip', 'zip'],
    ['image/png', 'png'], ['image/jpeg', 'jpg'],
  ])('pins download extension to %s', (mime, extension) => {
    const name = safeDownloadName('../../CON.html', mime)
    expect(name).toBe(`_CON.${extension}`)
    expect(new FileSession().addOutput('../../CON.html', mime, pdf).name).toBe(name)
  })

  it('preserves Unicode and multiple dots in indexed archive filenames', async () => {
    expect(zipEntryName('Re\u0301sume\u0301.2026📄.pdf', 1, 2, 'pdf')).toBe('Résumé.2026📄-1.pdf')
    expect(zipEntryName('報告\u202e.2026.pdf', 2, 2, 'png')).toBe('報告.2026-2.png')
    const long = zipEntryName('📄'.repeat(100) + '.pdf', 1, 2, 'pdf')
    expect(long).toMatch(/^(?:📄)+-1\.pdf$/u)
    await expect(buildZip([
      { name: 'Résumé.pdf', mimeType: 'application/pdf', bytes: pdf },
      { name: 'RÉSUMÉ.pdf', mimeType: 'application/pdf', bytes: pdf },
    ])).rejects.toMatchObject({ code: 'E-OUT-01' })
  })

  it('normalizes before publishing verified names and rejects unsafe archive members', async () => {
    const verified = await verifyOutput({ name: '../../evil\u202e.html', mimeType: 'application/pdf', bytes: pdf })
    expect(verified.name).toBe('evil.pdf')
    for (const name of ['../escape.pdf', '/absolute.pdf', 'CON.pdf', 'file.pdf\u202e', 'wrong.html']) {
      await expect(buildZip([{ name, mimeType: 'application/pdf', bytes: pdf }])).rejects.toMatchObject({ code: 'E-OUT-01' })
    }
    expect(zipEntryName('CON.pdf', 1, 1, 'pdf')).toBe('CON-1.pdf')
    expect(() => zipEntryName('safe.pdf', 1, 1, '../../html')).toThrow()
    for (const mime of ['text/html', '__proto__', 'constructor']) {
      expect(() => safeDownloadName('safe.bin', mime)).toThrowError(expect.objectContaining({ code: 'E-OUT-01' }))
    }
  })
})
