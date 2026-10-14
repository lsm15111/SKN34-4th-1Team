// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { AdminAiModelPrice } from '@govbiz/shared/domain/entities/AdminAiCost'
import { appContainer } from '../../../app/appContainer'
import type { EvaluationRun, RunBudget } from '../../../data/ops/opsApi'
import { resetAiModelPricesForTest } from './opsFormat'
import { RunCostEstimate } from './RunCostEstimate'

const id = '10000000-0000-4000-8000-000000000001'
const time = '2026-10-14T00:00:00Z'
const price = (id: number, modelPrefix: string, input: string, output: string): AdminAiModelPrice => ({
  id, modelPrefix, serviceTier: 'default', inputUsdPerMillion: input, cachedInputUsdPerMillion: null, cacheWriteInputUsdPerMillion: null,
  cacheWrite12hInputUsdPerMillion: null, outputUsdPerMillion: output, effectiveFrom: '2026-01-01', note: null,
})
const liveRun = { id, status: 'COMPLETED', execution_mode: 'live', live_config: { model: 'gpt-6-luna', embedding_model: 'text-embedding-3-small', max_model_calls: 3, max_output_tokens: 2000 } } as unknown as EvaluationRun
const breakdown = {
  settled_calls: 2, confirmed_input_tokens: 1500, confirmed_output_tokens: 200, unknown_calls: 1, unknown_output_tokens: 2000,
  unapproved_calls: 0, unapproved_output_tokens: 0, pending_release_output_tokens: 0, allocated_calls: 3, allocated_output_tokens: 6000,
}
const budget: RunBudget = {
  as_of: time, state: 'recorded',
  reservation: { run_id: id, dataset_id: '검토 자료', created_at: time, closed_at: null, max_calls: 3, max_output_tokens: 2000, breakdown },
  calls: [
    { sequence: 0, authorized_at: time, settled_at: time, operation_id: 'answer:E01', input_tokens: 1000, output_tokens: 200 },
    { sequence: 1, authorized_at: time, settled_at: time, operation_id: 'document_embedding:E01', input_tokens: 500, output_tokens: 0 },
    { sequence: 2, authorized_at: time, settled_at: null, operation_id: 'answer:E02', input_tokens: null, output_tokens: null },
  ],
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
let prices: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  resetAiModelPricesForTest()
  prices = vi.spyOn(appContainer.resolve('getAdminAiModelPricesUseCase'), 'execute')
    .mockResolvedValue([price(1, 'gpt-6-luna', '0.1', '0.5'), price(2, 'text-embedding-3-small', '0.02', '0')])
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const tile = () => within(screen.getByLabelText('추정 비용'))
function show(run: EvaluationRun, onExpired = vi.fn()) {
  render(<RunCostEstimate run={run} refreshKey={0} onExpired={onExpired} />)
  return onExpired
}

it('정산된 답변·임베딩 호출을 각 모델 가격으로 합산하고 사용량을 모르는 호출은 0원으로 더하지 않는다', async () => {
  const fetch = vi.fn().mockResolvedValue(json(budget))
  vi.stubGlobal('fetch', fetch)
  show(liveRun)
  expect(await tile().findByText('$0.00021')).toBeTruthy()
  expect(tile().getByText(/정산 호출 2건 · Core 가격표 기본 등급 · 캐시 할인 미반영 · 사용량 미확인 1건 제외/)).toBeTruthy()
  expect(fetch.mock.calls[0][0]).toBe(`/api/v1/ops/evaluations/${id}/budget`)
  expect(prices).toHaveBeenCalledOnce()
})

it('가격이 없는 모델은 금액 대신 가격 미등록으로 센다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...budget, calls: [budget.calls[0]] })))
  prices.mockResolvedValue([price(2, 'text-embedding-3-small', '0.02', '0')])
  show(liveRun)
  expect(await tile().findByText('가격 미등록')).toBeTruthy()
  expect(tile().getByText(/가격 미등록 1건 제외/)).toBeTruthy()
})

it('새 모델 호출이 없는 실행은 장부와 가격표를 읽지 않고 $0으로 표시한다', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  show({ ...liveRun, execution_mode: 'replay', live_config: null })
  expect(tile().getByText('$0')).toBeTruthy()
  expect(tile().getByText('새 모델 호출이 없는 실행입니다.')).toBeTruthy()
  expect(fetch).not.toHaveBeenCalled()
  expect(prices).not.toHaveBeenCalled()
})

it.each([
  ['가격표', '가격표를 읽지 못해 금액을 표시하지 않습니다.'],
  ['예산 장부', '예산 장부를 읽지 못했습니다.'],
  ['예약 기록', '예약 기록이 없는 실행이라 금액을 계산하지 않습니다.'],
])('%s를 확인할 수 없으면 금액을 추정하지 않는다', async (missing, note) => {
  if (missing === '가격표') prices.mockRejectedValue(new Error('denied'))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(missing === '예산 장부' ? json({ detail: 'unavailable' }, 503)
    : json(missing === '예약 기록' ? { as_of: time, state: 'missing', reservation: null, calls: [] } : budget)))
  show(liveRun)
  expect(await tile().findByText(note)).toBeTruthy()
  expect(tile().getByText('확인 불가')).toBeTruthy()
  expect(tile().queryByText(/\$/)).toBeNull()
})

it('세션이 만료되면 금액 대신 재로그인을 요청한다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ detail: 'expired' }, 401)))
  const expired = show(liveRun)
  await waitFor(() => expect(expired).toHaveBeenCalledOnce())
  expect(tile().queryByText(/\$/)).toBeNull()
})
