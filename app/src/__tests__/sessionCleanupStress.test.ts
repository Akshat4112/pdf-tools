import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileSession } from '../session/fileSession'

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])
const empty = { files: 0, outputs: 0, objectUrls: 0, activeJobs: 0 }

afterEach(() => vi.restoreAllMocks())

describe('PT-IMP-009 repeated session lifecycle stress', () => {
  it('releases every generated object URL through 100 select/download/reset cycles', () => {
    let serial = 0
    const created: string[] = []
    const revoked: string[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:synthetic-stress-${++serial}`
      created.push(url)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => { revoked.push(url) })

    const session = new FileSession()
    for (let cycle = 0; cycle < 100; cycle++) {
      session.addFile(`synthetic-${cycle}.pdf`, pdf, 'pdf')
      const outputs = Array.from({ length: 3 }, (_, index) =>
        session.addOutput(`result-${cycle}-${index}.pdf`, 'application/pdf', pdf),
      )
      for (const output of outputs) {
        const url = session.objectUrlFor(output.id)
        expect(session.objectUrlFor(output.id)).toBe(url)
      }
      expect(session.audit()).toEqual({ files: 1, outputs: 3, objectUrls: 3, activeJobs: 0 })
      if (cycle % 2) session.resetSession()
      else session.clearFiles()
      expect(session.audit()).toEqual(empty)
      for (const output of outputs) {
        expect(session.getOutput(output.id)).toBeUndefined()
        expect(() => session.objectUrlFor(output.id)).toThrow()
      }
    }
    expect(created).toHaveLength(300)
    expect(revoked).toHaveLength(300)
    expect(new Set(revoked).size).toBe(300)
    expect(new Set(revoked)).toEqual(new Set(created))
  })

  it('cleans up URL registry even when the session has no remaining input files', () => {
    const revoked: string[] = []
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:synthetic-orphan-output')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => { revoked.push(url) })
    const session = new FileSession()
    const input = session.addFile('synthetic.pdf', pdf, 'pdf')
    const output = session.addOutput('synthetic-result.pdf', 'application/pdf', pdf)
    session.objectUrlFor(output.id)
    session.removeFile(input.id)
    expect(session.audit()).toEqual({ files: 0, outputs: 1, objectUrls: 1, activeJobs: 0 })
    session.resetSession()
    expect(revoked).toEqual(['blob:synthetic-orphan-output'])
    expect(session.audit()).toEqual(empty)
  })
})
