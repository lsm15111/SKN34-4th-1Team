import { useEffect, useRef, useState } from 'react'
import { formatEstimatedAiCostUsd } from '@govbiz/shared/domain/entities/AdminAiCost'
import { getRunBudget, OpsApiError, type EvaluationRun, type RunBudget } from '../../../data/ops/opsApi'
import { estimateRunCost, useAiModelPrices } from './opsFormat'

/** 실행 요약의 추정 비용 한 칸입니다. 토큰 예산 장부는 그대로 두고, 같은 사용량을 금액으로만 바꿔 보입니다. */
export function RunCostEstimate({ run, refreshKey, onExpired }: { run: EvaluationRun; refreshKey: number; onExpired: () => void }) {
  const prices = useAiModelPrices(run.execution_mode === 'live')
  const [budget, setBudget] = useState<RunBudget | null>(null)
  const [failed, setFailed] = useState(false)
  const expiry = useRef(onExpired); expiry.current = onExpired
  const paid = run.execution_mode === 'live'
  useEffect(() => {
    if (!paid) return
    const controller = new AbortController()
    setFailed(false)
    getRunBudget(run.id, controller.signal).then((value) => { if (!controller.signal.aborted) setBudget(value) }).catch((reason) => {
      if (controller.signal.aborted) return
      if (reason instanceof OpsApiError && [401, 403].includes(reason.status)) expiry.current()
      else setFailed(true)
    })
    return () => controller.abort()
  }, [run.id, paid, refreshKey, run.status])
  let value = '계산 중'
  let note = ''
  if (!paid) { value = '$0'; note = '새 모델 호출이 없는 실행입니다.' }
  else if (failed) { value = '확인 불가'; note = '예산 장부를 읽지 못했습니다.' }
  else if (prices.status === 'unavailable') { value = '확인 불가'; note = '가격표를 읽지 못해 금액을 표시하지 않습니다.' }
  else if (budget && budget.state !== 'recorded') { value = '확인 불가'; note = '예약 기록이 없는 실행이라 금액을 계산하지 않습니다.' }
  else if (budget && prices.status === 'ready') {
    const estimate = estimateRunCost(budget.calls, run.live_config, prices.prices)
    value = estimate.priced ? formatEstimatedAiCostUsd(estimate.usd) : estimate.unpriced ? '가격 미등록' : '$0'
    note = [
      `정산 호출 ${estimate.priced}건 · Core 가격표 기본 등급 · 캐시 할인 미반영`,
      estimate.unpriced ? `가격 미등록 ${estimate.unpriced}건 제외` : '',
      estimate.unknown ? `사용량 미확인 ${estimate.unknown}건 제외` : '',
    ].filter(Boolean).join(' · ')
  }
  return <div className="rounded-xl bg-[#f3f7f5] p-4" aria-label="추정 비용">
    <p className="text-xs text-ink-muted">추정 비용</p>
    <strong className="mt-3 block text-2xl whitespace-nowrap">{value}</strong>
    {note && <p className="mt-2 text-xs leading-5 text-ink-muted">{note}</p>}
  </div>
}
