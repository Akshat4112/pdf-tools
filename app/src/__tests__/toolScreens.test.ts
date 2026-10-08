import { describe, expect, it } from 'vitest'
import { phaseFromJobState } from '../components/screenPhase'

describe('phaseFromJobState (PT-UX-003 screen switch)', () => {
  it('maps every job state to its screen', () => {
    expect(phaseFromJobState(null)).toBe('configure')
    expect(phaseFromJobState('queued')).toBe('processing')
    expect(phaseFromJobState('running')).toBe('processing')
    expect(phaseFromJobState('done')).toBe('result')
    expect(phaseFromJobState('failed')).toBe('failed')
    expect(phaseFromJobState('cancelled')).toBe('cancelled')
  })
})
