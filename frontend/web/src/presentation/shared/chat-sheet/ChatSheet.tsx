import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react'

import { appSidebarStyles } from '../app-sidebar/AppSidebar.styles'
import { useResetScrollOnNavigate } from '../routes/useResetScrollOnNavigate'
import { ChatSheetCloseContext } from './useChatSheet'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
/**
 * 대화 위에 띄우는 큰 시트입니다. 데스크톱은 위·양옆으로 뒤의 대화가 비치게 화면 대부분을 덮고, 600px 미만은 화면 전체를 덮습니다.
 * 최대 폭(1180px)은 1440px 화면에서 사이드바를 뺀 작업 칸 폭과 같아, 머리글·본문이 전체 화면과 같은 줄바꿈으로 보입니다.
 * 시트는 틀만 두고 따로 머리 줄을 붙이지 않습니다. 안의 화면은 전체 화면과 같은 모양 그대로이고, 화면의 원래 맨 위 줄이
 * 닫기를 맡습니다(작업 화면 머리글 오른쪽 끝의 [닫기], 공고 상세의 "‹ 공고 상세"). 이름은 [kind]로 대화상자에 붙입니다.
 * [전체 화면으로 열기]는 주석 처리해 두었습니다. 다시 쓰려면 머리글 [닫기] 옆에 버튼을 두고 App의 `onExpand` 주석을 풉니다.
 * Esc · 바깥 누르기 · [닫기]로 닫고, 열 때 시트에, 닫으면 연 요소로 포커스를 돌려줍니다. 안에서 연 확인 모달이 먼저 Esc · Tab을 받습니다.
 */
export function ChatSheet({ kind, onClose, children }: {
  kind: string; onClose: () => void; /* onExpand: () => void; */ children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // 시트 안에서 다른 화면으로 옮기면 시트 칸을 맨 위로 돌립니다(뒤의 대화 스크롤은 그대로).
  useResetScrollOnNavigate(bodyRef)
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus({ preventScroll: true })
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !panelRef.current) return
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(32_33_36_/_48%)] min-[600px]:px-6 min-[600px]:pt-[4vh]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={kind} tabIndex={-1} onKeyDown={handleKeyDown}
        className="flex h-full w-full max-w-[1180px] min-w-0 flex-col overflow-hidden bg-white shadow-[0_24px_60px_rgb(0_0_0_/_28%)] focus:outline-0 min-[600px]:rounded-t-[1.1rem]">
        {/* [전체 화면으로 열기](주석 처리): <button type="button" onClick={onExpand} aria-label="전체 화면으로 열기" title="전체 화면으로 열기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button> */}
        <ChatSheetCloseContext.Provider value={onClose}>
          <div ref={bodyRef} className={`${appSidebarStyles.workspace} overscroll-contain`}>{children}</div>
        </ChatSheetCloseContext.Provider>
      </div>
    </div>
  )
}
