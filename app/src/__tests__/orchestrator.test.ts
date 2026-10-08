import { describe, expect, it } from 'vitest'
import { CancelledError, JobSession, runJob, runPageWise } from '../jobs/orchestrator'
import { toolError } from '../registry'

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms))

describe('job orchestrator (PT-FND-003)', () => {
  it('runs a job to completion with progress and result', async () => {
    const progressEvents: number[] = []
    const job = runJob('merge', [1, 2, 3], async (items, ctx) => {
      return runPageWise(items, async (n) => {
        await tick(2)
        return n * 2
      }, ctx, { label: (i) => `item ${i + 1}` })
    }, { onProgress: (p) => progressEvents.push(p.fraction) })

    await job.completion
    expect(job.state).toBe('done')
    expect(job.result).toEqual([2, 4, 6])
    expect(job.error).toBeUndefined()
    // deterministic progress: starts at 0, monotonic, ends at 1
    expect(progressEvents[0]).toBe(0)
    expect(progressEvents[progressEvents.length - 1]).toBe(1)
    const monotonic = progressEvents.every((v, i) => i === 0 || v >= progressEvents[i - 1])
    expect(monotonic).toBe(true)
  })

  it('maps taxonomy errors through; non-taxonomy errors become E-PROC-01', async () => {
    const j1 = runJob('t', null, async () => {
      throw toolError('E-INPUT-02', 'encrypted', 'explain-encryption')
    })
    await j1.completion
    expect(j1.state).toBe('failed')
    expect(j1.error?.code).toBe('E-INPUT-02')

    const j2 = runJob('t', null, async () => {
      throw new Error('random engine crash')
    })
    await j2.completion
    expect(j2.state).toBe('failed')
    expect(j2.error?.code).toBe('E-PROC-01')
  })

  it('null/undefined results are E-OUT-01, never presented as success', async () => {
    const j = runJob('t', null, async () => undefined)
    await j.completion
    expect(j.state).toBe('failed')
    expect(j.error?.code).toBe('E-OUT-01')
    expect(j.result).toBeUndefined()
  })

  it('cancel() immediately moves a running job to cancelled and discards late results', async () => {
    let executorFinished = false
    const job = runJob('t', null, async () => {
      await tick(60)
      executorFinished = true
      return { value: 'late-result' }
    })
    await tick(5)
    expect(job.state).toBe('running')
    job.cancel()
    expect(job.state).toBe('cancelled')
    await job.completion
    // executor may still have finished, but its result must NOT be surfaced
    expect(job.result).toBeUndefined()
    expect(executorFinished).toBe(true)
  })

  it('cooperative cancellation via ctx.isCancelled throws CancelledError -> cancelled state', async () => {
    const job = runJob('t', [1, 2, 3], async (items, ctx) => {
      return runPageWise(items, async (n) => {
        await tick(20)
        return n
      }, ctx)
    })
    await tick(25) // first item in flight
    job.cancel()
    await job.completion
    expect(job.state).toBe('cancelled')
    expect(job.result).toBeUndefined()
  })

  it('timeout soft-cap cancels a hung job (small timeoutMs)', async () => {
    const job = runJob('t', null, async (_i, ctx) => {
      await tick(150) // longer than timeout
      if (ctx.isCancelled()) throw new CancelledError()
      return 1
    }, { timeoutMs: 30 })
    await job.completion
    expect(job.state).toBe('cancelled')
    expect(job.result).toBeUndefined()
  })

  it('rejects out-of-range progress with E-PROC-01', async () => {
    const j = runJob('t', null, async (_i, ctx) => {
      ctx.reportProgress(1.5)
      return 1
    })
    await j.completion
    expect(j.state).toBe('failed')
    expect(j.error?.code).toBe('E-PROC-01')
  })

  it('cancel on a done job is a no-op', async () => {
    const j = runJob('t', null, async () => 42)
    await j.completion
    j.cancel()
    expect(j.state).toBe('done')
    expect(j.result).toBe(42)
  })
})

describe('JobSession (PT-PD-003 §5 reset semantics)', () => {
  it('tracks jobs and cancelAll cancels every live one', async () => {
    const session = new JobSession()
    const jobs = [
      session.track(runJob('a', null, () => tick(80).then(() => 'a'))),
      session.track(runJob('b', null, () => tick(80).then(() => 'b'))),
    ]
    await tick(5)
    expect(session.activeCount).toBe(2)
    session.cancelAll()
    expect(session.activeCount).toBe(0)
    await Promise.all(jobs.map((j) => j.completion))
    for (const j of jobs) {
      expect(j.state).toBe('cancelled')
      expect(j.result).toBeUndefined()
    }
  })

  it('completed jobs leave the session (no unbounded growth)', async () => {
    const session = new JobSession()
    const j = session.track(runJob('a', null, async () => 1))
    await j.completion
    await tick(5)
    expect(session.activeCount).toBe(0)
    expect(j.state).toBe('done')
  })
})
