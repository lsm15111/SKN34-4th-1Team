import { useEffect, useState } from 'react'
import { estimateAiCostUsd, type AdminAiModelPrice } from '@govbiz/shared/domain/entities/AdminAiCost'
import { appContainer } from '../../../app/appContainer'
import type { EvaluationRun, RunBudget } from '../../../data/ops/opsApi'

/** 운영 화면의 시각은 브라우저 시간대와 관계없이 서울 시간으로 보입니다. 화면마다 시간대가 달라 보이지 않게 하기 위해서입니다. */
export const seoulDateTime = (value: string | null | undefined, fallback = '—') =>
  value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : fallback

export type ModelPrices = { status: 'loading' } | { status: 'ready'; prices: AdminAiModelPrice[] } | { status: 'unavailable' }

// 가격표는 자주 바뀌지 않으므로 한 화면 세션에서 한 번만 읽습니다. 실패하면 다음 화면에서 다시 읽습니다.
let pricesRequest: Promise<AdminAiModelPrice[]> | null = null

/**
 * Core 가격표(실사용 모니터링과 같은 표)를 읽습니다. 금액을 계산할 일이 있을 때(`enabled`)만 읽고,
 * 실패해도 화면은 그대로 두고 금액만 표시하지 않습니다.
 */
export function useAiModelPrices(enabled = true): ModelPrices {
  const [state, setState] = useState<ModelPrices>({ status: 'loading' })
  useEffect(() => {
    if (!enabled) return
    let active = true
    pricesRequest ??= appContainer.resolve('getAdminAiModelPricesUseCase').execute()
    pricesRequest.then((prices) => { if (active) setState({ status: 'ready', prices }) })
      .catch(() => { pricesRequest = null; if (active) setState({ status: 'unavailable' }) })
    return () => { active = false }
  }, [enabled])
  return state
}

/** 테스트에서 가격표 조회를 다시 시작합니다. */
export function resetAiModelPricesForTest() { pricesRequest = null }

export type RunCostEstimate = { usd: number; priced: number; unpriced: number; unknown: number }

/**
 * 평가 실행이 정산한 호출별 토큰에 Core 가격표(기본 처리 등급)를 곱한 추정 비용입니다. 평가 실행기는 처리 등급을 지정하지 않고
 * 캐시 토큰을 기록하지 않으므로 캐시 할인은 반영하지 않습니다. 사용량을 모르는 호출과 가격이 없는 호출은 0원으로 더하지 않고 따로 셉니다.
 */
export function estimateRunCost(calls: RunBudget['calls'], config: EvaluationRun['live_config'], prices: readonly AdminAiModelPrice[]): RunCostEstimate {
  const result: RunCostEstimate = { usd: 0, priced: 0, unpriced: 0, unknown: 0 }
  for (const call of calls) {
    if (call.input_tokens === null || call.output_tokens === null) { result.unknown += 1; continue }
    const embedding = call.operation_id?.startsWith('document_embedding:') || call.operation_id?.startsWith('query_embedding:')
    const model = embedding ? config?.embedding_model : config?.model
    const on = new Date(call.settled_at ?? call.authorized_at).toISOString().slice(0, 10)
    const usd = model ? estimateAiCostUsd(prices, { model, inputTokens: call.input_tokens, outputTokens: call.output_tokens, on }) : null
    if (usd === null) result.unpriced += 1
    else { result.usd += usd; result.priced += 1 }
  }
  return result
}
