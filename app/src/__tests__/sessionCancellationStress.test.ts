import { describe, expect, it } from 'vitest'
import { FileSession } from '../session/fileSession'
import { runJob } from '../jobs/orchestrator'

const empty = { files: 0, outputs: 0, objectUrls: 0, activeJobs: 0 }

describe('PT-IMP-009 cancellation and late-result isolation', () => {
  it('cancels 100 in-flight jobs on reset and discards every late result', async () => {
    const session = new FileSession()
    const releases: Array<() => void> = []
    const jobs = Array.from({ length: 100 }, (_, index) => {
      const job = runJob('synthetic-stress', index, async (input) => {
        await new Promise<void>(resolve => { releases.push(resolve) })
        return { privateResult: input }
      })
      return session.jobs.track(job)
    })
    // Allow all executors to enter the pending state before resetting.
    await Promise.resolve()
    expect(releases).toHaveLength(100)
    expect(session.audit().activeJobs).toBe(100)
    session.resetSession()
    expect(session.audit()).toEqual(empty)
    for (const job of jobs) expect(job.state).toBe('cancelled')
    releases.forEach(release => release())
    await Promise.all(jobs.map(job => job.completion))
    for (const job of jobs) {
      expect(job.state).toBe('cancelled')
      expect(job.result).toBeUndefined()
    }
    expect(session.audit()).toEqual(empty)
  })

  it('does not leak a late result into a new session job', async () => {
    const session = new FileSession()
    let release!: () => void
    const stale = session.jobs.track(runJob('synthetic-stale', 1, async () => {
      await new Promise<void>(resolve => { release = resolve })
      return 'stale-private-output'
    }))
    await Promise.resolve()
    session.clearFiles()
    const current = session.jobs.track(runJob('synthetic-current', 2, async () => 'fresh-output'))
    release()
    await Promise.all([stale.completion, current.completion])
    expect(stale.state).toBe('cancelled')
    expect(stale.result).toBeUndefined()
    expect(current.state).toBe('done')
    expect(current.result).toBe('fresh-output')
    expect(session.audit()).toEqual(empty)
  })
  it('isolates a failed synthetic job and permits a clean subsequent run', async () => {
    const session = new FileSession()
    const failed = session.jobs.track(runJob('synthetic-failure', 1, async () => {
      throw new Error('synthetic private failure detail')
    }))
    await failed.completion
    expect(failed.state).toBe('failed')
    expect(failed.result).toBeUndefined()
    expect(failed.error?.code).toBe('E-PROC-01')
    expect(JSON.stringify(failed.error)).not.toContain('synthetic private failure detail')
    expect(session.audit()).toEqual(empty)

    const recovered = session.jobs.track(runJob('synthetic-recovery', 2, async () => 'verified synthetic output'))
    await recovered.completion
    expect(recovered.state).toBe('done')
    expect(recovered.result).toBe('verified synthetic output')
    expect(session.audit()).toEqual(empty)
  })

  it('discards an executor rejection after reset without exposing failure details', async () => {
    const session = new FileSession()
    let rejectLate!: (reason: Error) => void
    const stale = session.jobs.track(runJob('synthetic-rejected-after-reset', 1, async () =>
      new Promise<string>((_resolve, reject) => { rejectLate = reject })
    ))
    await Promise.resolve()
    expect(session.audit().activeJobs).toBe(1)
    session.resetSession()
    rejectLate(new Error('synthetic private late rejection'))
    await stale.completion
    expect(stale.state).toBe('cancelled')
    expect(stale.result).toBeUndefined()
    expect(stale.error).toBeUndefined()
    expect(session.audit()).toEqual(empty)
  })


  it('isolates 100 late executor failures after reset and accepts a fresh job', async () => {
    const session = new FileSession()
    const rejectors: Array<(reason: Error) => void> = []
    const staleJobs = Array.from({ length: 100 }, (_, index) =>
      session.jobs.track(runJob('synthetic-late-failure', index, async () =>
        new Promise<string>((_resolve, reject) => {
          rejectors.push(reject)
        }),
      )),
    )
    await Promise.resolve()
    expect(rejectors).toHaveLength(100)
    expect(session.audit().activeJobs).toBe(100)
    session.resetSession()
    expect(session.audit()).toEqual(empty)
    for (const reject of rejectors) reject(new Error('synthetic confidential rejection'))
    await Promise.all(staleJobs.map(job => job.completion))
    for (const job of staleJobs) {
      expect(job.state).toBe('cancelled')
      expect(job.result).toBeUndefined()
      expect(job.error).toBeUndefined()
    }
    const fresh = session.jobs.track(runJob('synthetic-post-reset', 101, async () => 'safe-result'))
    await fresh.completion
    expect(fresh.state).toBe('done')
    expect(fresh.result).toBe('safe-result')
    expect(session.audit()).toEqual(empty)
  })
  it('repeats 100 clearFiles cancellation and fresh-job cycles without retaining private results', async () => {
    const session = new FileSession()
    for (let cycle = 0; cycle < 100; cycle++) {
      let release!: () => void
      const stale = session.jobs.track(runJob('synthetic-navigation-stale', cycle, async () => {
        await new Promise<void>(resolve => { release = resolve })
        return { privateDocumentMarker: `synthetic-private-${cycle}` }
      }))
      await Promise.resolve()
      expect(session.audit().activeJobs).toBe(1)
      session.clearFiles()
      expect(stale.state).toBe('cancelled')
      release()
      await stale.completion
      expect(stale.result).toBeUndefined()
      expect(stale.error).toBeUndefined()
      const fresh = session.jobs.track(runJob('synthetic-navigation-fresh', cycle, async () => cycle))
      await fresh.completion
      expect(fresh.state).toBe('done')
      expect(fresh.result).toBe(cycle)
      expect(session.audit()).toEqual(empty)
    }
  })


  it('revokes downloadable output URLs before a cancelled executor settles, across 100 cycles', async () => {
    const created: string[] = []
    const revoked: string[] = []
    const originalCreate = URL.createObjectURL
    const originalRevoke = URL.revokeObjectURL
    try {
      URL.createObjectURL = (() => {
        const url = `blob:synthetic-cancel-${created.length + 1}`
        created.push(url)
        return url
      }) as typeof URL.createObjectURL
      URL.revokeObjectURL = (url: string) => { revoked.push(url) }

      const session = new FileSession()
      for (let cycle = 0; cycle < 100; cycle++) {
        const file = session.addFile(`private-${cycle}.pdf`, new Uint8Array([37, 80, 68, 70]), 'pdf')
        const output = session.addOutput(`result-${cycle}.pdf`, 'application/pdf', file.bytes)
        const downloadUrl = session.objectUrlFor(output.id)
        let release!: () => void
        const stale = session.jobs.track(runJob('synthetic-cancelled-output', cycle, async () => {
          await new Promise<void>(resolve => { release = resolve })
          return `private-late-${cycle}`
        }))
        await Promise.resolve()
        expect(session.audit()).toEqual({ files: 1, outputs: 1, objectUrls: 1, activeJobs: 1 })
        if (cycle % 2 === 0) session.clearFiles()
        else session.resetSession()
        expect(revoked).toContain(downloadUrl)
        expect(session.audit()).toEqual(empty)
        release()
        await stale.completion
        expect(stale.state).toBe('cancelled')
        expect(stale.result).toBeUndefined()
        expect(stale.error).toBeUndefined()
        expect(session.getOutput(output.id)).toBeUndefined()
        expect(session.audit()).toEqual(empty)
      }
      expect(created).toHaveLength(100)
      expect(revoked).toHaveLength(100)
      expect(new Set(revoked)).toEqual(new Set(created))
    } finally {
      URL.createObjectURL = originalCreate
      URL.revokeObjectURL = originalRevoke
    }
  })

})
