import { z } from 'zod'
import { PlanQuotaExceededError, QuotaUnavailableError } from '../../domain/errors/PlanQuotaError'

export const planCodeSchema = z.enum(['FREE', 'PLUS', 'PREMIUM'])
export const planUsageFeatureSchema = z.enum([
  'AI_SEARCH', 'EVIDENCE_QUESTION', 'APPLICATION_DRAFT', 'COMBINATION_REVIEW', 'SAVED_PROGRAM', 'PARTNER_RECRUITMENT', 'PARTNER_PROPOSAL',
])
export const planUsagePeriodSchema = z.enum(['DAY', 'MONTH', 'TOTAL'])
/** Core는 서울 시각(+09:00)의 다음 초기화 시각을 보냅니다. 다시 채워지지 않는 개수 한도(TOTAL)는 null입니다. */
const resetsAtSchema = z.iso.datetime({ offset: true })

/** 기간 한도는 초기화 시각이 있고 개수 한도는 없습니다. 둘이 어긋난 줄은 믿을 수 없어 버립니다. */
const resetMatchesPeriod = (item: { period: string; resetsAt: string | null }) => (item.period === 'TOTAL') === (item.resetsAt === null)

export const planUsageItemSchema = z.object({
  feature: planUsageFeatureSchema,
  period: planUsagePeriodSchema,
  limit: z.number().int().min(0),
  used: z.number().int().min(0),
  resetsAt: resetsAtSchema.nullable(),
}).refine(resetMatchesPeriod)

/** 현재 요금제와 기능별 사용량입니다. 앱이 서버보다 늦게 갱신돼도 모르는 기능 한 줄 때문에 전체를 버리지 않습니다. */
export const planUsageSchema = z.object({
  plan: planCodeSchema.nullable(),
  items: z.array(z.unknown()).max(16).transform((items) => items.flatMap((item) => {
    const parsed = planUsageItemSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })),
})

/**
 * 요금제 한도를 다 쓴 429 문제 응답입니다. 분당 요청 제한(SUPPORT_PROGRAM_RATE_LIMITED)과 다른 계약입니다.
 * 개수 한도(관심 공고·모집 중인 모집글)는 기다려도 다시 채워지지 않아 resetsAt을 보내지 않습니다.
 */
export const planQuotaExceededProblemSchema = z.object({
  status: z.literal(429),
  code: z.literal('PLAN_QUOTA_EXCEEDED'),
  feature: planUsageFeatureSchema,
  period: planUsagePeriodSchema,
  plan: planCodeSchema.nullable(),
  limit: z.number().int().min(0),
  used: z.number().int().min(0),
  resetsAt: resetsAtSchema.nullish().transform((value) => value ?? null),
}).refine(resetMatchesPeriod)

/** 사용량을 확인할 수 없어 유료 기능을 실행하지 않은 503 문제 응답입니다. */
export const quotaUnavailableProblemSchema = z.object({
  status: z.literal(503),
  code: z.literal('QUOTA_UNAVAILABLE'),
})

/** 문제 응답 본문이 요금제 한도 계약(429 PLAN_QUOTA_EXCEEDED, 503 QUOTA_UNAVAILABLE)이면 오류로 바꾸고, 아니면 null입니다. */
export function readPlanQuotaProblem(status: number, body: unknown): PlanQuotaExceededError | QuotaUnavailableError | null {
  if (status === 429) {
    const parsed = planQuotaExceededProblemSchema.safeParse(body)
    if (!parsed.success) return null
    const { feature, period, plan, limit, resetsAt } = parsed.data
    return new PlanQuotaExceededError({ feature, period, plan, limit, resetsAt })
  }
  if (status === 503 && quotaUnavailableProblemSchema.safeParse(body).success) return new QuotaUnavailableError()
  return null
}
