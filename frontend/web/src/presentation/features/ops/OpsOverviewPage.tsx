import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { appContainer } from '../../../app/appContainer'
import { getBudgetSummary, getScheduleRuntime, getScheduleSettings, listEvaluations, OpsApiError } from '../../../data/ops/opsApi'
import type { OpsSession, ScheduleRuntime, ScheduleSettings } from '../../../data/ops/opsApi'
import { listTraces } from '../../../data/ops/traceApi'
import { aiUsageFeatureLabel, formatAiCostUsd, type AdminAiCostSummary } from '../../../domain/entities/AdminAiCost'
import { workspacePageStyles as styles, workspaceTagClassName } from '../../shared/workspace/WorkspacePage.styles'
import { WorkspacePageHeader } from '../../shared/workspace/WorkspacePageHeader'
import { activeStatuses, attentionItems, costDays, count, failedStatuses, loading, recentCostPeriod, type Loaded } from './opsOverview'

const date = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })


/** 응답을 기다리는 동안과 실패했을 때의 한 줄입니다. 401·403은 로그인 화면으로 돌려보냅니다. */
function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, onExpired: () => void, revision: number): Loaded<T> {
  const [value, setValue] = useState<Loaded<T>>(loading)
  const loader = useRef(load); loader.current = load
  const expiry = useRef(onExpired); expiry.current = onExpired
  useEffect(() => {
    const controller = new AbortController()
    setValue(loading)
    loader.current(controller.signal).then((result) => { if (!controller.signal.aborted) setValue({ state: 'ready', value: result }) }).catch((reason) => {
      if (controller.signal.aborted) return
      if (reason instanceof OpsApiError && [401, 403].includes(reason.status)) { expiry.current(); return }
      setValue({ state: 'failed', message: reason instanceof Error ? reason.message : '조회하지 못했습니다.' })
    })
    return () => controller.abort()
  }, [revision])
  return value
}

function Card({ title, to, action, children }: { title: string; to: string; action: string; children: ReactNode }) {
  return <section className={`${styles.card} flex flex-col gap-3`} aria-label={title}>
    <h2 className={styles.cardTitle}>{title}</h2>
    <div className="flex-1 text-sm">{children}</div>
    <Link to={to} className={styles.mutedLink}>{action} →</Link>
  </section>
}

function Pending<T>({ loaded, children }: { loaded: Loaded<T>; children: (value: T) => ReactNode }) {
  if (loaded.state === 'loading') return <p role="status" className="text-ink-muted">불러오고 있어요.</p>
  if (loaded.state === 'failed') return <p role="alert" className="text-red-700">{loaded.message}</p>
  return <>{children(loaded.value)}</>
}

function CheckRow({ label, ok, value, note }: { label: string; ok: boolean | null; value: string; note: string }) {
  return <li className="flex flex-wrap items-start justify-between gap-2 py-3">
    <div className="min-w-0"><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-ink-muted">{note}</p></div>
    <span className={workspaceTagClassName(ok === null ? 'muted' : ok ? 'ok' : 'warn')}>{value}</span>
  </li>
}

/**
 * 운영 요약입니다. 비용·평가·예산·정기 실행과 평가 준비 상태를 한 화면에서 보고, 막힌 곳은 맨 위에 모아 해당 화면으로 보냅니다.
 * 조회만 하며 모델을 호출하거나 설정을 바꾸지 않습니다. 평가 실행 연결 점검은 Prefect 조회가 있어 버튼으로만 실행합니다.
 */
export function OpsOverviewPage({ session, onExpired, now = Date.now }: { session: OpsSession; onExpired: () => void; now?: () => number }) {
  const [revision, setRevision] = useState(0)
  const [checkedAt] = useState(now)
  const runs = useLoad((signal) => listEvaluations(1, signal), onExpired, revision)
  const budget = useLoad((signal) => getBudgetSummary(signal), onExpired, revision)
  const settings = useLoad<ScheduleSettings>((signal) => getScheduleSettings(signal), onExpired, revision)
  const traces = useLoad<true>((signal) => listTraces({}, signal).then(() => true as const), onExpired, revision)
  const cost = useLoad<AdminAiCostSummary>((signal) => {
    const { from, to } = recentCostPeriod(now())
    return appContainer.resolve('getAdminAiCostSummaryUseCase').execute(from, to, signal)
  }, onExpired, revision)
  const [runtime, setRuntime] = useState<Loaded<ScheduleRuntime> | null>(null)
  const checkRuntime = () => {
    setRuntime(loading)
    getScheduleRuntime().then((value) => setRuntime({ state: 'ready', value })).catch((reason) => {
      if (reason instanceof OpsApiError && [401, 403].includes(reason.status)) { onExpired(); return }
      setRuntime({ state: 'failed', message: reason instanceof Error ? reason.message : '연결을 점검하지 못했습니다.' })
    })
  }
  const items = attentionItems({ runs, budget, traces, cost, now: checkedAt })
  const loadingAny = [runs, budget, settings, traces, cost].some((value) => value.state === 'loading')

  return <>
    <WorkspacePageHeader title="운영 요약" actions={<button className={styles.secondaryButton} onClick={() => { setRevision((value) => value + 1); setRuntime(null) }}>다시 조회</button>} />
    <div className={styles.content}>
      <p className="text-sm text-ink-muted">막힌 곳과 최근 상태를 모았어요. 조회만 하며 모델을 호출하지 않아요.</p>
      <section className={styles.card} aria-label="먼저 확인할 일">
        <h2 className={styles.cardTitle}>먼저 확인할 일</h2>
        {items.length ? <ul className="divide-y divide-line">{items.map((item) => <li key={item.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 font-semibold"><span className={workspaceTagClassName(item.tone)}>{item.tone === 'danger' ? '막힘' : item.tone === 'warn' ? '확인 필요' : '참고'}</span>{item.title}</p><p className="mt-1 text-sm text-ink-muted">{item.detail}</p></div>
          <Link to={item.to} className={styles.secondaryButton}>{item.action}</Link>
        </li>)}</ul> : <p className="text-sm">{loadingAny ? '상태를 확인하고 있어요.' : '지금 막힌 곳이 없어요.'}</p>}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`AI 비용 · 최근 ${costDays}일`} to="/ops/usage" action="실사용 모니터링">
          <Pending loaded={cost}>{(value) => {
            const top = [...value.byFeature].sort((left, right) => Number(right.totals.estimatedUsd) - Number(left.totals.estimatedUsd))[0]
            return <>
              <p className="text-2xl font-bold">{formatAiCostUsd(value.actualUsd ?? value.totals.estimatedUsd)}</p>
              <p className="mt-1 text-ink-muted">{value.actualUsd === null ? '앱 기록 추정' : 'OpenAI 실제 비용'} · 호출 {count(value.totals.calls)}회 · {value.from}~{value.to} UTC</p>
              {top && Number(top.totals.estimatedUsd) > 0 && <p className="mt-2">가장 많이 쓴 기능: <b>{aiUsageFeatureLabel(top.key)}</b> {formatAiCostUsd(top.totals.estimatedUsd)}</p>}
            </>
          }}</Pending>
        </Card>
        <Card title="평가" to="/ops/evaluations" action="평가 이력">
          <Pending loaded={runs}>{(value) => {
            const latest = value.results[0]
            const done = value.results.filter((run) => run.status === 'COMPLETED').length
            const failed = value.results.filter((run) => failedStatuses.includes(run.status)).length
            const active = value.results.filter((run) => activeStatuses.includes(run.status)).length
            return latest ? <>
              <p className="font-semibold">{latest.dataset_label}</p>
              <p className="mt-1 text-ink-muted">최근 실행 {date(latest.created_at)} · {latest.status_label}</p>
              <p className="mt-2">최근 {value.results.length}건 중 완료 {done} · 실패 {failed} · 진행 중 {active} · 전체 {count(value.count)}건</p>
            </> : <p>아직 평가 실행이 없어요. 새 평가에서 무료 재평가부터 해 보세요.</p>
          }}</Pending>
        </Card>
        <Card title="평가 예산" to="/ops/budget" action="예산 관리">
          <Pending loaded={budget}>{(value) => value.limits && value.remaining ? <>
            <p>남은 호출 <b>{count(value.remaining.calls)}회</b> / {count(value.limits.calls)}회</p>
            <p className="mt-1">남은 출력 토큰 {count(value.remaining.output_tokens)} / {count(value.limits.output_tokens)}</p>
            {value.remaining.input_tokens != null && value.limits.input_tokens != null && <p className="mt-1">남은 입력 토큰 {count(value.remaining.input_tokens)} / {count(value.limits.input_tokens)}</p>}
            <p className="mt-2 text-ink-muted">일별 한도 {value.daily?.state === 'enforced' ? '적용 중' : value.daily?.state === 'exceeded' ? '오늘 다 씀' : '미적용'} · 금액이 아니라 호출·토큰 한도예요</p>
          </> : <p>누적 한도가 설정되지 않았어요.</p>}</Pending>
        </Card>
        <Card title="정기 실행" to="/ops/schedules" action="정기 실행">
          <Pending loaded={settings}>{(value) => <>
            <p>정기 접수 <b>{value.enabled ? '켜짐' : '꺼짐'}</b></p>
            <p className="mt-1">유료 모델 호출 {value.live_enabled ? '서버에서 허용' : '서버에서 차단'} · RAG 유료 평가 {value.rag_live_enabled ? '허용' : '차단'}</p>
            <p className="mt-2 text-ink-muted">접수를 켜도 유료 호출 허용·예산·비교 기준이 모두 준비돼야 계획을 등록할 수 있어요.</p>
          </>}</Pending>
        </Card>
      </div>
      <section className={styles.card} aria-label="평가 준비 상태">
        <h2 className={styles.cardTitle}>평가 준비 상태</h2>
        <ul className="divide-y divide-line text-sm">
          <CheckRow label="유료 평가 허용" ok={session.live_enabled} value={session.live_enabled ? '허용' : '차단'} note="운영 서버 설정이에요. 차단이면 새 응답 생성 평가를 접수하지 못해요." />
          <CheckRow label="누적 평가 한도" ok={budget.state === 'ready' ? !!budget.value.remaining && budget.value.remaining.calls > 0 : null}
            value={budget.state !== 'ready' ? '확인 중' : !budget.value.remaining ? '미설정' : `호출 ${count(budget.value.remaining.calls)}회 남음`} note="호출·토큰이 남아 있어야 유료 평가를 접수해요." />
          <CheckRow label="AI 실행 추적 연결" ok={traces.state === 'loading' ? null : traces.state === 'ready'} value={traces.state === 'loading' ? '확인 중' : traces.state === 'ready' ? '연결됨' : '연결 안 됨'} note="Langfuse에서 요청별 실행 단계를 읽어요." />
          <li className="flex flex-wrap items-start justify-between gap-2 py-3">
            <div className="min-w-0"><p className="font-semibold">평가 실행 연결</p><p className="mt-1 text-xs text-ink-muted">평가 자료·결과 저장소·Prefect 등록을 조회해요. 모델 호출·예산 예약은 없어요.</p>
              {runtime?.state === 'ready' && <p className="mt-1 text-xs">평가 자료 {runtime.value.checks.evidence === 'PASS' ? '정상' : '문제'} · 결과 저장소 {runtime.value.checks.results_directory === 'PASS' ? '정상' : '문제'} · Prefect 등록 {runtime.value.checks.prefect_deployment === 'PASS' ? '정상' : '문제'}</p>}
              {runtime?.state === 'failed' && <p role="alert" className="mt-1 text-xs text-red-700">{runtime.message}</p>}
            </div>
            {runtime?.state === 'ready' ? <span className={workspaceTagClassName(runtime.value.status === 'PASS' ? 'ok' : 'warn')}>{runtime.value.status === 'PASS' ? '정상' : '문제 있음'}</span>
              : <button className={styles.secondaryButton} onClick={checkRuntime} disabled={runtime?.state === 'loading'}>{runtime?.state === 'loading' ? '점검 중…' : '연결 점검'}</button>}
          </li>
        </ul>
      </section>
    </div>
  </>
}
