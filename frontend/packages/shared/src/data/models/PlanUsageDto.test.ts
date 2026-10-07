import { describe, expect, it } from 'vitest'
import { PlanQuotaExceededError, QuotaUnavailableError } from '../../domain/errors/PlanQuotaError'
import { planUsageSchema, readPlanQuotaProblem } from './PlanUsageDto'

describe('PlanUsageDto', () => {
  it('keeps known features and skips a feature this client does not know yet', () => {
    const parsed = planUsageSchema.parse({
      plan: 'FREE',
      items: [
        { feature: 'AI_SEARCH', period: 'DAY', limit: 10, used: 3, resetsAt: '2026-10-09T00:00:00+09:00' },
        { feature: 'FUTURE_FEATURE', period: 'DAY', limit: 5, used: 0, resetsAt: '2026-10-09T00:00:00+09:00' },
      ],
    })
    expect(parsed.items.map((item) => item.feature)).toEqual(['AI_SEARCH'])
    expect(planUsageSchema.parse({ plan: null, items: [] }).plan).toBeNull()
    expect(planUsageSchema.safeParse({ plan: 'GOLD', items: [] }).success).toBe(false)
  })

  it('reads held-item limits without a reset time and skips rows whose reset does not match the period', () => {
    const parsed = planUsageSchema.parse({
      plan: 'FREE',
      items: [
        { feature: 'SAVED_PROGRAM', period: 'TOTAL', limit: 30, used: 12, resetsAt: null },
        { feature: 'PARTNER_RECRUITMENT', period: 'TOTAL', limit: 1, used: 1, resetsAt: null },
        { feature: 'PARTNER_PROPOSAL', period: 'MONTH', limit: 3, used: 2, resetsAt: '2026-11-01T00:00:00+09:00' },
        // 기간 한도인데 초기화 시각이 없거나, 개수 한도인데 초기화 시각이 있으면 버립니다.
        { feature: 'COMBINATION_REVIEW', period: 'MONTH', limit: 2, used: 0, resetsAt: null },
        { feature: 'SAVED_PROGRAM', period: 'TOTAL', limit: 30, used: 1, resetsAt: '2026-11-01T00:00:00+09:00' },
      ],
    })
    expect(parsed.items).toEqual([
      { feature: 'SAVED_PROGRAM', period: 'TOTAL', limit: 30, used: 12, resetsAt: null },
      { feature: 'PARTNER_RECRUITMENT', period: 'TOTAL', limit: 1, used: 1, resetsAt: null },
      { feature: 'PARTNER_PROPOSAL', period: 'MONTH', limit: 3, used: 2, resetsAt: '2026-11-01T00:00:00+09:00' },
    ])
  })

  it('turns only the plan quota problem contracts into errors', () => {
    const exceeded = readPlanQuotaProblem(429, {
      type: 'urn:govbiz:problem:plan-quota-exceeded', title: 'Plan Quota Exceeded', status: 429, detail: 'x', instance: '/api',
      code: 'PLAN_QUOTA_EXCEEDED', feature: 'EVIDENCE_QUESTION', period: 'DAY', plan: 'FREE', limit: 10, used: 10,
      resetsAt: '2026-10-09T00:00:00+09:00', retryAfterSeconds: 10800,
    })
    expect(exceeded).toBeInstanceOf(PlanQuotaExceededError)
    expect(exceeded?.message).toBe('오늘 공고 원문 질문 10회를 모두 썼어요. 자정(서울 시간)에 다시 채워져요.')
    expect(readPlanQuotaProblem(503, { status: 503, code: 'QUOTA_UNAVAILABLE' })).toBeInstanceOf(QuotaUnavailableError)
    // 개수 한도는 기다려도 다시 채워지지 않아 resetsAt 없이 옵니다.
    const held = readPlanQuotaProblem(429, {
      status: 429, code: 'PLAN_QUOTA_EXCEEDED', feature: 'SAVED_PROGRAM', period: 'TOTAL', plan: 'FREE', limit: 30, used: 30,
    })
    expect(held).toBeInstanceOf(PlanQuotaExceededError)
    expect((held as PlanQuotaExceededError).quota.resetsAt).toBeNull()
    expect(held?.message).toBe('관심 공고는 30개까지 담을 수 있어요. 담은 공고를 빼면 그만큼 새로 담을 수 있어요.')
    // 분당 요청 제한은 다른 계약이라 여기서 바꾸지 않습니다.
    expect(readPlanQuotaProblem(429, { status: 429, code: 'SUPPORT_PROGRAM_RATE_LIMITED', retryAfterSeconds: 5 })).toBeNull()
    expect(readPlanQuotaProblem(503, { status: 503, code: 'SUPPORT_PROGRAM_BUSY' })).toBeNull()
    expect(readPlanQuotaProblem(500, null)).toBeNull()
  })
})
