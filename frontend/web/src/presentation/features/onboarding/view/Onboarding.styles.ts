/**
 * 온보딩 두 화면(회원 유형·기업 등록)이 함께 쓰는 배치입니다. 로고·단계 알약·제목·본문·버튼 줄이 한 덩어리로
 * 화면 가운데 800px 안에 모이고, 좁은 화면(600px 미만)은 왼쪽 정렬로 바뀌며 버튼 줄이 아래에 고정됩니다.
 */
export const onboardingStyles = {
  page: 'flex min-h-dvh flex-col items-center justify-center bg-app-canvas px-6 py-8 max-[599px]:justify-start max-[599px]:px-4 max-[599px]:pt-3 max-[599px]:pb-28',
  block: 'flex w-full max-w-[800px] flex-col gap-3.5',
  top: 'flex items-center gap-3 pb-2 max-[599px]:pb-1',
  brand: 'flex items-center gap-2 text-[0.95rem] font-extrabold tracking-[-0.01em] text-app-ink no-underline',
  brandMark: 'grid size-6 place-items-center rounded-[7px] bg-brand-primary text-[0.75rem] font-extrabold text-white',
  // 단계 알약은 오른쪽에 둡니다. 좁은 화면은 지금 단계만 보여 줍니다.
  steps: 'ml-auto flex items-center gap-1.5',
  step: 'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pr-2.5 pl-1 text-[0.7rem] font-bold text-ink-subtle max-[599px]:hidden',
  stepOn: 'border-brand-line bg-brand-soft text-brand-primary max-[599px]:inline-flex',
  stepDone: 'text-ink-muted',
  stepMark: 'grid size-4 place-items-center rounded-full bg-line text-[0.6rem] font-extrabold text-ink-muted',
  stepMarkOn: 'bg-brand-primary text-white',
  stepMobileOnly: 'hidden max-[599px]:inline',
  // 좁은 화면에서 단계 알약 아래 진행 막대입니다.
  progress: 'hidden h-[3px] w-full overflow-hidden rounded-full bg-line max-[599px]:block',
  progressFill: 'h-full rounded-full bg-brand-primary',
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
  // 2단계의 번호 조회·결과·입력 칸이 한 카드에 위에서 아래로 열립니다.
  card: 'flex w-full flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 text-left @container/column',
  // 조회가 안 될 때의 안내 카드입니다. 다시 시도와 건너뛰기를 함께 둡니다.
  unavailable: 'flex flex-col gap-2 rounded-[0.85rem] border border-info-line bg-info-soft px-4 py-3',
  unavailableTitle: 'text-[0.95rem] font-bold text-app-ink',
  unavailableBody: 'text-[0.78rem] leading-[1.55] text-ink-muted',
  unavailableActions: 'flex flex-wrap gap-2 pt-1',
  // 버튼 줄은 본문 바로 아래에 있습니다. 좁은 화면에서만 아래에 고정해 엄지로 바로 누르게 합니다.
  foot: 'flex w-full flex-wrap items-center gap-2 pt-2 max-[599px]:fixed max-[599px]:inset-x-0 max-[599px]:bottom-0 max-[599px]:px-4 max-[599px]:pt-3 max-[599px]:pb-[calc(1rem+env(safe-area-inset-bottom))] max-[599px]:[background:linear-gradient(rgb(245_246_247/0),var(--color-app-canvas)_35%)]',
  grow: 'flex-1 max-[599px]:hidden',
  error: 'text-[0.78rem] font-semibold text-danger',
  primary: 'inline-flex h-11 cursor-pointer items-center justify-center rounded-full border-0 bg-brand-primary px-6 text-[0.88rem] font-bold text-white hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50 max-[599px]:flex-1',
  secondary: 'inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-surface px-5 text-[0.88rem] font-bold text-app-ink hover:border-brand-primary hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50',
  quiet: 'inline-flex h-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent px-4 text-[0.88rem] font-bold text-ink-muted hover:text-app-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50 max-[599px]:border max-[599px]:border-line-strong max-[599px]:bg-surface max-[599px]:text-app-ink',
} as const
