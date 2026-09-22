import { Link } from 'react-router'

import { publicPaths } from '../../../shared/routes/appPaths'
import { accountTypeOptions, type OnboardingIcon } from '../viewmodel/onboardingOptions'
import { useWelcomeViewModel } from '../viewmodel/useWelcomeViewModel'

/**
 * 최초 로그인 환영 화면입니다. 회원 유형(개인/기업) 하나만 묻습니다.
 * 로고, 제목·설명, 선택 카드(아이콘·라디오 점·"무엇이 열리는지" 줄), 시작 버튼이 한 덩어리로 화면 가운데에 모입니다.
 * 좁은 화면은 카드가 한 열로 쌓이고 아이콘이 왼쪽에 붙으며 버튼이 아래에 고정됩니다.
 */
const s = {
  page: 'flex min-h-dvh flex-col items-center justify-center bg-app-canvas px-6 py-8 max-[599px]:justify-start max-[599px]:px-4 max-[599px]:pt-3 max-[599px]:pb-24',
  block: 'flex w-full max-w-[800px] flex-col gap-3.5',
  top: 'flex items-center pb-2 max-[599px]:pb-1',
  brand: 'flex items-center gap-2 text-[0.95rem] font-extrabold tracking-[-0.01em] text-app-ink no-underline',
  brandMark: 'grid size-6 place-items-center rounded-[7px] bg-brand-primary text-[0.75rem] font-extrabold text-white',
  body: 'flex w-full flex-col items-center gap-3.5 text-center max-[599px]:items-stretch max-[599px]:text-left',
  eyebrow: 'text-[0.69rem] font-extrabold tracking-[0.08em] text-brand-primary',
  title: 'm-0 text-[1.7rem] font-extrabold tracking-[-0.03em] text-app-ink text-balance max-[599px]:text-[1.3rem]',
  lead: 'm-0 max-w-[48ch] text-[0.9rem] text-ink-muted max-[599px]:text-[0.85rem]',
  choices: 'mt-1.5 grid w-full grid-cols-2 gap-3 text-left max-[599px]:grid-cols-1',
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
  // 버튼 줄은 카드 바로 아래에 있습니다. 좁은 화면에서만 아래에 고정해 엄지로 바로 누르게 합니다.
  foot: 'flex w-full flex-wrap items-center gap-2 pt-2 max-[599px]:fixed max-[599px]:inset-x-0 max-[599px]:bottom-0 max-[599px]:px-4 max-[599px]:pt-3 max-[599px]:pb-[calc(1rem+env(safe-area-inset-bottom))] max-[599px]:[background:linear-gradient(rgb(245_246_247/0),var(--color-app-canvas)_35%)]',
  grow: 'flex-1 max-[599px]:hidden',
  error: 'text-[0.78rem] font-semibold text-danger',
  primary: 'inline-flex h-11 cursor-pointer items-center justify-center rounded-full border-0 bg-brand-primary px-6 text-[0.88rem] font-bold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 max-[599px]:h-11 max-[599px]:flex-1',
} as const

const iconPaths: Record<OnboardingIcon | 'info', string> = {
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5M12 8h.01',
}

function Icon({ name, size = 18 }: { name: OnboardingIcon | 'info'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  )
}

export function WelcomePage() {
  const vm = useWelcomeViewModel()

  return (
    <main className={s.page} aria-labelledby="welcome-title">
      <div className={s.block}>
        <div className={s.top}>
          <Link className={s.brand} to={publicPaths.landing} aria-label="GovBiz 홈으로"><span className={s.brandMark} aria-hidden="true">G</span>GovBiz</Link>
        </div>
        <form className="contents" aria-label="회원 유형 선택" onSubmit={(event) => { event.preventDefault(); vm.start() }}>
          <div className={s.body}>
            <span className={s.eyebrow}>처음 한 번만 골라 주세요</span>
            <h1 id="welcome-title" className={s.title}>어떤 회원으로 시작할까요?</h1>
            <p className={s.lead}>사업자등록번호가 있으면 기업 회원, 아직 없으면 개인 회원이에요. 나중에 프로필에서 바꿀 수 있어요.</p>
            <div className={s.choices} role="radiogroup" aria-labelledby="welcome-title">
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
            {vm.error ? <span className={s.error} role="alert">{vm.error}</span> : null}
            <span className={s.grow} />
            <button type="submit" className={s.primary} disabled={vm.isSaving}>{vm.isSaving ? '저장 중…' : '시작하기'}</button>
          </div>
        </form>
      </div>
    </main>
  )
}
