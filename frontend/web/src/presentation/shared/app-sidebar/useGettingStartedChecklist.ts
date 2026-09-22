import { useEffect, useState } from 'react'

import { appContainer } from '../../../app/appContainer'
import type { Account } from '../../../domain/entities/Account'
import type { ApplicationPreparationUseCase } from '../../../domain/usecases/ApplicationPreparationUseCase'
import type { BrowsePartnerProposalsUseCase } from '../../../domain/usecases/PartnerProposalUseCases'
import type { BrowseSavedSupportProgramsUseCase } from '../../../domain/usecases/SavedSupportProgramUseCases'
import { appPaths } from '../routes/appPaths'

export type GettingStartedItem = {
  key: 'search' | 'save' | 'purpose' | 'company' | 'document' | 'propose'
  label: string
  done: boolean
  /** 아직 할 수 없는 항목의 이유 한 줄입니다. 항목을 숨기지 않아 무엇이 열리는지 보이게 합니다. */
  lockedReason: string | null
  to: string
}

export type GettingStartedChecklist = {
  /** 환영 화면을 마치지 않았거나 닫았거나 모두 마친 뒤에는 카드를 그리지 않습니다. */
  isVisible: boolean
  isDismissed: boolean
  items: GettingStartedItem[]
  doneCount: number
  next: GettingStartedItem | null
  dismiss: () => void
  restore: () => void
}

const storageKeyFor = (email: string) => `govbiz.gettingStarted.closed:${email}`

function readDismissed(email: string): boolean {
  try { return window.localStorage.getItem(storageKeyFor(email)) === '1' } catch { return false }
}

function writeDismissed(email: string, closed: boolean) {
  try {
    if (closed) window.localStorage.setItem(storageKeyFor(email), '1')
    else window.localStorage.removeItem(storageKeyFor(email))
  } catch { /* 저장 못 하면 다음 방문에 다시 보일 뿐입니다. */ }
}

type Sources = {
  savedUseCase: Pick<BrowseSavedSupportProgramsUseCase, 'execute'>
  proposalsUseCase: Pick<BrowsePartnerProposalsUseCase, 'execute'>
  preparationUseCase: Pick<ApplicationPreparationUseCase, 'list'>
}

/**
 * 사이드바의 "시작하기" 체크리스트입니다. 항목은 4개이고 완료는 따로 체크하지 않고 데이터로 판정합니다
 * (검색 = 대화 기록 1개, 담기 = 관심 공고 1개, 기업 등록 = 계정의 기업, 제안·문서 = 실제 건 존재).
 * 개인 회원과 기업 회원의 4번째 항목이 다르고, 기업 전용 항목은 기업 등록 전에는 이유와 함께 잠깁니다.
 * 닫으면 계정별로 기억하고 계정 메뉴의 "시작하기 다시 보기"로 되돌립니다. 모두 마치면 사라집니다.
 */
export function useGettingStartedChecklist(
  account: Account | null,
  historyCount: number,
  sources: Sources = {
    savedUseCase: appContainer.resolve('browseSavedSupportProgramsUseCase'),
    proposalsUseCase: appContainer.resolve('browsePartnerProposalsUseCase'),
    preparationUseCase: appContainer.resolve('applicationPreparationUseCase'),
  },
): GettingStartedChecklist {
  const email = account?.email ?? null
  const type = account?.accountType ?? null
  const hasCompany = account?.company != null
  const [isDismissed, setIsDismissed] = useState(() => (email ? readDismissed(email) : false))
  const [hasSaved, setHasSaved] = useState(false)
  const [hasSent, setHasSent] = useState(false)
  const [hasDocument, setHasDocument] = useState(false)

  useEffect(() => {
    setIsDismissed(email ? readDismissed(email) : false)
  }, [email])

  // 온보딩을 마친 계정에서, 닫지 않았을 때만 데이터를 읽습니다. 실패하면 "아직"으로 두고 조용히 넘어갑니다.
  const active = account !== null && account.onboarded && type !== null && !isDismissed
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    void sources.savedUseCase.execute(controller.signal).then((saved) => { if (!controller.signal.aborted) setHasSaved(saved.length > 0) }).catch(() => {})
    if (type === 'BUSINESS' && hasCompany) {
      void sources.proposalsUseCase.execute('sent', controller.signal).then((page) => { if (!controller.signal.aborted) setHasSent(page.proposals.length > 0) }).catch(() => {})
    }
    if (type === 'INDIVIDUAL') {
      void sources.preparationUseCase.list(undefined, controller.signal).then((page) => { if (!controller.signal.aborted) setHasDocument(page.items.length > 0) }).catch(() => {})
    }
    return () => controller.abort()
    // sources는 컨테이너 싱글턴이라 의존성에서 뺍니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, type, hasCompany, email])

  const items: GettingStartedItem[] = account === null || type === null ? [] : [
    { key: 'search', label: '지원사업 검색해 보기', done: historyCount > 0, lockedReason: null, to: appPaths.chat },
    { key: 'save', label: '관심 공고 담기', done: hasSaved, lockedReason: null, to: appPaths.chat },
    ...(type === 'BUSINESS'
      ? [
        { key: 'company', label: '기업 등록하기', done: hasCompany, lockedReason: null, to: appPaths.profile } as GettingStartedItem,
        { key: 'propose', label: '파트너에게 제안 보내기', done: hasSent, lockedReason: hasCompany ? null : '기업 등록 뒤 열려요', to: appPaths.partners } as GettingStartedItem,
      ]
      : [
        { key: 'purpose', label: '이용 목적 정하기', done: account.onboardingPurpose !== null, lockedReason: null, to: appPaths.welcome } as GettingStartedItem,
        { key: 'document', label: '첫 신청 문서 시작', done: hasDocument, lockedReason: null, to: appPaths.applicationPreparations } as GettingStartedItem,
      ]),
  ]
  const doneCount = items.filter((item) => item.done).length
  const allDone = items.length > 0 && doneCount === items.length

  return {
    isVisible: active && !allDone,
    isDismissed,
    items,
    doneCount,
    next: items.find((item) => !item.done && item.lockedReason === null) ?? null,
    dismiss: () => { if (email) writeDismissed(email, true); setIsDismissed(true) },
    restore: () => { if (email) writeDismissed(email, false); setIsDismissed(false) },
  }
}
