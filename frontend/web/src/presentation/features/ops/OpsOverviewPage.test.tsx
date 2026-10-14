// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appContainer } from '../../../app/appContainer'
import type { EvaluationRun } from '../../../data/ops/opsApi'
import type { AdminAiCostSummary } from '../../../domain/entities/AdminAiCost'
import { OpsOverviewPage } from './OpsOverviewPage'
import { attentionItems, recentCostPeriod, staleRuns } from './opsOverview'

const now = Date.parse('2026-10-14T12:00:00Z')
const run = (patch: Partial<EvaluationRun> = {}) => ({
  evaluation_scope: 'fixed-answer-context-only', execution_mode: 'replay', live_config: null, trace_links: [],
  candidate_capture_id: 'capture', reference_capture_id: 'capture', candidate_label: '저장 캡처', reference_label: '저장 캡처', comparison: null,
  id: '10000000-0000-4000-8000-000000000001', dataset_id: 'dataset', dataset_label: '지원 대상 근거 답변 · 저장된 가상 평가 6건',
  requested_by: 'operator@example.com', requested_by_id: 'core:99', can_retry: false,
  status: 'COMPLETED', status_label: '완료', created_at: '2026-10-14T11:00:00Z', started_at: null, finished_at: null,
  synced_at: '2026-10-14T11:01:00Z', error_code: '', error_message: '',
  summary: {}, model_api_calls: 0, evaluation_run_id: null, prefect_flow_run_id: null, prefect_url: null, langfuse_url: null, report_url: null,
  ...patch,
}) as EvaluationRun
const stuck = run({ id: '10000000-0000-4000-8000-000000000002', status: 'CANCELLING', status_label: '취소 요청 중', created_at: '2026-10-01T08:00:00Z', synced_at: null, sync_attempted_at: null })
const totals = { calls: 12, inputTokens: 1000, cachedInputTokens: 0, cacheWriteInputTokens: null, cacheWrite12hInputTokens: null, outputTokens: 100, estimatedUsd: '0.081897', unpricedCalls: 0, incompleteUsageCalls: 3 }
const cost: AdminAiCostSummary = {
  from: '2026-10-08', to: '2026-10-14', totals, actualUsd: '0.361172', actualConfigured: true, actualFetchedAt: null, krwPerUsd: null, comparison: null,
  byFeature: [{ key: 'AI_SEARCH', totals: { ...totals, estimatedUsd: '0.160908' } }, { key: null, totals: { ...totals, estimatedUsd: '0.022929' } }],
  byModel: [], days: [], topAccounts: [],
}
const amounts = (calls: number) => ({ calls, input_tokens: 186_697, output_tokens: 11_445 })
const budget = (remainingCalls: number | null) => ({
  as_of: '2026-10-14T12:00:00Z', state: remainingCalls === null ? 'unconfigured' : 'consistent',
  limits: remainingCalls === null ? null : { calls: 56, input_tokens: 240_821, output_tokens: 14_370 },
  allocated: remainingCalls === null ? null : { calls: 56 - remainingCalls, input_tokens: 54_124, output_tokens: 2_925 },
  remaining: remainingCalls === null ? null : amounts(remainingCalls),
  breakdown: null, reservation_count: 0, legacy_live_run_count: 0, change_count: 0, recent_changes: [],
})
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const ready = <T,>(value: T) => ({ state: 'ready' as const, value })
const session = { user: { id: 'core:99', username: 'operator@example.com' }, csrf_token: 'csrf', live_enabled: false, rag_live_enabled: false, search_traces_url: null }

function setup({ runs = [run(), stuck], remainingCalls = 0 as number | null, traces = 503, summary = cost } = {}) {
  const fetch = vi.fn(async (path: string, _options?: RequestInit) => {
    if (path === '/api/v1/ops/evaluations?page=1') return json({ count: 36, next: null, previous: null, results: runs })
    if (path === '/api/v1/ops/budget') return json(budget(remainingCalls))
    if (path === '/api/v1/ops/schedules/settings') return json({ enabled: false, revision: 0, source: 'environment', live_enabled: false, rag_live_enabled: false, changes: [] })
    if (path.startsWith('/api/v1/ops/traces')) return traces === 200 ? json({ results: [], next_cursor: null, from_time: '2026-10-07T12:00:00Z', to_time: '2026-10-14T12:00:00Z' }) : json({ code: 'LANGFUSE_TRACES_UNAVAILABLE' }, traces)
    if (path === '/api/v1/ops/runtime') return json({
      scope: 'deployment_configuration', storage_transport: 'http', status: 'FAIL',
      checks: { evidence: 'PASS', results_directory: 'PASS', prefect_deployment: 'FAIL', result_artifact: 'NOT_CHECKED' },
      evaluation_executed: false, runner_liveness_verified: false, shared_volume_identity_verified: false, result_artifact_verified: false,
    }, 503)
    throw new Error(`Unexpected path ${path}`)
  })
  vi.stubGlobal('fetch', fetch)
  const execute = vi.spyOn(appContainer.resolve('getAdminAiCostSummaryUseCase'), 'execute').mockResolvedValue(summary)
  render(<MemoryRouter><OpsOverviewPage session={session} onExpired={vi.fn()} now={() => now} /></MemoryRouter>)
  return { fetch, execute }
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('운영 요약 계산', () => {
  it('진행 중으로 남았지만 한 시간 넘게 확인하지 못한 평가만 멈춘 것으로 본다', () => {
    const fresh = run({ status: 'RUNNING', synced_at: '2026-10-14T11:50:00Z' })
    expect(staleRuns([run(), fresh, stuck], now).map((item) => item.id)).toEqual([stuck.id])
    expect(staleRuns([run({ status: 'QUEUED', status_stale: true, synced_at: '2026-10-14T11:59:00Z' })], now)).toHaveLength(1)
  })

  it('최근 비용은 UTC 오늘을 끝으로 한 7일이다', () => {
    expect(recentCostPeriod(now)).toEqual({ from: '2026-10-08', to: '2026-10-14' })
  })

  it('멈춘 평가·호출 한도·추적 연결·사용량 미확인을 먼저 확인할 일로 고른다', () => {
    const items = attentionItems({
      runs: ready({ count: 2, next: null, previous: null, results: [run(), stuck] }),
      budget: ready(budget(0) as never), traces: { state: 'failed', message: '연결 안 됨' }, cost: ready(cost), now,
    })
    expect(items.map((item) => item.key)).toEqual(['stale', 'budget-calls', 'traces', 'usage'])
    expect(items[0]).toMatchObject({ title: '평가 1건이 접수 뒤 13일째 끝나지 않았어요', to: `/ops/evaluations/${stuck.id}` })
    expect(attentionItems({ runs: ready({ count: 0, next: null, previous: null, results: [] }), budget: ready(budget(null) as never), traces: ready(true as const), cost: ready({ ...cost, totals: { ...totals, incompleteUsageCalls: 0 } }), now })
      .map((item) => item.key)).toEqual(['budget-unset'])
  })
})

describe('운영 요약 화면', () => {
  it('막힌 곳과 카드·준비 상태를 조회만으로 보여 주고 연결 점검은 버튼으로만 한다', async () => {
    const { fetch, execute } = setup()
    const attention = await screen.findByRole('region', { name: '먼저 확인할 일' })
    expect(await within(attention).findByText('평가 1건이 접수 뒤 13일째 끝나지 않았어요')).toBeTruthy()
    expect(within(attention).getByText(/아직 한 번도 상태를 확인하지 못했어요/)).toBeTruthy()
    expect(within(attention).getByText('누적 호출 한도를 다 썼어요')).toBeTruthy()
    expect(within(attention).getByText('AI 실행 추적 서버에 연결하지 못했어요')).toBeTruthy()
    expect(within(attention).getByRole('link', { name: '멈춘 평가 보기' }).getAttribute('href')).toBe(`/ops/evaluations/${stuck.id}`)
    expect(execute).toHaveBeenCalledWith('2026-10-08', '2026-10-14', expect.any(AbortSignal))

    const costCard = screen.getByRole('region', { name: 'AI 비용 · 최근 7일' })
    expect(within(costCard).getByText('$0.361172')).toBeTruthy()
    expect(within(costCard).getByText('AI 대화 검색')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '평가 예산' })).getByText('0회')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '정기 실행' })).getByText('꺼짐')).toBeTruthy()

    const readiness = screen.getByRole('region', { name: '평가 준비 상태' })
    expect(within(readiness).getByText('차단')).toBeTruthy()
    expect(within(readiness).getByText('연결 안 됨')).toBeTruthy()
    expect(fetch.mock.calls.some(([path]) => path === '/api/v1/ops/runtime')).toBe(false)
    fireEvent.click(within(readiness).getByRole('button', { name: '연결 점검' }))
    expect(await within(readiness).findByText('문제 있음')).toBeTruthy()
    expect(within(readiness).getByText(/Prefect 등록 문제/)).toBeTruthy()
    expect(fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true)
  })

  it('막힌 곳이 없으면 그렇게 알린다', async () => {
    setup({ runs: [run()], remainingCalls: 10, traces: 200, summary: { ...cost, totals: { ...totals, incompleteUsageCalls: 0 } } })
    expect(await screen.findByText('지금 막힌 곳이 없어요.')).toBeTruthy()
  })
})
