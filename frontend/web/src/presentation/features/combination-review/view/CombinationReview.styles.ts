const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary'

export const reviewStyles = {
  card: 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm',
  muted: 'text-sm leading-6 text-slate-600',
  button: 'inline-flex items-center justify-center rounded-lg border border-sample-border bg-white px-4 py-2 text-sm font-semibold hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-primary',
  primary: 'inline-flex items-center justify-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#066538] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-primary',
  danger: 'inline-flex items-center justify-center rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-700',
  input: 'mt-1 block w-full rounded-lg border border-sample-border bg-white p-2.5 text-sm focus:border-brand-primary focus:outline-brand-primary',
  warning: 'rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950',
  info: 'rounded-xl border border-info-line bg-info-soft p-4 text-sm leading-6 text-app-ink',
  // 목록 카드 · 단계 이동 바 · 결과 카드 (화면 통일안 27–29)
  secondarySm: `inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-line-strong bg-white px-3 text-[0.8125rem] font-bold text-app-ink no-underline hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  menuButton: `grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-line-strong bg-white text-base leading-none text-ink-muted hover:text-app-ink ${focus}`,
  menu: 'z-30 flex min-w-[180px] flex-col gap-0.5 rounded-xl border border-line bg-white p-1.5 shadow-[0_12px_32px_rgb(32_33_36_/_12%)]',
  menuItem: `flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 py-2 text-left text-[0.8125rem] font-semibold text-app-ink no-underline hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  menuItemDanger: 'text-red-800 hover:bg-red-50',
  dangerSolid: `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#9a3947] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7f2d39] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
  stepBar: 'sticky bottom-0 z-[2] flex flex-wrap items-center gap-3 border-t border-line bg-[rgb(245_246_247_/_96%)] pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur',
  stepBarNote: 'text-xs text-ink-muted max-[599px]:hidden',
  badge: 'inline-flex h-[22px] items-center gap-1 rounded-md px-[7px] text-[0.72rem] font-bold whitespace-nowrap',
  badgeWarn: 'bg-warning-soft text-warning',
  badgeOk: 'bg-brand-soft text-brand-primary',
  badgeInfo: 'bg-info-soft text-info',
  badgeNeutral: 'bg-surface-muted text-ink-muted',
  textLink: `inline-flex items-center gap-1 text-xs font-bold text-brand-primary no-underline hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${focus}`,
} as const
