import { describe, expect, it } from 'vitest'
import { type GettingStartedGuide, gettingStartedProgress, gettingStartedStepLabels, nextGettingStartedStep } from './GettingStarted'

const business: GettingStartedGuide = {
  visible: true,
  closed: false,
  completedAt: null,
  steps: [
    { id: 'SIGN_UP', status: 'DONE' },
    { id: 'COMPANY', status: 'TODO' },
    { id: 'SAVE_PROGRAM', status: 'DONE' },
    { id: 'DEADLINE_REMINDER', status: 'TODO' },
    { id: 'DAILY_REPORT', status: 'LOCKED' },
    { id: 'START_PREPARATION', status: 'TODO' },
  ],
}

describe('GettingStarted', () => {
  it('counts done steps against every shown step including locked ones', () => {
    expect(gettingStartedProgress(business)).toEqual({ done: 2, total: 6 })
    expect(gettingStartedProgress({ steps: [] })).toEqual({ done: 0, total: 0 })
  })

  it('picks the first step still to do and never a locked or finished one', () => {
    expect(nextGettingStartedStep(business)).toEqual({ id: 'COMPANY', status: 'TODO' })
    const lockedFirst: GettingStartedGuide = {
      ...business,
      steps: [{ id: 'SIGN_UP', status: 'DONE' }, { id: 'DAILY_REPORT', status: 'LOCKED' }, { id: 'START_PREPARATION', status: 'TODO' }],
    }
    expect(nextGettingStartedStep(lockedFirst)?.id).toBe('START_PREPARATION')
    expect(nextGettingStartedStep({ steps: [{ id: 'SIGN_UP', status: 'DONE' }, { id: 'DAILY_REPORT', status: 'LOCKED' }] })).toBeNull()
  })

  it('names every step with the same words the web and the app show', () => {
    expect(business.steps.map((step) => gettingStartedStepLabels[step.id])).toEqual([
      '회원가입', '기업 등록하기', '관심 공고 담기', '마감 알림 켜기', '맞춤 리포트 받기', '신청 준비 시작하기',
    ])
  })
})
