import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openDocument } from '../engines/pdfjs'

const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn() }))
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ getDocument: mocks.getDocument, PDFWorker: class { destroy() {} } }))

describe('PDF.js bootstrap recovery', () => {
  beforeEach(() => {
    mocks.getDocument.mockReset()
    mocks.destroy.mockReset().mockResolvedValue(undefined)
  })
  function failed(message: string) {
    return { promise: Promise.reject(new Error(message)), destroy: mocks.destroy }
  }
  it('retries once using fresh private bytes and cleans up the failed load', async () => {
    const input = new Uint8Array([1, 2, 3])
    mocks.getDocument.mockImplementationOnce(({ data }: { data: Uint8Array }) => {
      data.fill(0)
      return failed('Setting up fake worker failed: unavailable')
    }).mockImplementationOnce(({ data }: { data: Uint8Array }) => {
      expect(Array.from(data)).toEqual([1, 2, 3])
      return { promise: Promise.resolve({ numPages: 1 }), destroy: mocks.destroy }
    })
    const doc = await openDocument(input)
    expect(mocks.getDocument).toHaveBeenCalledTimes(2)
    expect(mocks.destroy).toHaveBeenCalledTimes(1)
    expect(Array.from(input)).toEqual([1, 2, 3])
    await doc.destroy()
    expect(mocks.destroy).toHaveBeenCalledTimes(2)
  })
  it('stops after a second bootstrap failure', async () => {
    mocks.getDocument.mockImplementation(() => failed('Setting up fake worker failed: unavailable'))
    await expect(openDocument(new Uint8Array([1]))).rejects.toMatchObject({ code: 'E-PROC-01' })
    expect(mocks.getDocument).toHaveBeenCalledTimes(2)
    expect(mocks.destroy).toHaveBeenCalledTimes(2)
  })
  it('does not retry malformed PDF errors', async () => {
    mocks.getDocument.mockImplementation(() => failed('Invalid PDF structure'))
    await expect(openDocument(new Uint8Array([1]))).rejects.toMatchObject({ code: 'E-INPUT-03' })
    expect(mocks.getDocument).toHaveBeenCalledTimes(1)
  })
})
