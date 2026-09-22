import { Link } from 'react-router'

import type { GettingStartedChecklist } from './useGettingStartedChecklist'

const s = {
  card: 'my-2 flex flex-col gap-2 rounded-panel border border-line bg-surface px-3 py-2.5 shadow-card',
  head: 'flex items-center gap-2 text-[0.8rem] font-extrabold text-app-ink',
  count: 'ml-auto text-[0.75rem] font-bold text-ink-muted tabular-nums',
  close: 'grid size-6 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-subtle hover:bg-surface-muted hover:text-app-ink',
  bar: 'h-1 overflow-hidden rounded-full bg-surface-muted',
  fill: 'block h-full rounded-full bg-brand-primary transition-[width]',
  list: 'm-0 flex list-none flex-col gap-0.5 p-0',
  item: 'flex min-h-7 items-center gap-2 rounded-md px-1 text-[0.8rem] text-app-ink no-underline',
  itemDone: 'text-ink-muted line-through decoration-line-strong',
  itemNext: 'bg-brand-soft font-bold text-brand-primary',
  itemLocked: 'text-ink-subtle',
  check: 'grid size-3.5 shrink-0 place-items-center rounded-full border-[1.5px] border-line-strong text-[0.55rem] text-white',
  checkDone: 'border-brand-primary bg-brand-primary',
  checkNext: 'border-brand-primary',
  reason: 'ml-auto text-[0.68rem] font-semibold text-ink-subtle',
} as const

/** 사이드바 주 동작 바로 아래에 오는 "시작하기" 카드입니다. 다음 할 일을 강조하고, 잠긴 항목은 이유를 한 줄로 보여 줍니다. */
export function GettingStartedCard({ checklist }: { checklist: GettingStartedChecklist }) {
  if (!checklist.isVisible) return null
  const total = checklist.items.length
  return (
    <section className={s.card} aria-label="시작하기">
      <div className={s.head}>
        시작하기
        <span className={s.count}>{checklist.doneCount}/{total}</span>
        <button type="button" className={s.close} aria-label="시작하기 닫기" title="계정 메뉴에서 다시 볼 수 있어요" onClick={checklist.dismiss}>✕</button>
      </div>
      <div className={s.bar} role="progressbar" aria-label="시작하기 진행" aria-valuemin={0} aria-valuemax={total} aria-valuenow={checklist.doneCount}>
        <span className={s.fill} style={{ width: `${total === 0 ? 0 : Math.round((checklist.doneCount / total) * 100)}%` }} />
      </div>
      <ol className={s.list}>
        {checklist.items.map((item) => {
          const isNext = checklist.next?.key === item.key
          const className = `${s.item} ${item.done ? s.itemDone : isNext ? s.itemNext : item.lockedReason ? s.itemLocked : ''}`
          const content = (
            <>
              <span className={`${s.check} ${item.done ? s.checkDone : isNext ? s.checkNext : ''}`} aria-hidden="true">{item.done ? '✓' : ''}</span>
              {item.label}
              {item.lockedReason ? <span className={s.reason}>{item.lockedReason}</span> : null}
            </>
          )
          return (
            <li key={item.key}>
              {item.done || item.lockedReason ? <span className={className} aria-disabled={item.lockedReason ? 'true' : undefined}>{content}</span>
                : <Link className={className} to={item.to} aria-current={isNext ? 'step' : undefined}>{content}</Link>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
