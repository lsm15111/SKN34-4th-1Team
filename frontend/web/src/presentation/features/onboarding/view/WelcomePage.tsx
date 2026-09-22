import { AuthLogo } from '../../auth/view/AuthLogo'
import { accountTypeOptions } from '../viewmodel/onboardingOptions'
import { useWelcomeViewModel } from '../viewmodel/useWelcomeViewModel'

const s = {
  page: 'flex min-h-dvh flex-col items-center bg-app-canvas px-4 pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:justify-center sm:pb-10',
  panel: 'flex w-full max-w-[44rem] flex-col gap-6',
  steps: 'm-0 flex list-none gap-2 p-0',
  step: 'flex flex-1 items-center gap-2 rounded-panel border border-line bg-surface px-3 py-2 text-[0.78rem] font-bold text-ink-muted',
  stepCurrent: 'border-brand-primary bg-brand-soft text-brand-primary',
  stepNumber: 'grid size-5 place-items-center rounded-full bg-surface-muted text-[0.7rem]',
  title: 'm-0 text-[1.5rem] font-extrabold tracking-[-0.03em] text-app-ink sm:text-[1.75rem]',
  lead: 'm-0 text-[0.95rem] leading-relaxed text-ink-muted',
  choices: 'grid gap-3 sm:grid-cols-2',
  choicesThree: 'grid gap-3 sm:grid-cols-3',
  choice: 'flex cursor-pointer flex-col gap-2 rounded-card border-[1.5px] border-line bg-surface p-4 text-left transition-colors has-[:checked]:border-brand-primary has-[:checked]:shadow-focus',
  choiceTitle: 'text-[1rem] font-extrabold text-app-ink',
  choiceDescription: 'text-[0.85rem] leading-relaxed text-ink-muted',
  choiceNote: 'mt-auto text-[0.78rem] font-bold text-brand-primary',
  info: 'm-0 rounded-panel bg-info-soft px-4 py-3 text-[0.85rem] leading-relaxed text-info',
  footer: 'fixed inset-x-0 bottom-0 flex gap-2 border-t border-line bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:border-0 sm:bg-transparent sm:p-0',
  primary: 'inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-full border-0 bg-brand-primary px-5 text-[0.95rem] font-extrabold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none',
  secondary: 'inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface px-5 text-[0.95rem] font-bold text-app-ink hover:border-brand-primary disabled:opacity-60',
  skip: 'inline-flex min-h-12 cursor-pointer items-center justify-center border-0 bg-transparent px-3 text-[0.9rem] font-bold text-ink-muted underline underline-offset-4 hover:text-app-ink',
  error: 'm-0 text-[0.85rem] font-semibold text-danger',
} as const

/**
 * 가입 직후 한 번 거치는 환영 화면입니다. 모달이 아니라 주소가 있는 페이지라 새로고침·뒤로가기가 단순합니다.
 * 사이드바·도우미 없이 단독으로 뜨고, 답은 첫 화면·예시 검색·시작하기 순서를 바꿉니다.
 */
export function WelcomePage() {
  const vm = useWelcomeViewModel()
  const typeName = vm.type === 'INDIVIDUAL' ? '개인 회원' : '기업 회원'

  return (
    <main className={s.page} aria-labelledby="welcome-title">
      <div className={s.panel}>
        <AuthLogo />
        <ol className={s.steps} aria-label="시작하기 단계">
          <li className={`${s.step} ${vm.step === 1 ? s.stepCurrent : ''}`} aria-current={vm.step === 1 ? 'step' : undefined}>
            <span className={s.stepNumber}>{vm.step > 1 ? '✓' : '1'}</span>{vm.step > 1 ? typeName : '회원 유형'}
          </li>
          <li className={`${s.step} ${vm.step === 2 ? s.stepCurrent : ''}`} aria-current={vm.step === 2 ? 'step' : undefined}>
            <span className={s.stepNumber}>2</span>이용 목적
          </li>
        </ol>

        {vm.step === 1 ? (
          <form aria-label="회원 유형 선택" onSubmit={(event) => { event.preventDefault(); vm.goToPurposeStep() }} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 id="welcome-title" className={s.title}>어떤 회원으로 시작할까요?</h1>
              <p className={s.lead}>사업자등록번호가 있으면 기업 회원, 아직 없으면 개인 회원이에요. 나중에 프로필에서 바꿀 수 있어요.</p>
            </div>
            <div className={s.choices} role="radiogroup" aria-label="회원 유형">
              {accountTypeOptions.map((option) => (
                <label key={option.value} className={s.choice}>
                  <input type="radio" name="account-type" className="sr-only" value={option.value} checked={vm.type === option.value}
                    onChange={() => vm.chooseType(option.value)} />
                  <span className={s.choiceTitle}>{option.title}</span>
                  <span className={s.choiceDescription}>{option.description}</span>
                  <span className={s.choiceNote}>{option.note}</span>
                </label>
              ))}
            </div>
            <p className={s.info}>사업자등록번호는 지금 묻지 않아요. 기업 회원을 고르면 프로필에서 한 번만 입력해요. 가입 때 적은 이메일도 다시 묻지 않아요.</p>
            <div className={s.footer}>
              <button type="submit" className={s.primary}>다음</button>
            </div>
          </form>
        ) : (
          <form aria-label="이용 목적 선택" onSubmit={(event) => { event.preventDefault(); vm.start() }} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h1 id="welcome-title" className={s.title}>무엇을 하러 오셨나요?</h1>
              <p className={s.lead}>고르면 첫 화면과 예시 검색을 맞춰 드려요. 나중에 프로필에서 바꿀 수 있어요.</p>
            </div>
            <div className={s.choicesThree} role="radiogroup" aria-label="이용 목적">
              {vm.purposeOptions.map((option) => (
                <label key={option.value} className={s.choice}>
                  <input type="radio" name="purpose" className="sr-only" value={option.value} checked={vm.purpose === option.value}
                    onChange={() => vm.choosePurpose(option.value)} />
                  <span className={s.choiceTitle}>{option.title}</span>
                  <span className={s.choiceDescription}>{option.description}</span>
                  <span className={s.choiceNote}>첫 화면 · {option.firstScreen} · 예시 “{option.chips[0]}”</span>
                </label>
              ))}
            </div>
            {vm.error ? <p className={s.error} role="alert">{vm.error}</p> : null}
            <div className={s.footer}>
              <button type="button" className={s.secondary} onClick={vm.goBackToTypeStep} disabled={vm.isSaving}>이전</button>
              <button type="button" className={s.skip} onClick={vm.skipPurpose} disabled={vm.isSaving}>건너뛰기</button>
              <button type="submit" className={s.primary} disabled={vm.isSaving}>{vm.isSaving ? '저장 중…' : '이대로 시작하기'}</button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
