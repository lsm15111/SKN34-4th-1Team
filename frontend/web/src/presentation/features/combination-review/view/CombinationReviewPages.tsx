import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAppDispatch, useAppSelector } from '../../../../app/hooks'
import { selectCurrentAccount, signedOut } from '../../../shared/auth/state/authSlice'
import { appPaths, combinationReviewRunResultPath, supportProgramDetailPath } from '../../../shared/routes/appPaths'
import { reviewProgramKey, supportsAutomaticReview, type ReviewSummary } from '../../../../domain/entities/CombinationReview'
import { useReviewListViewModel } from '../viewmodel/useReviewListViewModel'
import { useReviewEditorViewModel } from '../viewmodel/useReviewEditorViewModel'
import { ReviewParticipation } from './ReviewParticipation'
import { ReviewRunResult } from './ReviewRunResult'
import { SavedSupportProgramPickerDialog } from '../../../shared/support-program/SavedSupportProgramPickerDialog'
import { SupportProgramSearchFilters } from '../../../shared/support-program/SupportProgramSearchFilters'
import { formatReviewDateTime, runLabels } from './reviewLabels'
import { reviewStyles as s } from './CombinationReview.styles'
import { workspacePageStyles } from '../../../shared/workspace/WorkspacePage.styles'
import { SelectField } from '../../../shared/workspace/SelectField'
import { WorkspacePageHeader } from '../../../shared/workspace/WorkspacePageHeader'
import { WorkspaceModal } from '../../../shared/workspace/WorkspaceModal'
import { WorkspaceToast, type WorkspaceToastNotice } from '../../../shared/workspace/WorkspaceToast'
import { useFloatingPopover } from '../../../shared/workspace/useFloatingPopover'

const listTitle = '중복 지원·수혜 검토'
const scopeNotice = '두 공고를 함께 신청 · 선정 · 수행할 수 있는지 봐요. 과거 수혜 이력 누적 · 사업비 정산 규정은 이 검토 범위 밖이에요.'
const unsupportedNotice = '선택한 공고는 현재 자동 분석을 지원하지 않습니다. 기업마당의 숫자형 PBLN_ 공고와 K-Startup·과기정통부·충남 수출지원의 숫자형 공고를 지원하며, 세부사업은 지정하지 않아야 합니다.'
const steps = [['selection', '제목 · 공고 선택'], ['participation', '참여 상태'], ['analysis', '공고 분석']] as const
type Step = typeof steps[number][0]

const sessionKeys = new WeakMap<object, number>()
let nextSessionKey = 0
function sessionKey(account: object) {
  if (!sessionKeys.has(account)) sessionKeys.set(account, ++nextSessionKey)
  return sessionKeys.get(account)!
}

function ReviewError({ error }: { error: { message: string; status?: number; runId?: number | null } | null }) {
  const dispatch = useAppDispatch()
  const alertRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) alertRef.current?.focus() }, [error])
  if (!error) return null
  return <div ref={alertRef} tabIndex={-1} role="alert" className={s.warning}>{error.message}
    {error.runId && <p>저장된 실패 실행: #{error.runId}</p>}
    {error.status === 401 && <button className={`${s.button} ml-3`} onClick={() => dispatch(signedOut())}>다시 로그인</button>}
  </div>
}

export function CombinationReviewListPage() {
  const account = useAppSelector(selectCurrentAccount)
  return account ? <ReviewList key={sessionKey(account)} account={account.email} /> : null
}

/** 검토 행의 [⋯] 메뉴입니다. 입력 수정으로 가거나 삭제 확인을 엽니다. 바깥 클릭 · Esc로 닫힙니다. */
function ReviewMenu({ item, disabled, onDelete }: { item: ReviewSummary; disabled: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const floating = useFloatingPopover({ open, placement: 'bottom-end' })
  useEffect(() => {
    if (!open) return
    const close = (event: Event) => { if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', onKey) }
  }, [open])
  return <div ref={ref} className="relative">
    <button ref={floating.reference} type="button" className={s.menuButton} aria-label={`검토 메뉴: ${item.title}`} aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen((current) => !current)}>⋯</button>
    {open && <div ref={floating.floating} style={floating.floatingStyles} className={s.menu} role="menu" aria-label="검토 메뉴">
      <Link className={s.menuItem} role="menuitem" to={`${appPaths.combinationReviews}/${item.id}`} onClick={() => setOpen(false)}>입력 수정</Link>
      <button type="button" className={`${s.menuItem} ${s.menuItemDanger}`} role="menuitem" disabled={disabled} onClick={() => { setOpen(false); onDelete() }}>삭제</button>
    </div>}
  </div>
}

function ReviewList({ account }: { account: string }) {
  const vm = useReviewListViewModel(account)
  const [confirming, setConfirming] = useState<ReviewSummary | null>(null)
  const [toast, setToast] = useState<WorkspaceToastNotice | null>(null)
  const deleting = vm.busy.includes('delete')
  const header = <WorkspacePageHeader title={listTitle} actions={<Link className={workspacePageStyles.primaryButton} to={appPaths.combinationReviewNew}>새 검토</Link>} />
  if (vm.error?.status === 401) return <>{header}<main className={workspacePageStyles.content}><ReviewError error={vm.error} /></main></>
  const items = vm.page?.items ?? []
  return <>{header}<main className={workspacePageStyles.content}>
    <p className={s.muted}>{scopeNotice.split('.')[0]}. 저장한 검토와 실행 기록은 본인만 볼 수 있어요.</p>
    <ReviewError error={vm.error} />
    {vm.busy.includes('list') && <p role="status">검토 목록을 불러오는 중입니다.</p>}
    {vm.page?.items.length === 0 && <div className={`${s.card} flex flex-col items-center gap-2 text-center`}>
      <h2 className="font-semibold">아직 저장한 검토가 없어요</h2>
      <p className={s.muted}>새 검토에서 공고 2개와 참여 상태를 입력하면 분석을 시작할 수 있어요.</p>
      <Link className={s.secondarySm} to={appPaths.combinationReviewNew}>새 검토</Link>
    </div>}
    {items.length > 0 && <ul className="space-y-3" aria-label="저장한 검토">{items.map((item) => <li className={`${s.card} flex flex-wrap items-center gap-x-4 gap-y-2`} key={item.id}>
      <Link className="min-w-0 flex-1 hover:text-brand-primary" to={`${appPaths.combinationReviews}/${item.id}`}>
        <strong>{item.title}</strong><span className="block text-xs text-slate-500">입력 버전 {item.inputRevision}</span>
      </Link>
      <span className="text-sm text-slate-600 tabular-nums">{formatReviewDateTime(item.updatedAt)} 수정</span>
      <div className="flex items-center gap-2">
        <ReviewMenu item={item} disabled={deleting} onDelete={() => setConfirming(item)} />
        <Link className={s.secondarySm} to={`${appPaths.combinationReviews}/${item.id}?step=analysis`}>실행 기록<span className="sr-only">: {item.title}</span></Link>
      </div>
    </li>)}</ul>}
    {vm.error && <div className="flex justify-center"><button className={s.secondarySm} disabled={vm.busy.length > 0} onClick={() => void vm.load()}>다시 시도</button></div>}
    {vm.page?.nextBeforeId && <div className="flex justify-center"><button className={s.secondarySm} disabled={vm.busy.length > 0} onClick={() => void vm.load(vm.page!.nextBeforeId!)}>더 보기</button></div>}
  </main>
  <WorkspaceModal isOpen={confirming !== null} title="검토를 삭제할까요?" tone="danger" onClose={() => setConfirming(null)}
    description={confirming ? `${confirming.title}의 입력과 실행 기록 · 보관한 원문이 모두 지워져요. 되돌릴 수 없어요.` : undefined}>
    <div className="flex flex-wrap justify-end gap-2">
      <button className={s.button} disabled={deleting} type="button" onClick={() => setConfirming(null)}>취소</button>
      <button className={s.dangerSolid} disabled={deleting} aria-busy={deleting} type="button" onClick={() => {
        if (confirming === null) return
        void vm.deleteReview(confirming.id).then((deleted) => { if (deleted) { setConfirming(null); setToast({ id: Date.now(), text: '검토를 삭제했어요' }) } })
      }}>{deleting ? '삭제 중…' : '삭제'}</button>
    </div>
  </WorkspaceModal>
  <WorkspaceToast notice={toast} onClose={() => setToast(null)} />
  </>
}

export function CombinationReviewEditorPage({ create = false }: { create?: boolean }) {
  const account = useAppSelector(selectCurrentAccount)
  const { reviewId } = useParams()
  const id = create ? null : Number(reviewId)
  if (!account) return null
  if (!create && (!Number.isSafeInteger(id) || id! <= 0)) return <><WorkspacePageHeader parent={{ to: appPaths.combinationReviews, label: listTitle }} title="검토" /><main className={workspacePageStyles.content}><p role="alert">올바른 검토 주소가 아닙니다.</p><Link className={workspacePageStyles.quietLink} to={appPaths.combinationReviews}>목록으로</Link></main></>
  return <ReviewEditor key={`${sessionKey(account)}:${id ?? 'new'}`} id={id} account={account.email} />
}

export function CombinationReviewRunResultPage() {
  const account = useAppSelector(selectCurrentAccount)
  const { reviewId: reviewIdParam, runId: runIdParam } = useParams()
  const reviewId = Number(reviewIdParam)
  const runId = Number(runIdParam)
  const valid = Number.isSafeInteger(reviewId) && reviewId > 0 && Number.isSafeInteger(runId) && runId > 0
  if (!account) return null
  if (!valid) return <><WorkspacePageHeader parent={{ to: appPaths.combinationReviews, label: listTitle }} title="검토 결과" /><main className={workspacePageStyles.content}><p role="alert">올바른 실행 결과 주소가 아닙니다.</p><Link className={workspacePageStyles.quietLink} to={appPaths.combinationReviews}>목록으로</Link></main></>
  return <RunResultPage key={`${sessionKey(account)}:${reviewId}:${runId}`} reviewId={reviewId} runId={runId} account={account.email} />
}

function RunResultPage({ reviewId, runId, account }: { reviewId: number; runId: number; account: string }) {
  const vm = useReviewEditorViewModel(reviewId, account, false, runId)
  const navigate = useNavigate()
  const contentRef = useRef<HTMLElement>(null)
  const reviewPath = `${appPaths.combinationReviews}/${reviewId}`
  const header = <WorkspacePageHeader parent={[{ to: appPaths.combinationReviews, label: listTitle }, { to: `${reviewPath}?step=analysis`, label: vm.review?.title ?? '검토' }]} title="검토 결과"
    actions={<Link className={workspacePageStyles.secondaryButton} to={`${reviewPath}?step=participation`}>입력 수정</Link>} />
  useEffect(() => {
    const scrollArea = contentRef.current?.parentElement
    if (scrollArea && typeof scrollArea.scrollTo === 'function') scrollArea.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [])
  if (vm.error?.status === 401) return <>{header}<main className={workspacePageStyles.content}><ReviewError error={vm.error} /></main></>
  const selectedRun = vm.run?.id === runId ? vm.run : null
  const runOptions = vm.runs?.items ?? []
  const currentRunInOptions = runOptions.some((run) => run.id === runId)
  return <>{header}<main ref={contentRef} className={workspacePageStyles.content}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <p className={s.muted}>실행 #{runId}{selectedRun && ` · ${formatReviewDateTime(selectedRun.startedAt)} · 입력 버전 ${selectedRun.inputRevision}`}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SelectField label="실행 결과 선택" className={`${s.input} mt-0 w-auto min-w-56`} value={String(runId)}
          options={[
            ...(currentRunInOptions ? [] : [{ value: String(runId), label: `실행 #${runId} · 현재 결과` }]),
            ...runOptions.map((run) => ({ value: String(run.id), label: `실행 #${run.id} · ${runLabels[run.status]} · ${formatReviewDateTime(run.startedAt)}` })),
          ]}
          onChange={(value) => navigate(combinationReviewRunResultPath(reviewId, Number(value)))} />
        {vm.runs?.nextBeforeId && <button className={s.secondarySm} type="button" disabled={vm.busy.includes('history')} onClick={() => vm.history(vm.runs!.nextBeforeId!)}>이전 실행 더 보기</button>}
      </div>
    </div>
    <ReviewError error={vm.error} />
    {!selectedRun && vm.busy.some((value) => value === 'load' || value === 'run') && <p role="status">실행 결과를 불러오는 중입니다.</p>}
    {!selectedRun && vm.review && vm.error && !vm.busy.includes('run') && <div className="flex justify-center"><button className={s.primary} type="button" onClick={() => vm.selectRun(runId)}>다시 시도</button></div>}
    {selectedRun && <ReviewRunResult run={selectedRun} currentRevision={vm.review?.inputRevision ?? selectedRun.inputRevision} names={vm.names} download={vm.download} downloading={vm.busy.includes('download')} />}
  </main></>
}

function ReviewEditor({ id, account }: { id: number | null; account: string }) {
  const location = useLocation()
  const suppliedFacts = (location.state as { additionalFacts?: unknown } | null)?.additionalFacts
  const initialFacts = typeof suppliedFacts === 'string' ? suppliedFacts : ''
  const [savedProgramsOpen, setSavedProgramsOpen] = useState(false)
  const vm = useReviewEditorViewModel(id, account, savedProgramsOpen, null, initialFacts)
  const [step, setStep] = useState<Step>(() => {
    const requested = new URLSearchParams(location.search).get('step')
    return id && (requested === 'analysis' || requested === 'participation') ? requested : 'selection'
  })
  const contentRef = useRef<HTMLElement>(null)
  const savedProgramsButtonRef = useRef<HTMLButtonElement>(null)
  const closeSavedPrograms = () => { setSavedProgramsOpen(false); savedProgramsButtonRef.current?.focus() }
  useEffect(() => {
    setSavedProgramsOpen(false)
    const scrollArea = contentRef.current?.parentElement
    if (scrollArea && typeof scrollArea.scrollTo === 'function') scrollArea.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [step])
  const saving = vm.busy.includes('save')
  const inputBusy = saving || vm.busy.includes('load')
  const analysisBusy = vm.busy.includes('analysis')
  const invalidProgramCount = vm.draft.programs.length !== 2
  const unsupported = vm.draft.programs.some((p) => !supportsAutomaticReview(p))
  const activeRun = vm.runs?.items.find((run) => run.status === 'QUEUED' || run.status === 'RUNNING')
  const unknownRun = vm.runs?.items.some((run) => run.status === 'UNKNOWN')
  const changeStep = (next: Step) => { vm.setError(null); setStep(next) }
  // 단계를 넘길 때 입력을 검증 · 저장합니다(새 검토는 1단계에서 만들어 주소가 바뀜).
  const goTo = (next: Step) => vm.saveInput(() => changeStep(next))
  const stepIndex = steps.findIndex(([value]) => value === step)
  const title = id ? (vm.review?.title ?? '검토') : '새 검토'
  const header = <WorkspacePageHeader parent={{ to: appPaths.combinationReviews, label: listTitle }} title={title} />
  const saveNote = saving ? '저장 중…' : !id || vm.dirty ? '다음 단계로 넘어가면 자동 저장돼요' : '자동 저장됨'
  if (vm.error?.status === 401) return <>{header}<main className={workspacePageStyles.content}><ReviewError error={vm.error} /></main></>
  return <>{header}<main ref={contentRef} className={workspacePageStyles.content}>
    <ol className="grid gap-2 max-[599px]:hidden sm:grid-cols-3" aria-label="검토 진행 단계">
      {steps.map(([value, label], index) => <li key={value} className={`flex flex-col rounded-2xl border px-3 py-2 ${index === stepIndex ? 'border-brand-primary bg-brand-soft' : index < stepIndex ? 'border-brand-primary/40 bg-white' : 'border-slate-200 bg-white'}`} aria-current={index === stepIndex ? 'step' : undefined}>
        <span className={`text-xs font-bold ${index <= stepIndex ? 'text-brand-primary' : 'text-slate-500'}`}>{index + 1}단계{index < stepIndex ? ' · 완료' : index === stepIndex ? ' · 진행 중' : ''}</span>
        <b className="text-sm">{label}</b>
      </li>)}
    </ol>
    <div className="flex flex-col gap-1.5 min-[600px]:hidden" aria-hidden="true">
      <div className="flex justify-between text-sm font-extrabold"><span>{steps[stepIndex]![1]}</span><span className="text-slate-500 tabular-nums">{stepIndex + 1} / 3</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted"><i className="block h-full rounded-full bg-brand-primary" style={{ width: `${(stepIndex + 1) / 3 * 100}%` }} /></div>
      <span className="text-xs text-slate-500">{saveNote}</span>
    </div>
    <ReviewError error={vm.error} />
    {id && vm.error?.runId && <Link className={s.secondarySm} to={combinationReviewRunResultPath(id, vm.error.runId)}>실패 실행 #{vm.error.runId} 확인</Link>}
    {vm.rejectedRevision && vm.pending && <button className={s.secondarySm} onClick={vm.clearRejectedRequest}>버전 충돌로 거절된 실행 요청 정리</button>}
    {vm.notice && <p role="status" className={s.muted}>{vm.notice}</p>}
    {id && !vm.review ? <div className={s.card}>{vm.busy.includes('load') ? <p role="status">저장 입력과 실행 기록을 불러오는 중입니다.</p> : <button className={s.secondarySm} onClick={vm.load}>다시 시도</button>}</div> : <>
      {step === 'selection' && <>
        <fieldset disabled={inputBusy} className="space-y-4">
          <div className={s.card}><label className="font-semibold">검토 제목<input className={s.input} value={vm.draft.title} onChange={(e) => vm.setDraft({ ...vm.draft, title: e.target.value })} required placeholder="예: 창업 지원사업 참여 검토" /></label><p className={s.muted}>제목은 200자 이내입니다. 참여 상태는 다음 단계에서 입력합니다.</p></div>
          <section className={s.card} aria-label="공고 선택">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">비교할 공고 선택</h2><strong className="rounded-full bg-brand-accent px-3 py-1 text-sm text-brand-primary">{vm.draft.programs.length}/2 선택</strong></div>
            <p className={s.muted}>관심 공고함이나 전체 공고 검색에서 서로 비교할 공고를 정확히 2개 선택하세요. 접수 종료 공고도 참여 이력 검토에 사용할 수 있습니다.</p>
            <div className="mt-3 flex min-h-12 flex-col items-stretch gap-2 rounded-xl bg-slate-50 px-3 py-2" aria-label="현재 선택한 공고">
              {vm.draft.programs.length === 0 && <span className="text-sm text-slate-500">선택한 공고가 없습니다.</span>}
              {vm.draft.programs.map((program, index) => {
                const name = vm.names[reviewProgramKey(program)] ?? '공고 정보 확인 중'
                return <span className="inline-flex w-full min-w-0 items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-accent py-1 pr-1 pl-3 text-sm font-semibold text-brand-primary" key={reviewProgramKey(program)}><span className="min-w-0 flex-1 break-words">사업 {index + 1} · {name}</span><button type="button" className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-brand-accent focus-visible:outline-2 focus-visible:outline-brand-primary" aria-label={`${name} 선택 해제`} onClick={() => vm.setDraft({ ...vm.draft, programs: vm.draft.programs.filter((_, selectedIndex) => selectedIndex !== index) })}>×</button></span>
              })}
            </div>
            <button ref={savedProgramsButtonRef} type="button" className="mt-4 flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold hover:border-brand-primary hover:bg-brand-accent focus-visible:outline-2 focus-visible:outline-brand-primary" aria-label="관심 공고함에서 선택" aria-haspopup="dialog" aria-expanded={savedProgramsOpen} onClick={() => setSavedProgramsOpen(true)}><span>관심 공고함에서 선택</span><span className="text-brand-primary">열기 ›</span></button>
            <SavedSupportProgramPickerDialog open={savedProgramsOpen} phase={vm.savedProgramChoices.phase} programs={vm.savedProgramChoices.programs} selectedProgramKeys={vm.draft.programs.map((program) => `${program.sourceCode}:${program.sourceProgramId}`)} selectionLimit={2} description="비교할 공고를 최대 2개까지 선택할 수 있습니다." listLabel="중복 지원 검토 관심 공고 목록" onToggle={vm.toggle} onRetry={vm.savedProgramChoices.retry} onClose={closeSavedPrograms} />
            <h3 className="mt-5 font-semibold">전체 공고 검색</h3>
            <div className="mt-3"><SupportProgramSearchFilters filters={vm.catalogFilters} appliedFilters={vm.appliedCatalogFilters} catalog={vm.catalog}
              disabled={inputBusy} loading={vm.busy.includes('catalog')} onChange={vm.setCatalogFilters}
              onSearch={(filters) => { void vm.search(1, filters) }} /></div>
            {vm.busy.includes('catalog') && <p className="mt-3" role="status">공고를 불러오는 중입니다.</p>}
            {vm.catalog?.programs.length === 0 && <p className="mt-3">검색 결과가 없습니다. 검색어나 필터를 바꿔 다시 검색해 주세요.</p>}
            <ul className="mt-4 divide-y divide-slate-200">{vm.catalog?.programs.map((program) => {
              const identity = { sourceCode: program.sourceCode, sourceProgramId: program.id, subProgramId: null }
              const selected = vm.draft.programs.some((p) => reviewProgramKey(p) === reviewProgramKey(identity))
              return <li className={`my-2 rounded-xl border px-3 py-3 transition-colors ${selected ? 'border-brand-primary bg-brand-accent ring-1 ring-brand-primary/20' : 'border-transparent'}`} key={reviewProgramKey(identity)}><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0 flex-1"><strong>{program.title}</strong><p className={s.muted}>{program.organization} · {({ OPEN: '접수 중', CLOSED: '접수 종료', UPCOMING: '접수 예정', UNKNOWN: '접수 상태 미확인' })[program.status]}</p><p className={s.muted}>{program.applicationPeriod}</p></div><button type="button" className={selected ? s.primary : s.button} aria-pressed={selected} disabled={!selected && vm.draft.programs.length >= 2} onClick={() => vm.toggle(program)}>{selected ? '선택 해제' : '선택'}</button></div>
                {!supportsAutomaticReview(identity) && <p className="text-sm text-amber-800">현재 자동 분석을 지원하지 않는 공고입니다.</p>}
                <Link className="text-sm text-brand-primary underline" to={supportProgramDetailPath({ sourceCode: identity.sourceCode, sourceProgramId: identity.sourceProgramId }, true)} target="_blank">공고 상세 확인</Link>
              </li>
            })}</ul>
            {vm.catalog && <div className="mt-3 flex items-center gap-3"><button type="button" className={s.button} disabled={vm.catalog.page <= 1 || vm.busy.includes('catalog')} onClick={() => void vm.search(vm.catalog!.page - 1, vm.appliedCatalogFilters)}>이전 공고</button><span className="text-sm">{vm.catalog.page} / {Math.max(1, vm.catalog.totalPages)}</span><button type="button" className={s.button} disabled={vm.catalog.page >= vm.catalog.totalPages || vm.busy.includes('catalog')} onClick={() => void vm.search(vm.catalog!.page + 1, vm.appliedCatalogFilters)}>다음 공고</button></div>}
          </section>
          {unsupported && <p className={s.warning}>{unsupportedNotice}</p>}
        </fieldset>
        <StepBar note={saveNote} next={<button className={s.primary} type="button" onClick={() => goTo('participation')} disabled={invalidProgramCount || inputBusy}>{saving ? '저장 중…' : '다음'}</button>} />
      </>}
      {step === 'participation' && <>
        <fieldset disabled={inputBusy} className="space-y-4">
          <p className={s.muted}>공고마다 지금 어디까지 진행했는지 골라 주세요. 잘 모르면 "잘 모르겠음"으로 두세요.</p>
          {vm.draft.programs.map((program, index) => <ReviewParticipation key={reviewProgramKey(program)} program={program} index={index} name={vm.names[reviewProgramKey(program)]} onChange={(participation) => vm.setDraft({ ...vm.draft, programs: vm.draft.programs.map((p, i) => i === index ? { ...p, participation } : p) })} />)}
          <div className={s.card}><label className="block text-sm font-semibold">분석에 참고할 추가 설명 (선택)<textarea className={s.input} rows={4} maxLength={8000} value={vm.facts} onChange={(e) => vm.setFacts(e.target.value)} placeholder={'예: 두 사업에서 같은 인건비를 사용하려고 합니다.\n한 사업의 확약서를 철회할 예정입니다.\n두 사업의 수행 내용이 일부 같습니다.'} /></label><p className={s.muted}>{vm.facts.length}/8000 · 이번 실행에만 저장돼요.</p></div>
          {unsupported && <p className={s.warning}>{unsupportedNotice}</p>}
        </fieldset>
        <StepBar note={saveNote} back={<button className={s.button} type="button" disabled={inputBusy} onClick={() => goTo('selection')}>← 이전</button>}
          next={<button className={s.primary} type="button" disabled={inputBusy} onClick={() => goTo('analysis')}>{saving ? '저장 중…' : '다음'}</button>} />
      </>}
      {step === 'analysis' && id && <>
        <p className={s.info}>{scopeNotice}</p>
        <section className={`${s.card} space-y-3`} aria-label="분석 대상 공고"><h2 className="font-bold">분석 대상 공고</h2><ul className="space-y-2">{vm.draft.programs.map((program, index) => <li key={reviewProgramKey(program)} className="rounded-lg bg-slate-50 p-3"><strong>사업 {index + 1} · {vm.names[reviewProgramKey(program)] ?? '공고 정보 확인 중'}</strong></li>)}</ul></section>
        <section className={`${s.card} space-y-3`} aria-label="분석 실행"><h2 className="text-lg font-bold">공식 근거 분석</h2>
          <p className={s.muted}>PDF·HWP·HWPX 공식 첨부를 자동 수집하여 OpenAI로 분석합니다. [검토 실행]을 누르면 유료 API 호출이 발생할 수 있습니다. 원문 미확보·미지원 형식은 오류로 표시합니다.</p>
          {vm.dirty && <p className={s.warning}>저장하지 않은 입력이 있습니다. 이전 단계에서 저장한 뒤 분석해 주세요.</p>}
          {invalidProgramCount && <p className={s.warning}>기존에 저장한 3개 공고의 결과는 조회할 수 있지만 새 분석은 공고를 2개로 줄인 뒤 실행할 수 있습니다.</p>}
          {unsupported && <p className={s.warning}>{unsupportedNotice}</p>}
          {analysisBusy && <p role="status" className={s.info}>분석 요청을 접수하고 있어요. 창을 닫아도 접수된 서버 작업은 취소되지 않아요.</p>}
          {activeRun && <RunProgress status={activeRun.status === 'QUEUED' ? 'QUEUED' : 'RUNNING'} />}
          {unknownRun && <p className={s.warning}>완료 여부를 확인할 수 없는 실행이 있어 같은 검토의 새 분석을 막았어요. 중복 과금을 막기 위해 자동으로 다시 실행하지 않으며 운영자 확인이 필요해요.</p>}
          {vm.pollingPaused && <p className={s.warning}>상태 자동 조회가 멈췄어요. 아래 실행 기록에서 항목을 눌러 다시 확인해 주세요. 서버 작업은 취소되지 않아요.</p>}
          {vm.pending && <div className={`${s.warning} flex flex-wrap items-center justify-between gap-3`}><div><p>응답을 확인하지 못한 분석 요청이 있어요. 같은 요청 키 · 입력 버전 · 추가 설명으로만 다시 확인해요.</p><p>요청 입력 버전 {vm.pending.expectedRevision}</p><p className="whitespace-pre-wrap">추가 설명: {vm.pending.additionalFacts || '없음'}</p></div><button className={s.secondarySm} disabled={analysisBusy} onClick={() => vm.start(true)}>다시 시도</button></div>}
        </section>
        <section className={`${s.card} space-y-3`} aria-label="실행 기록"><h2 className="text-lg font-bold">실행 기록</h2>
          {vm.runs?.items.length === 0 && <p className={s.muted}>아직 분석을 실행하지 않았습니다.</p>}
          <ul className="space-y-2">{vm.runs?.items.map((run) => <li key={run.id}><Link className={`${s.button} w-full justify-start text-left`} to={combinationReviewRunResultPath(id, run.id)}>#{run.id} · 입력 버전 {run.inputRevision} · {runLabels[run.status]} · {formatReviewDateTime(run.startedAt)}</Link></li>)}</ul>
          {vm.runs?.nextBeforeId && <div className="flex justify-center"><button className={s.secondarySm} disabled={vm.busy.includes('history')} onClick={() => vm.history(vm.runs!.nextBeforeId!)}>이전 실행 더 보기</button></div>}
        </section>
        <StepBar note="검토 실행 1회마다 유료 분석이 한 번 실행돼요" back={<button className={s.button} type="button" disabled={inputBusy} onClick={() => changeStep('participation')}>← 이전</button>}
          next={vm.pending ? null : <button className={s.primary} type="button" disabled={analysisBusy || inputBusy || vm.dirty || !!activeRun || !!unknownRun || invalidProgramCount || unsupported} onClick={() => vm.start(false)}>{analysisBusy ? '접수 중…' : '검토 실행'}</button>} />
      </>}
    </>}
  </main></>
}

/** 단계 화면 아래에 붙는 이동 바입니다(화면 통일안 R3 StepFlow). 왼쪽 [이전] · 가운데 안내 · 오른쪽 주 동작. */
function StepBar({ back, note, next }: { back?: ReactNode; note: string; next: ReactNode }) {
  return <div className={s.stepBar}>{back}<span className={s.stepBarNote}>{note}</span><div className="ml-auto flex items-center gap-2">{next}</div></div>
}

/** 접수한 분석의 진행 표시입니다. 서버가 주는 상태(대기 · 분석 중)만 보여 주고 세부 단계는 지어내지 않습니다. */
function RunProgress({ status }: { status: 'QUEUED' | 'RUNNING' }) {
  const running = status === 'RUNNING'
  return <div role="status" className="rounded-xl border border-brand-primary/20 bg-brand-soft p-4 text-sm">
    <div className="flex items-center gap-3"><span className="size-3 animate-pulse rounded-full bg-brand-primary motion-reduce:animate-none" aria-hidden="true" /><strong>{running ? '공식 문서를 읽고 단계별로 판단하고 있어요' : '분석 차례를 기다리고 있어요'}</strong></div>
    <ol className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <li className="rounded-lg bg-white px-3 py-2 font-semibold text-brand-primary">{running ? '✓ 대기 중' : '● 대기 중'}</li>
      <li className={`rounded-lg px-3 py-2 ${running ? 'border border-brand-primary/30 bg-white font-semibold' : 'bg-white/60 text-slate-500'}`}>{running ? '● 분석 중' : '분석 중'}</li>
    </ol>
    <p className="mt-3">화면을 나가도 계속돼요. 상태는 3초마다 자동으로 확인해요.</p>
  </div>
}
