import type { BudgetSummary, EvaluationPage, EvaluationRun } from '../../../data/ops/opsApi'
import type { AdminAiCostSummary } from '../../../domain/entities/AdminAiCost'
import type { WorkspaceTagTone } from '../../shared/workspace/WorkspacePage.styles'

/** 운영 요약 화면의 계산입니다. 조회 결과에서 멈춘 평가와 먼저 확인할 일을 고릅니다. */
export type Loaded<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'failed'; message: string }
export type Attention = { key: string; tone: WorkspaceTagTone; title: string; detail: string; to: string; action: string }

export const activeStatuses: EvaluationRun['status'][] = ['REQUESTED', 'QUEUED', 'RUNNING', 'CANCELLING']
export const failedStatuses: EvaluationRun['status'][] = ['FAILED', 'CRASHED', 'RESULT_ERROR']
/** 진행 중인 평가를 이 시간 넘게 확인하지 못하면 실행기·Prefect가 멈춘 것으로 보고 알립니다. */
const staleAfterMs = 60 * 60 * 1000
export const costDays = 7
const dayMs = 86_400_000
export const loading = { state: 'loading' } as const
export const count = (value: number) => value.toLocaleString('ko-KR')

/** 몇 분·시간·일 지났는지 짧게 말합니다. */
function elapsed(from: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(from)) / 60_000))
  if (minutes < 60) return `${minutes}분`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간`
  return `${Math.floor(minutes / 60 / 24)}일`
}

/** 진행 중으로 남아 있지만 마지막 확인이 오래된 평가입니다. 한 번도 확인하지 못했으면 접수 시각부터 셉니다. */
export function staleRuns(runs: EvaluationRun[], now: number) {
  return runs.filter((run) => activeStatuses.includes(run.status)
    && (run.status_stale || now - Date.parse(run.sync_attempted_at ?? run.synced_at ?? run.created_at) > staleAfterMs))
}

/** UTC 오늘을 끝으로 하는 최근 7일입니다. 비용 화면과 같은 UTC 날짜를 씁니다. */
export function recentCostPeriod(now: number) {
  return { from: new Date(now - (costDays - 1) * dayMs).toISOString().slice(0, 10), to: new Date(now).toISOString().slice(0, 10) }
}

/** 조회한 내용에서 운영자가 먼저 손봐야 할 일을 고릅니다. 조회에 실패한 항목은 그 카드에서 따로 알립니다. */
export function attentionItems({ runs, budget, traces, cost, now }: {
  runs: Loaded<EvaluationPage>; budget: Loaded<BudgetSummary>; traces: Loaded<true>; cost: Loaded<AdminAiCostSummary>; now: number
}): Attention[] {
  const items: Attention[] = []
  if (runs.state === 'ready') {
    const stale = staleRuns(runs.value.results, now)
    // 가장 오래 남은 평가를 기준으로 접수 뒤 지난 기간을 말하고, 마지막 확인 시도는 설명에 따로 적습니다.
    const oldest = [...stale].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))[0]
    const lastTry = oldest?.sync_attempted_at ?? oldest?.synced_at
    if (oldest) items.push({
      key: 'stale', tone: 'danger', title: `평가 ${stale.length}건이 접수 뒤 ${elapsed(oldest.created_at, now)}째 끝나지 않았어요`,
      detail: `${lastTry ? `마지막 상태 확인 시도는 ${elapsed(lastTry, now)} 전이에요.` : '아직 한 번도 상태를 확인하지 못했어요.'} 평가 실행기나 Prefect가 꺼져 있으면 진행 중·취소 요청 중으로 남아요. 실행기를 확인한 뒤 상세에서 상태를 다시 확인하세요.`,
      to: `/ops/evaluations/${encodeURIComponent(oldest.id)}`, action: '멈춘 평가 보기',
    })
    const failed = runs.value.results.filter((run) => failedStatuses.includes(run.status) && now - Date.parse(run.created_at) < costDays * dayMs)
    if (failed.length) items.push({
      key: 'failed', tone: 'warn', title: `최근 7일 평가 ${failed.length}건이 실패했어요`,
      detail: '상세의 Prefect 로그에서 실패 단계를 보고, 이미 만든 응답이 있으면 후처리 복구로 다시 처리할 수 있어요.',
      to: '/ops/evaluations', action: '평가 이력 보기',
    })
  }
  if (budget.state === 'ready') {
    const { limits, remaining, daily } = budget.value
    if (budget.value.state === 'unconfigured' || !limits) items.push({
      key: 'budget-unset', tone: 'warn', title: '누적 평가 한도가 설정되지 않았어요',
      detail: '한도가 없으면 남은 예산을 계산할 수 없어 유료 평가와 정기 실행을 접수하지 못해요.', to: '/ops/budget', action: '예산 관리 열기',
    })
    else if (remaining && remaining.calls === 0) items.push({
      key: 'budget-calls', tone: 'danger', title: '누적 호출 한도를 다 썼어요',
      detail: '토큰이 남아 있어도 호출 한도가 0이면 새 유료 평가를 접수하지 못해요. 한도를 늘리려면 예산 관리에서 변경 사유와 함께 저장하세요.', to: '/ops/budget', action: '예산 관리 열기',
    })
    if (daily?.state === 'exceeded') items.push({
      key: 'budget-daily', tone: 'warn', title: '오늘 일별 평가 한도를 다 썼어요', detail: '서울 시간 자정에 다시 쓸 수 있어요.', to: '/ops/budget', action: '예산 관리 열기',
    })
  }
  if (traces.state === 'failed') items.push({
    key: 'traces', tone: 'warn', title: 'AI 실행 추적 서버에 연결하지 못했어요',
    detail: 'Langfuse가 꺼져 있거나 연결 설정이 없으면 요청별 단계·오류를 볼 수 없어요. 비용 집계는 그대로 볼 수 있어요.', to: '/ops/traces', action: 'AI 실행 추적 열기',
  })
  if (cost.state === 'ready' && cost.value.totals.incompleteUsageCalls > 0) items.push({
    key: 'usage', tone: 'info', title: `최근 7일 호출 ${count(cost.value.totals.incompleteUsageCalls)}회는 사용량을 받지 못했어요`,
    detail: '이 호출은 금액에서 빠져 기능별 비용이 실제보다 작게 보일 수 있어요. OpenAI 실제 비용과 함께 비교하세요.', to: '/ops/usage', action: '실사용 모니터링 열기',
  })
  return items
}
