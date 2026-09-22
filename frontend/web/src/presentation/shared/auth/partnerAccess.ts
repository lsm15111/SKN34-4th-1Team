import { type Account, hasActiveBusiness } from '../../../domain/entities/Account'

/**
 * 파트너 모집글 작성·수정·마감과 제안 보내기가 잠긴 이유입니다. 둘러보기와 이미 받은 제안 읽기는 누구나 됩니다.
 * 회원 유형·기업 유무·사업자 상태 세 가지로 정하며, 사이드바·파트너 머리글·작성 화면·제안 폼이 같은 이유를 보여 줍니다.
 * 서버는 이 판단을 믿지 않고 쓰기 API마다 `COMPANY_REQUIRED`·`ACTIVE_BUSINESS_REQUIRED`로 다시 검사합니다.
 */
export type PartnerWriteLock = {
  kind: 'individual' | 'unregistered' | 'suspended'
  /** 사이드바 메뉴 아래 한 줄입니다. */
  reason: string
  /** 작성 화면·제안 폼의 안내 제목과 본문입니다. */
  title: string
  body: string
  /** 잠금을 푸는 곳으로 가는 링크 글자입니다. 세 경우 모두 프로필입니다. */
  actionLabel: string
}

export const partnerLockMessages = {
  individual: {
    reason: '기업 회원으로 전환하면 모집글·제안을 쓸 수 있어요',
    title: '기업을 등록한 뒤 모집글과 제안을 쓸 수 있습니다',
    body: '개인 회원은 모집글을 둘러볼 수 있어요. 프로필에서 사업자등록번호를 조회해 기업을 등록하면 모집글 작성과 제안까지 열려요.',
    actionLabel: '프로필에서 기업 등록',
  },
  unregistered: {
    reason: '프로필에서 사업자등록번호를 등록하면 열려요',
    title: '기업을 등록한 뒤 모집글을 쓸 수 있습니다',
    body: '모집글에는 사업자등록번호 조회로 확인한 기업명이 표시됩니다. 프로필에서 사업자등록번호를 조회하고 기업을 등록해 주세요.',
    actionLabel: '프로필에서 기업 등록',
  },
  suspended: {
    reason: '모집글·제안은 계속사업자만 쓸 수 있어요',
    title: '계속사업자만 쓸 수 있어요',
    body: '휴업 상태의 기업은 모집글을 올리거나 제안을 보낼 수 없어요. 상태가 바뀌면 프로필에서 다시 확인해 주세요.',
    actionLabel: '프로필에서 기업 정보 확인',
  },
} as const

export function partnerWriteLockFor(account: Account | null): PartnerWriteLock | null {
  if (account === null) return null
  if (hasActiveBusiness(account)) return null
  const kind: PartnerWriteLock['kind'] = account.company !== null ? 'suspended' : account.accountType === 'INDIVIDUAL' ? 'individual' : 'unregistered'
  return { kind, ...partnerLockMessages[kind] }
}

/** 파트너 머리글·내 모집글의 작성 버튼 글자입니다. 잠긴 이유에 따라 무엇을 먼저 해야 하는지 말합니다. */
export function partnerWriteLockedLabel(lock: PartnerWriteLock | null): string {
  if (lock === null) return '모집글 작성'
  return lock.kind === 'suspended' ? '계속사업자만 작성' : '기업 등록 후 작성'
}
