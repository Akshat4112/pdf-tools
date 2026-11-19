import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileSession } from '../session/fileSession'
import { runJob } from '../jobs/orchestrator'

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
  it('keeps another active workspace download alive while clearing the first', () => {
    let serial = 0
    const revoked: string[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:synthetic-independent-${++serial}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => { revoked.push(url) })

    const first = new FileSession()
    const second = new FileSession()
    const firstOutput = first.addOutput('first.pdf', 'application/pdf', pdf)
    const secondOutput = second.addOutput('second.pdf', 'application/pdf', pdf)
    const firstUrl = first.objectUrlFor(firstOutput.id)
    const secondUrl = second.objectUrlFor(secondOutput.id)

    first.resetSession()
    expect(revoked).toEqual([firstUrl])
    expect(first.audit()).toEqual(empty)
    expect(second.audit()).toEqual({ files: 0, outputs: 1, objectUrls: 1, activeJobs: 0 })
    expect(second.objectUrlFor(secondOutput.id)).toBe(secondUrl)

    second.clearFiles()
    expect(revoked).toEqual([firstUrl, secondUrl])
    expect(second.audit()).toEqual(empty)
  })

  it('isolates active jobs and download URLs between two sessions during reset', async () => {
    let serial = 0
    const revoked: string[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:synthetic-cross-session-${++serial}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => { revoked.push(url) })

    const first = new FileSession()
    const second = new FileSession()
    const firstOutput = first.addOutput('private-first.pdf', 'application/pdf', pdf)
    const secondOutput = second.addOutput('private-second.pdf', 'application/pdf', pdf)
    const firstUrl = first.objectUrlFor(firstOutput.id)
    const secondUrl = second.objectUrlFor(secondOutput.id)

    let releaseFirst!: () => void
    let releaseSecond!: () => void
    const firstJob = first.jobs.track(runJob('synthetic-first', 1, async () => {
      await new Promise<void>(resolve => { releaseFirst = resolve })
      return 'stale-first'
    }))
    const secondJob = second.jobs.track(runJob('synthetic-second', 2, async () => {
      await new Promise<void>(resolve => { releaseSecond = resolve })
      return 'valid-second'
    }))
    await Promise.resolve()
    expect(first.audit().activeJobs).toBe(1)
    expect(second.audit().activeJobs).toBe(1)

    first.resetSession()
    expect(first.audit()).toEqual(empty)
    expect(revoked).toEqual([firstUrl])
    expect(firstJob.state).toBe('cancelled')
    expect(secondJob.state).not.toBe('cancelled')
    expect(second.objectUrlFor(secondOutput.id)).toBe(secondUrl)
    expect(second.audit().objectUrls).toBe(1)

    releaseFirst()
    releaseSecond()
    await Promise.all([firstJob.completion, secondJob.completion])
    expect(firstJob.result).toBeUndefined()
    expect(secondJob.state).toBe('done')
    expect(secondJob.result).toBe('valid-second')
    expect(second.audit()).toEqual({ files: 0, outputs: 1, objectUrls: 1, activeJobs: 0 })
    second.resetSession()
    expect(revoked).toEqual([firstUrl, secondUrl])
    expect(second.audit()).toEqual(empty)
  })

  it('isolates a late rejected job in one session while a second session finishes and retains its download', async () => {
    const revoked: string[] = []
    let serial = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:synthetic-rejection-isolation-${++serial}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => { revoked.push(url) })

    const cancelled = new FileSession()
    const surviving = new FileSession()
    const cancelledOutput = cancelled.addOutput('cancelled.pdf', 'application/pdf', pdf)
    const survivingOutput = surviving.addOutput('surviving.pdf', 'application/pdf', pdf)
    const cancelledUrl = cancelled.objectUrlFor(cancelledOutput.id)
    const survivingUrl = surviving.objectUrlFor(survivingOutput.id)

    let rejectCancelled!: (error: Error) => void
    let releaseSurvivor!: () => void
    const cancelledJob = cancelled.jobs.track(runJob('synthetic-rejected', 1, async () =>
      new Promise<string>((_resolve, reject) => { rejectCancelled = reject }),
    ))
    const survivingJob = surviving.jobs.track(runJob('synthetic-survivor', 2, async () => {
      await new Promise<void>(resolve => { releaseSurvivor = resolve })
      return 'verified-survivor'
    }))
    await Promise.resolve()
    cancelled.resetSession()
    rejectCancelled(new Error('synthetic confidential failure from discarded document'))
    releaseSurvivor()
    await Promise.all([cancelledJob.completion, survivingJob.completion])

    expect(cancelledJob.state).toBe('cancelled')
    expect(cancelledJob.result).toBeUndefined()
    expect(cancelledJob.error).toBeUndefined()
    expect(cancelled.audit()).toEqual(empty)
    expect(revoked).toEqual([cancelledUrl])

    expect(survivingJob.state).toBe('done')
    expect(survivingJob.result).toBe('verified-survivor')
    expect(surviving.objectUrlFor(survivingOutput.id)).toBe(survivingUrl)
    expect(surviving.audit()).toEqual({ files: 0, outputs: 1, objectUrls: 1, activeJobs: 0 })
    surviving.resetSession()
    expect(revoked).toEqual([cancelledUrl, survivingUrl])
    expect(surviving.audit()).toEqual(empty)
  })

})
