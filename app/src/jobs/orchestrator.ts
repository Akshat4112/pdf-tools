/**
 * Worker job orchestration — PT-FND-003.
 *
 * Owns the processing lifecycle between the UI and the engines:
 *   job created -> queued -> running (progress/cancel) -> done | failed | cancelled
 *
 * Contracts implemented (from the spec chain):
 * - PT-PD-002 §3 S5: deterministic progress (pages done / total) + cancel affordance.
 * - PT-PD-003 §5: a cancelled job discards all intermediates; no partial output is
 *   ever presented as success; a cancelled/failed job cannot expose another job's data.
 * - PT-PD-003 §8: jobs run in a dedicated Worker when the platform allows; bytes are
 *   transferred (not copied) where possible; worker terminates on session reset.
 * - PT-SP-002 §4: per-page progress events drive the progress bar; idle workers
 *   terminate after tool exit.
 * - PT-FND-002 registry: QUOTAS.jobTimeoutMs guards runaway jobs (soft cap, cancels).
 *
 * Platform note: in the Node test environment there is no Worker; the same
 * orchestration runs jobs on the main thread with an injected executor. The
 * browser uses a real module Worker. The public API is identical.
 */

import { QUOTAS, toolError, type ToolError } from '../registry'

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export interface JobProgress {
  /** 0..1 — deterministic fraction; pages done / total when page-wise */
  fraction: number
  /** human label like 'page 7 of 30' (may be empty) */
  detail?: string
}

export interface Job<TIn = unknown, TOut = unknown> {
  /** the input the job was created with (typed handle; never inspected) */
  readonly input?: TIn
  readonly id: number
  readonly kind: string
  readonly createdAt: number
  state: JobState
  progress: JobProgress
  result?: TOut
  error?: ToolError
  /** resolves on done|failed|cancelled — then inspect state/result/error */
  completion: Promise<void>
  cancel(): void
}

export interface JobEvents {
  onProgress?: (progress: JobProgress) => void
  onState?: (state: JobState) => void
}

/** Progress emitter given to executors; executors MUST call it deterministically. */
export interface JobContext {
  reportProgress(fraction: number, detail?: string): void
  isCancelled(): boolean
}

export type JobExecutor<TIn, TOut> = (input: TIn, ctx: JobContext) => Promise<TOut>

let nextJobId = 1

/**
 * Orchestrate a single job. The executor receives a cancellation-aware context.
 * Cancellation is cooperative-but-guaranteed: after cancel(), the job's
 * completion resolves in 'cancelled' state even if the executor ignores the
 * token, and its result is discarded (never surfaced).
 */
export function runJob<TIn, TOut>(
  kind: string,
  input: TIn,
  executor: JobExecutor<TIn, TOut>,
  opts: JobEvents & { timeoutMs?: number } = {},
): Job<TIn, TOut> {
  const id = nextJobId++
  const createdAt = Date.now()
  const timeoutMs = opts.timeoutMs ?? QUOTAS.jobTimeoutMs

  let cancelled = false
  let settled = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const state = (s: JobState) => {
    job.state = s
    opts.onState?.(s)
  }
  const progress = (p: JobProgress) => {
    job.progress = p
    if (!cancelled) opts.onProgress?.(p)
  }

  const start = async () => {
    state('running')
    progress({ fraction: 0 })
    timer = setTimeout(() => {
      // soft time cap: cancel, do not leave a zombie job (PT-SP-002 quota)
      cancelled = true
    }, timeoutMs)

    const ctx: JobContext = {
      reportProgress(fraction, detail) {
        if (fraction < 0 || fraction > 1) {
          throw toolError('E-PROC-01', 'Internal progress error.', 'retry-job')
        }
        progress({ fraction, detail })
      },
      isCancelled: () => cancelled,
    }

    try {
      const result = await executor(input, ctx)
      if (cancelled) {
        // executor finished after cancel — discard the result entirely
        state('cancelled')
        return
      }
      // verify-before-success rule (PT-PD-002 S6/E-OUT-01): executor output
      // must be non-null; verification depth is the engine adapter's job.
      if (result === null || result === undefined) {
        throw toolError('E-OUT-01', 'The generated output did not pass verification.', 'retry-job')
      }
      job.result = result
      progress({ fraction: 1 })
      state('done')
    } catch (err) {
      if (cancelled) {
        state('cancelled')
        return
      }
      const e = err as ToolError
      job.error =
        typeof e?.code === 'string' && e.code.startsWith('E-')
          ? e
          : toolError('E-PROC-01', 'Processing stopped unexpectedly.', 'retry-job')
      state('failed')
    } finally {
      if (timer) clearTimeout(timer)
      settled = true
    }
  }

  let completionPromise: Promise<void> | null = null

  const job: Job<TIn, TOut> = {
    input,
    id,
    kind,
    createdAt,
    state: 'queued',
    progress: { fraction: 0 },
    // TDZ-safe auto-start: runJob kicks off on the next microtask, and any
    // early .completion access joins the same promise.
    get completion() {
      if (!completionPromise) completionPromise = start()
      return completionPromise
    },
    cancel() {
      if (job.state === 'done' || job.state === 'failed' || job.state === 'cancelled') return
      cancelled = true
      // resolve state immediately so UI can reset (PT-PD-003 §5);
      // a still-running executor's late result is discarded by completion().
      if (!settled) state('cancelled')
    },
  }
  // start on the next microtask — `job` (const) is initialized by then
  queueMicrotask(() => {
    if (!completionPromise) completionPromise = start()
  })
  return job
}

/**
 * Page-wise progress helper for executors: runs fn per item with deterministic
 * progress + cooperative cancellation checks between items.
 */
export async function runPageWise<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  ctx: JobContext,
  opts: { label?: (index: number) => string } = {},
): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i++) {
    if (ctx.isCancelled()) {
      throw new CancelledError()
    }
    out.push(await fn(items[i], i))
    ctx.reportProgress((i + 1) / items.length, opts.label?.(i))
  }
  return out
}

/** Internal control-flow signal — runJob converts it to the 'cancelled' state. */
export class CancelledError extends Error {
  constructor() {
    super('job cancelled')
    this.name = 'CancelledError'
  }
}

/**
 * Job registry for a session: the app holds one; PT-PD-003 §5 session reset
 * cancels everything and clears the list. Prevents cross-job leakage by
 * construction — jobs are only reachable through their own handles.
 */
export class JobSession {
  private jobs = new Set<Job<unknown, unknown>>()

  track<TIn, TOut>(job: Job<TIn, TOut>): Job<TIn, TOut> {
    this.jobs.add(job as Job<unknown, unknown>)
    void job.completion.then(() => this.jobs.delete(job as Job<unknown, unknown>))
    return job
  }

  /** Cancel all live jobs (session reset / Clear files). */
  cancelAll(): void {
    for (const j of this.jobs) j.cancel()
    this.jobs.clear()
  }

  get activeCount(): number {
    let n = 0
    for (const j of this.jobs) if (j.state === 'running' || j.state === 'queued') n++
    return n
  }
}
