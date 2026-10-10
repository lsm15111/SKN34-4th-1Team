import { planUsageFeatureLabels } from './PlanUsage'

/** AI 비용을 나눠 보는 기능입니다. null은 로그인 전 요청이나 시스템 작업(색인·조건 정리·공고 분석)입니다. */
export type AiUsageFeature =
  | 'AI_SEARCH'
  | 'EVIDENCE_QUESTION'
  | 'APPLICATION_DRAFT'
  | 'COMBINATION_REVIEW'
  | 'ASSISTANT'
  | 'DAILY_REPORT'
  | 'SAVED_PROGRAM_PREFETCH'
  | 'GOV_AGENT'

/** 응답의 처리 등급입니다. Fast 모드는 응답에서 priority로 옵니다. */
export type AiServiceTier = 'default' | 'priority' | 'flex'

/** 기간 합계입니다. 금액은 소수 6자리 USD 문자열이고, 가격표에 없는 호출(unpricedCalls)은 금액에 들어가지 않습니다. */
export type AiUsageTotals = {
  calls: number
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  estimatedUsd: string
  unpricedCalls: number
}

/**
 * 관리자 AI 비용 화면의 한 기간입니다. 추정은 서울 날짜, 실제는 OpenAI 하루(UTC) 기준입니다. actualUsd는 실제 비용을 한 번도
 * 가져오지 않았으면 null이고, actualConfigured는 서버에 OpenAI 조직 관리자 키가 있는지입니다. krwPerUsd는 운영자가 정한 환율입니다.
 */
export type AdminAiCostSummary = {
  from: string
  to: string
  totals: AiUsageTotals
  actualUsd: string | null
  actualConfigured: boolean
  actualFetchedAt: string | null
  krwPerUsd: string | null
  byFeature: { key: string | null; totals: AiUsageTotals }[]
  byModel: { key: string; serviceTier: string; totals: AiUsageTotals }[]
  days: { date: string; estimatedUsd: string; calls: number; actualUsd: string | null }[]
  topAccounts: { accountId: number; email: string; planCode: string | null; totals: AiUsageTotals }[]
}

/** 1M 토큰당 USD 가격입니다. 캐시 입력 가격이 없으면 입력 가격으로 계산합니다. */
export type AdminAiModelPrice = {
  id: number
  modelPrefix: string
  serviceTier: AiServiceTier
  inputUsdPerMillion: string
  cachedInputUsdPerMillion: string | null
  outputUsdPerMillion: string
  effectiveFrom: string
  note: string | null
}

export type NewAdminAiModelPrice = Omit<AdminAiModelPrice, 'id'>

/** 한 번에 보는 최대 기간(일)입니다. 서버와 같습니다. */
export const adminAiCostMaxDays = 92

export const aiUsageFeatureLabels: Record<AiUsageFeature, string> = {
  ...planUsageFeatureLabels,
  ASSISTANT: '도우미',
  DAILY_REPORT: '맞춤 리포트',
  SAVED_PROGRAM_PREFETCH: '관심 공고 준비',
  GOV_AGENT: 'Gov 에이전트',
}

export const aiServiceTierLabels: Record<AiServiceTier, string> = { default: '기본', priority: 'Fast(priority)', flex: 'Flex' }

/** 기능 키의 이름입니다. 모르는 값은 그대로, 없으면 시스템·기타입니다. */
export function aiUsageFeatureLabel(key: string | null): string {
  if (key === null) return '시스템·기타(색인·조건 정리·공고 분석)'
  return key in aiUsageFeatureLabels ? aiUsageFeatureLabels[key as AiUsageFeature] : key
}

/** `0.012346` → `$0.012346`, 환율이 있으면 `$0.012346 (약 17원)`입니다. */
export function formatAiCostUsd(usd: string, krwPerUsd: string | null = null): string {
  if (krwPerUsd === null) return `$${usd}`
  const won = Math.round(Number(usd) * Number(krwPerUsd))
  return `$${usd} (약 ${won.toLocaleString('ko-KR')}원)`
}

/** 서울 기준 이번 달 1일부터 오늘까지입니다. */
export function defaultAdminAiCostPeriod(now: number = Date.now()): { from: string; to: string } {
  const today = new Date(now + 9 * 3_600_000).toISOString().slice(0, 10)
  return { from: `${today.slice(0, 8)}01`, to: today }
}
