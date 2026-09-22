import { Link } from 'react-router'

import { publicPaths } from '../../../shared/routes/appPaths'
import { accountTypeOptions, type OnboardingIcon } from '../viewmodel/onboardingOptions'
import { useWelcomeViewModel } from '../viewmodel/useWelcomeViewModel'

/**
 * 아티팩트(반응형 데모 · 최초 로그인 온보딩)의 환영 화면을 그대로 옮긴 배치입니다.
 * 위: 로고 왼쪽 + 단계 알약 오른쪽 / 가운데: 눈썹·제목·설명·선택 카드(아이콘·라디오 점·"무엇이 열리는지" 줄) / 아래: 고정 발판.
 * 좁은 화면은 카드가 한 열로 쌓이고 아이콘이 왼쪽에 붙으며 주 버튼이 넓어집니다.
 */
const s = {
  page: 'flex min-h-dvh flex-col bg-app-canvas',
  top: 'flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4 max-[599px]:px-4 max-[599px]:py-3',
  brand: 'flex items-center gap-2 text-[0.95rem] font-extrabold tracking-[-0.01em] text-app-ink no-underline',
  brandMark: 'grid size-6 place-items-center rounded-[7px] bg-brand-primary text-[0.75rem] font-extrabold text-white',
  steps: 'm-0 ml-auto flex list-none flex-wrap gap-1.5 p-0',
  // 같은 속성의 유틸리티를 겹쳐 쓰면 CSS 순서에 따라 지므로, 상태별 색은 한 벌만 붙입니다.
  step: 'flex items-center gap-1.5 rounded-full border bg-surface py-[3px] pr-[11px] pl-[3px] text-[0.75rem] font-bold max-[599px]:text-[0.69rem]',
  stepIdle: 'border-line text-ink-subtle',
  stepCurrent: 'border-brand-line text-brand-primary',
  stepDone: 'cursor-pointer border-line text-app-ink hover:border-line-strong',
  stepNumber: 'grid size-[22px] place-items-center rounded-full text-[0.69rem] tabular-nums',
  stepNumberIdle: 'bg-surface-muted',
  stepNumberCurrent: 'bg-brand-primary text-white',
  stepNumberDone: 'bg-brand-soft text-brand-primary',
  body: 'mx-auto flex w-full max-w-[800px] flex-1 flex-col items-center gap-3.5 px-6 pt-7 pb-4 text-center max-[599px]:items-stretch max-[599px]:px-4 max-[599px]:pt-3 max-[599px]:text-left',
  eyebrow: 'text-[0.69rem] font-extrabold tracking-[0.08em] text-brand-primary',
  title: 'm-0 text-[1.7rem] font-extrabold tracking-[-0.03em] text-app-ink text-balance max-[599px]:text-[1.3rem]',
  lead: 'm-0 max-w-[48ch] text-[0.9rem] text-ink-muted max-[599px]:text-[0.85rem]',
  choices2: 'mt-1.5 grid w-full grid-cols-2 gap-3 text-left max-[599px]:grid-cols-1',
  choices3: 'mt-1.5 grid w-full grid-cols-3 gap-3 text-left max-[599px]:grid-cols-1',
  choice: [
    'relative flex min-h-[168px] cursor-pointer flex-col gap-2 rounded-[18px] border-[1.5px] border-line bg-surface px-4 pt-[18px] pb-4 transition-[border-color,box-shadow]',
    'hover:border-line-strong has-[:checked]:border-brand-primary has-[:checked]:shadow-focus has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-brand-primary',
    'max-[599px]:grid max-[599px]:min-h-0 max-[599px]:grid-cols-[auto_1fr] max-[599px]:items-start max-[599px]:gap-x-3 max-[599px]:gap-y-1 max-[599px]:px-3.5 max-[599px]:pt-3.5 max-[599px]:pb-3',
  ].join(' '),
  icon: 'grid size-[38px] place-items-center rounded-[11px] bg-brand-soft text-brand-primary max-[599px]:row-span-2 max-[599px]:size-[34px]',
  dot: 'absolute top-4 right-4 size-5 rounded-full border-[1.5px]',
  dotIdle: 'border-line-strong',
  dotOn: 'border-brand-primary bg-brand-primary shadow-[inset_0_0_0_4px_#fff]',
  choiceTitle: 'pr-[26px] text-[0.97rem] font-extrabold text-app-ink',
  choiceDescription: 'text-[0.81rem] leading-[1.55] text-ink-muted',
  gets: 'mt-auto flex flex-col gap-0.5 border-t border-dashed border-line pt-2.5 text-[0.72rem] text-ink-muted max-[599px]:col-span-full',
  getsLead: 'font-extrabold text-brand-primary',
  hint: 'flex w-full items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-[0.78rem] text-ink-muted',
  hintIcon: 'mt-0.5 shrink-0 text-info',
  foot: 'sticky bottom-0 mx-auto flex w-full max-w-[800px] flex-wrap items-center gap-2 px-6 pt-3.5 pb-[calc(1.4rem+env(safe-area-inset-bottom))] [background:linear-gradient(rgb(245_246_247/0),var(--color-app-canvas)_35%)] max-[599px]:px-4 max-[599px]:pt-3 max-[599px]:pb-[calc(1rem+env(safe-area-inset-bottom))]',
  grow: 'flex-1 max-[599px]:hidden',
  error: 'text-[0.78rem] font-semibold text-danger',
  primary: 'inline-flex h-11 cursor-pointer items-center justify-center rounded-full border-0 bg-brand-primary px-5 text-[0.88rem] font-bold text-white hover:bg-brand-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50 max-[599px]:h-11 max-[599px]:flex-[1_1_60%]',
  secondary: 'inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface px-[15px] text-[0.81rem] font-bold text-app-ink hover:bg-surface-muted disabled:opacity-50 max-[599px]:h-11',
  ghost: 'inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-transparent bg-transparent px-[15px] text-[0.81rem] font-bold text-ink-muted hover:bg-surface-muted hover:text-app-ink disabled:opacity-50 max-[599px]:h-11',
} as const

const iconPaths: Record<OnboardingIcon, string> = {
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-3.5-3.5',
  doc: 'M6 2h9l5 5v15H6zM14 2v6h6',
  users: 'M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
}

function Icon({ name, size = 18, strokeWidth = 1.75 }: { name: OnboardingIcon | 'info' | 'check'; size?: number; strokeWidth?: number }) {
  const d = name === 'info' ? 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5M12 8h.01' : name === 'check' ? 'M5 12.5 9.5 17 19 7.5' : iconPaths[name]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export function WelcomePage() {
  const vm = useWelcomeViewModel()
  const typeName = vm.type === 'INDIVIDUAL' ? '개인 회원' : '기업 회원'

  const steps = (
    <ol className={s.steps} aria-label="진행 단계">
      <li aria-current={vm.step === 1 ? 'step' : undefined}>
        {vm.step > 1 ? (
          <button type="button" className={`${s.step} ${s.stepDone}`} onClick={vm.goBackToTypeStep} aria-label={`1단계 회원 유형 다시 고르기, 지금 ${typeName}`}>
            <i className={`${s.stepNumber} ${s.stepNumberDone} not-italic`}><Icon name="check" size={12} strokeWidth={3} /></i>{typeName}
          </button>
        ) : (
          <span className={`${s.step} ${s.stepCurrent}`}><i className={`${s.stepNumber} ${s.stepNumberCurrent} not-italic`}>1</i>회원 유형</span>
        )}
      </li>
      <li aria-current={vm.step === 2 ? 'step' : undefined}>
        <span className={`${s.step} ${vm.step === 2 ? s.stepCurrent : s.stepIdle}`}><i className={`${s.stepNumber} ${vm.step === 2 ? s.stepNumberCurrent : s.stepNumberIdle} not-italic`}>2</i>이용 목적</span>
      </li>
    </ol>
  )

  return (
    <main className={s.page} aria-labelledby="welcome-title">
      <div className={s.top}>
        <Link className={s.brand} to={publicPaths.landing} aria-label="GovBiz 홈으로"><span className={s.brandMark} aria-hidden="true">G</span>GovBiz</Link>
        {steps}
      </div>

      {vm.step === 1 ? (
        <form className="contents" aria-label="회원 유형 선택" onSubmit={(event) => { event.preventDefault(); vm.goToPurposeStep() }}>
          <div className={s.body}>
            <span className={s.eyebrow}>1 / 2 · 꼭 골라 주세요</span>
            <h1 id="welcome-title" className={s.title}>어떤 회원으로 시작할까요?</h1>
            <p className={s.lead}>사업자등록번호가 있으면 기업 회원, 아직 없으면 개인 회원이에요. 나중에 기업으로 전환할 수 있어요.</p>
            <div className={s.choices2} role="radiogroup" aria-labelledby="welcome-title">
              {accountTypeOptions.map((option) => (
                <label key={option.value} className={s.choice}>
                  <input type="radio" name="account-type" className="sr-only" value={option.value} checked={vm.type === option.value} onChange={() => vm.chooseType(option.value)} />
                  <span className={`${s.dot} ${vm.type === option.value ? s.dotOn : s.dotIdle}`} aria-hidden="true" />
                  <span className={s.icon}><Icon name={option.icon} /></span>
                  <b className={s.choiceTitle}>{option.title}</b>
                  <span className={s.choiceDescription}>{option.description}</span>
                  <span className={s.gets}><b className={s.getsLead}>{option.note}</b></span>
                </label>
              ))}
            </div>
            <div className={s.hint}>
              <span className={s.hintIcon}><Icon name="info" size={15} /></span>
              <span><b className="text-app-ink">사업자등록번호는 지금 묻지 않아요.</b> 기업 회원을 고르면 프로필에서 한 번만 입력해요. 가입 때 적은 이메일도 다시 묻지 않아요.</span>
            </div>
          </div>
          <div className={s.foot}>
            <span className={s.grow} />
            <button type="submit" className={s.primary}>다음</button>
          </div>
        </form>
      ) : (
        <form className="contents" aria-label="이용 목적 선택" onSubmit={(event) => { event.preventDefault(); vm.start() }}>
          <div className={s.body}>
            <span className={s.eyebrow}>2 / 2 · 건너뛰어도 돼요</span>
            <h1 id="welcome-title" className={s.title}>무엇을 하러 오셨나요?</h1>
            <p className={s.lead}>고르면 첫 화면과 예시 검색을 맞춰 드려요. 나중에 프로필에서 바꿀 수 있어요.</p>
            <div className={s.choices3} role="radiogroup" aria-labelledby="welcome-title">
              {vm.purposeOptions.map((option) => (
                <label key={option.value} className={s.choice}>
                  <input type="radio" name="purpose" className="sr-only" value={option.value} checked={vm.purpose === option.value} onChange={() => vm.choosePurpose(option.value)} />
                  <span className={`${s.dot} ${vm.purpose === option.value ? s.dotOn : s.dotIdle}`} aria-hidden="true" />
                  <span className={s.icon}><Icon name={option.icon} /></span>
                  <b className={s.choiceTitle}>{option.title}</b>
                  <span className={s.choiceDescription}>{option.description}</span>
                  <span className={s.gets}><b className={s.getsLead}>첫 화면 · {option.firstScreen}</b><span>예시 “{option.chips[0]}”</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className={s.foot}>
            <button type="button" className={s.ghost} onClick={vm.goBackToTypeStep} disabled={vm.isSaving}>이전</button>
            {vm.error ? <span className={s.error} role="alert">{vm.error}</span> : vm.needsChoice ? <span className={s.error} role="alert">하나를 고르거나 건너뛰기를 눌러 주세요.</span> : null}
            <span className={s.grow} />
            <button type="button" className={s.secondary} onClick={vm.skipPurpose} disabled={vm.isSaving}>건너뛰기</button>
            <button type="submit" className={s.primary} aria-disabled={vm.purpose === null || vm.isSaving}>{vm.isSaving ? '저장 중…' : '이대로 시작하기'}</button>
          </div>
        </form>
      )}
    </main>
  )
}
