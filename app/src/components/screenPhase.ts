import type { JobState } from '../jobs/orchestrator'

/** Job phase -> which panel to show (the tool screens' switch). */
export type ScreenPhase = 'configure' | 'preview' | 'processing' | 'result' | 'failed' | 'cancelled'

export function phaseFromJobState(state: JobState | null): ScreenPhase | 'configure' {
  switch (state) {
    case 'running':
    case 'queued':
      return 'processing'
    case 'done':
      return 'result'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'configure'
  }
}
