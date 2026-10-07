import { describe, expect, it } from 'vitest'
import { gettingStartedSchema } from './GettingStartedDto'

describe('GettingStartedDto', () => {
  it('keeps known steps in server order and skips a step or status this client does not know yet', () => {
    const parsed = gettingStartedSchema.parse({
      visible: true,
      closed: false,
      completedAt: null,
      steps: [
        { id: 'SIGN_UP', status: 'DONE' },
        { id: 'PARTNER_PROFILE', status: 'TODO' },
        { id: 'COMPANY', status: 'TODO' },
        { id: 'DAILY_REPORT', status: 'SKIPPED' },
        { id: 'DAILY_REPORT', status: 'LOCKED' },
        'not-a-step',
      ],
      unknownField: 'ignored',
    })
    expect(parsed).toEqual({
      visible: true,
      closed: false,
      completedAt: null,
      steps: [{ id: 'SIGN_UP', status: 'DONE' }, { id: 'COMPANY', status: 'TODO' }, { id: 'DAILY_REPORT', status: 'LOCKED' }],
    })
  })

  it('reads the Seoul completion time and rejects responses that break the contract', () => {
    expect(gettingStartedSchema.parse({ visible: false, closed: true, completedAt: '2026-10-08T20:30:00+09:00', steps: [] }).completedAt)
      .toBe('2026-10-08T20:30:00+09:00')
    expect(gettingStartedSchema.parse({ visible: true, closed: false, completedAt: '2026-10-08T20:30:00.123456+09:00', steps: [] }).completedAt)
      .toBe('2026-10-08T20:30:00.123456+09:00')
    for (const broken of [
      { visible: 'yes', closed: false, completedAt: null, steps: [] },
      { visible: true, closed: false, completedAt: '2026-10-08 20:30', steps: [] },
      { visible: true, closed: false, completedAt: null },
      { visible: true, completedAt: null, steps: [] },
      null,
    ]) {
      expect(gettingStartedSchema.safeParse(broken).success).toBe(false)
    }
  })
})
