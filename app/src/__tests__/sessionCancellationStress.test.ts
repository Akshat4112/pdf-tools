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
})
