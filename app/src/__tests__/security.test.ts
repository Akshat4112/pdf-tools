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

  it.each([
    ['application/pdf', 'pdf'], ['text/plain', 'txt'], ['application/zip', 'zip'],
    ['image/png', 'png'], ['image/jpeg', 'jpg'],
  ])('pins download extension to %s', (mime, extension) => {
    const name = safeDownloadName('../../CON.html', mime)
    expect(name).toBe(`_CON.${extension}`)
    expect(new FileSession().addOutput('../../CON.html', mime, pdf).name).toBe(name)
  })

  it('normalizes before publishing verified names and rejects unsafe archive members', async () => {
    const verified = await verifyOutput({ name: '../../evil\u202e.html', mimeType: 'application/pdf', bytes: pdf })
    expect(verified.name).toBe('evil.pdf')
    for (const name of ['../escape.pdf', '/absolute.pdf', 'CON.pdf', 'file.pdf\u202e', 'wrong.html']) {
      await expect(buildZip([{ name, mimeType: 'application/pdf', bytes: pdf }])).rejects.toMatchObject({ code: 'E-OUT-01' })
    }
    expect(zipEntryName('CON.pdf', 1, 1, 'pdf')).toBe('CON-1.pdf')
    expect(() => zipEntryName('safe.pdf', 1, 1, '../../html')).toThrow()
    expect(() => safeDownloadName('safe.bin', 'text/html')).toThrow()
  })
})
