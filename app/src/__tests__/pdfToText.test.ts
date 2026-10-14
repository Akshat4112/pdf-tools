import { readFileSync } from 'node:fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { openDocument } from '../engines/pdfjs'
import { joinTextItems, startPdfToText, TEXT_OUTPUT_LIMIT, TEXT_PREVIEW_LIMIT } from '../tools/pdfToTextFlow'

const fixture = (name: string) => new Uint8Array(readFileSync(`../fixtures/pdf/${name}.pdf`))
const request = (bytes: Uint8Array) => ({ file: { displayName: '../../paper.pdf', bytes } })

describe('PDF to Text', () => {
  it('preserves Unicode text items and line-ending hints without guessing column order', () => {
    expect(joinTextItems([{ str: 'Grüße' }, { str: '中文 😀', hasEOL: true }, { str: 'next line' }])).toBe('Grüße 中文 😀\nnext line')
    expect(joinTextItems([{ str: '' }, { str: '  ', hasEOL: true }])).toBe('')
  })
  it('exports a real PDF with exact page boundaries, names, byte size and unchanged input', async () => {
    const bytes = fixture('F-001-plain-text-3p'), before = bytes.slice(), input = request(bytes), job = startPdfToText(input)
    input.file.displayName = 'changed.pdf'
    await job.completion
    expect(job.error).toBeUndefined(); expect(job.state).toBe('done')
    expect(job.result).toMatchObject({ kind: 'text', totalPages: 3, pagesWithText: 3, pagesWithoutText: [] })
    const output = job.result!.output!, parts = new TextDecoder('utf-8', { fatal: true }).decode(output.bytes).split('\f')
    expect(parts).toHaveLength(3)
    parts.forEach((text, index) => expect(text).toContain(`PACKING-BOX-000${index + 1}`))
    expect(output).toMatchObject({ name: 'paper.txt', verified: true, actualBytes: output.bytes.length })
    expect(bytes).toEqual(before)
  })
  it('returns an explicit no-text outcome, not a blank download, for scans', async () => {
    const job = startPdfToText(request(fixture('F-008-scan-like'))); await job.completion
    expect(job.result).toMatchObject({ kind: 'no-text', pagesWithText: 0, pagesWithoutText: [1], preview: '' })
    expect(job.result?.output).toBeUndefined()
  })
  it('retains empty first/middle/last page positions in mixed documents', async () => {
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica)
    for (let i = 0; i < 5; i++) { const page = pdf.addPage(); if (i === 1 || i === 3) page.drawText(`Text ${i}`, { font }) }
    const job = startPdfToText(request(await pdf.save())); await job.completion
    expect(job.result?.pagesWithoutText).toEqual([1, 3, 5])
    expect(new TextDecoder().decode(job.result!.output!.bytes).split('\f')).toEqual(['', 'Text 1', '', 'Text 3', ''])
  })
  it('rejects encrypted, malformed and over-page-limit sources without output', async () => {
    const pdf = await PDFDocument.create(); for (let i = 0; i < 301; i++) pdf.addPage()
    for (const bytes of [fixture('F-010-encrypted-aes256'), new TextEncoder().encode('%PDF-broken'), await pdf.save()]) {
      const job = startPdfToText(request(bytes)); await job.completion
      expect(job.state).toBe('failed'); expect(job.result).toBeUndefined(); expect(job.error?.code).toMatch(/^E-INPUT-/)
    }
  })
  it('cancellation at page progress discards partial text and a fresh job succeeds', async () => {
    const job = startPdfToText(request(fixture('F-002-plain-text-30p')), { onProgress: progress => { if (progress.fraction > 0) job.cancel() } })
    await job.completion; expect(job.state).toBe('cancelled'); expect(job.result).toBeUndefined()
    const retry = startPdfToText(request(fixture('F-001-plain-text-3p'))); await retry.completion; expect(retry.state).toBe('done')
  })
  it('caps the preview while retaining complete text in the verified download', async () => {
    const job = startPdfToText(request(fixture('F-002-plain-text-30p'))); await job.completion
    expect(job.result?.preview.length).toBeLessThanOrEqual(TEXT_PREVIEW_LIMIT)
    expect(job.result?.previewTruncated).toBe(true)
    expect(new TextDecoder().decode(job.result!.output!.bytes)).toContain('PACKING-BOX-0030')
  })
  it('refuses oversized extracted text before creating an output and destroys the document', async () => {
    const actual = await openDocument(fixture('F-001-plain-text-3p'))
    const destroy = vi.spyOn(actual, 'destroy')
    const getPage = vi.spyOn(actual, 'getPage').mockResolvedValue({ getTextContent: async () => ({ items: [{ str: 'x'.repeat(TEXT_OUTPUT_LIMIT + 1) }] }), cleanup: () => {} } as never)
    const module = await import('../engines/pdfjs'), open = vi.spyOn(module, 'openDocument').mockResolvedValue(actual)
    try { const job = startPdfToText(request(fixture('F-001-plain-text-3p'))); await job.completion; expect(job.error?.code).toBe('E-PROC-02'); expect(job.result).toBeUndefined(); expect(destroy).toHaveBeenCalledTimes(1) }
    finally { open.mockRestore(); getPage.mockRestore(); destroy.mockRestore() }
  })
})
