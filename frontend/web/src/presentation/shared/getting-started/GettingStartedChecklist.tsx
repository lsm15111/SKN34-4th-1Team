import { type Ref, useId } from 'react'
import { Link, useLocation } from 'react-router'
import { gettingStartedProgress } from '@govbiz/shared/domain/entities/GettingStarted'

import { gettingStartedStyles as s } from './GettingStarted.styles'
import { type GettingStartedItem, gettingStartedItems, gettingStartedMessages, isGettingStartedHiddenOn } from './gettingStartedView'
import { useGettingStartedActions, useGettingStartedGuide } from './useGettingStarted'

/**
 * 사이드바 "시작하기" 체크리스트입니다. 서버가 계산한 단계를 순서대로 보여 주고 다음 할 일 하나만 강조합니다.
 * 읽는 중·읽기 실패·숨김(`visible` 거짓)이면 아무것도 그리지 않습니다(자리 표시·스피너 없음). 먼저 열리거나 말을 걸지 않고,
 * 신청 문서·중복 검토·모집글을 쓰는 화면에서는 두지 않습니다. [닫기]는 서버에 닫은 시각만 남기고, 계정 메뉴의
 * "시작하기 다시 보기"로 다시 엽니다.
 */
export function GettingStartedChecklist({ headingRef, onClosed }: {
  /** 다시 보기로 연 뒤 초점을 둘 제목입니다. */
  headingRef?: Ref<HTMLHeadingElement>
  /** 닫은 뒤 초점을 옮길 곳을 부르는 쪽이 정합니다. */
  onClosed?: () => void
}) {
  const guide = useGettingStartedGuide()
  const actions = useGettingStartedActions()
  const titleId = useId()
  const { pathname } = useLocation()
  if (guide === null || !guide.visible || isGettingStartedHiddenOn(pathname)) return null

  const { done, total } = gettingStartedProgress(guide)
  const items = gettingStartedItems(guide)

  async function close() {
    if (await actions.close()) onClosed?.()
  }

  return (
    <section className={s.section} aria-labelledby={titleId}>
      <div className={s.header}>
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className={s.title}>{gettingStartedMessages.title}</h2>
        <span className={s.progress}>{gettingStartedMessages.progress(done, total)}</span>
        <button type="button" className={s.closeButton} aria-label={gettingStartedMessages.closeLabel}
          title="계정 메뉴에서 다시 볼 수 있어요" disabled={actions.pending === 'close'} onClick={() => { void close() }}>
          {actions.pending === 'close' ? gettingStartedMessages.closing : gettingStartedMessages.close}
        </button>
      </div>
      {actions.failed === 'close' ? <p className={s.error} role="alert">{gettingStartedMessages.closeFailed}</p> : null}
      {done === total ? <p className={s.done}>{gettingStartedMessages.allDone}</p> : null}
      <ol className={s.list}>
        {items.map((item) => <li key={item.id}><ChecklistRow item={item} /></li>)}
      </ol>
    </section>
  )
}

function ChecklistRow({ item }: { item: GettingStartedItem }) {
  const content = (
    <>
      <StatusMark item={item} />
      <span className={s.body}>
        <span className={item.status === 'DONE' ? s.labelDone : item.status === 'LOCKED' ? s.labelLocked : s.label}>
          {item.label}
          <span className="sr-only"> · {item.statusText}</span>
        </span>
        {item.note !== null ? <span className={s.note}>{item.note}</span> : null}
      </span>
    </>
  )
  if (item.to === null) return <div className={s.row}>{content}</div>
  return (
    <Link className={`${s.row} ${s.rowLink} ${item.isNext ? s.rowNext : ''}`} to={item.to} aria-current={item.isNext ? 'step' : undefined}>
      {content}
    </Link>
  )
}

/** 상자 모양으로도 상태를 구분합니다. 끝냄은 체크, 잠김은 자물쇠, 할 일은 빈 상자(다음 할 일은 브랜드 테두리)입니다. */
function StatusMark({ item }: { item: GettingStartedItem }) {
  const variant = item.status === 'DONE' ? s.markDone : item.status === 'LOCKED' ? s.markLocked : item.isNext ? s.markNext : s.markTodo
  return (
    <span className={`${s.mark} ${variant}`} aria-hidden="true">
      {item.status === 'DONE' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      ) : item.status === 'LOCKED' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
      ) : null}
    </span>
  )
}
