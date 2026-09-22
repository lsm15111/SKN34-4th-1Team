import type { AccountType, OnboardingPurpose } from '../../../../domain/entities/Account'
import { onboardingPurposesFor } from '../../../../domain/entities/Account'
import { appPaths } from '../../../shared/routes/appPaths'

/** 선택 카드에 붙는 아이콘 이름입니다. 아티팩트의 아이콘 세트와 같은 이름을 씁니다. */
export type OnboardingIcon = 'user' | 'building' | 'spark' | 'search' | 'doc' | 'users' | 'shield'

/** 환영 화면 1단계 선택지입니다. 내부 이름 대신 판단 기준("사업자등록번호가 있으면")을 사용자 말로 줍니다. */
export const accountTypeOptions: { value: AccountType; icon: OnboardingIcon; title: string; description: string; note: string }[] = [
  {
    value: 'INDIVIDUAL',
    icon: 'user',
    title: '개인 회원',
    description: '예비창업자·프리랜서·1인 사업자. 창업 지원사업과 개인 대상 지원금을 찾아요.',
    note: '사업자등록번호 없이 바로 시작',
  },
  {
    value: 'BUSINESS',
    icon: 'building',
    title: '기업 회원',
    description: '사업자등록번호로 기업을 등록하면 컨소시엄 모집글과 제안까지 쓸 수 있어요.',
    note: '등록은 프로필에서 한 번만',
  },
]

export type PurposeOption = {
  value: OnboardingPurpose
  icon: OnboardingIcon
  title: string
  description: string
  /** 고르면 처음 여는 화면 이름입니다. */
  firstScreen: string
  /** 처음 여는 화면 경로입니다. */
  route: string
  /** 검색 화면에 채울 예시 검색 3개입니다. */
  chips: [string, string, string]
}

/**
 * 유형별 2단계 선택지입니다(아티팩트 "최초 로그인 온보딩"의 PURPOSES 그대로).
 * "신청 서류"는 같은 값(PREPARE_DOCUMENTS)이지만 개인은 문서 초안, 기업은 문서·중복 검토로 문구가 다릅니다.
 */
const purposeOptionsByType: Record<AccountType, PurposeOption[]> = {
  INDIVIDUAL: [
    {
      value: 'FIND_STARTUP_PROGRAMS', icon: 'spark', title: '창업 지원사업 찾기',
      description: '예비창업패키지처럼 사업자 없이 신청하는 공고를 먼저 보여 드려요.',
      firstScreen: '대화 검색', route: appPaths.chat,
      chips: ['예비창업자가 받을 수 있는 지원사업', '사업자 없이 신청하는 창업 지원', '청년 창업 지원금'],
    },
    {
      value: 'CHECK_GRANT_ELIGIBILITY', icon: 'search', title: '받을 수 있는 지원금 확인',
      description: '지역·나이·업종으로 신청 자격이 되는 지원금을 추려 드려요.',
      firstScreen: '대화 검색', route: appPaths.chat,
      chips: ['서울 30대가 받을 수 있는 지원금', '프리랜서 지원금 자격', '경기 청년 지원금'],
    },
    {
      value: 'PREPARE_DOCUMENTS', icon: 'doc', title: '신청 서류 준비',
      description: '담아 둔 공고의 공식 양식에 맞춰 문서 초안을 시작해요.',
      firstScreen: '신청 문서 작성', route: appPaths.applicationPreparations,
      chips: ['예비창업패키지 사업계획서 양식', '창업 지원사업 제출 서류', '청년 창업 지원금'],
    },
  ],
  BUSINESS: [
    {
      value: 'FIND_PROGRAMS', icon: 'search', title: '맞는 지원사업 찾기',
      description: '지역·업종·필요한 지원을 말하면 접수 중인 공고와 신청 조건을 찾아 드려요.',
      firstScreen: '대화 검색', route: appPaths.chat,
      chips: ['경기 제조 스마트공장 지원', '수출 바우처 신청 자격', '청년 채용 장려금'],
    },
    {
      value: 'FIND_PARTNERS', icon: 'users', title: '함께 신청할 기업 찾기',
      description: '공고에 묶인 컨소시엄 모집글을 보고 제안을 주고받아요.',
      firstScreen: '파트너 모집', route: appPaths.partners,
      chips: ['컨소시엄이 필요한 지원사업', '스마트공장 공동 신청', 'AI 바우처 공급기업'],
    },
    {
      value: 'PREPARE_DOCUMENTS', icon: 'shield', title: '신청 문서·중복 검토',
      description: '담아 둔 공고로 중복 지원을 검토하고 공식 양식에 맞춰 문서를 시작해요.',
      firstScreen: '신청 문서 작성', route: appPaths.applicationPreparations,
      chips: ['스마트공장 사업계획서 양식', '중복 수혜 제한 조항', '수출 바우처 제출 서류'],
    },
  ],
}

/** 유형에 허용된 이용 목적만 순서대로 돌려줍니다. 기업 전용인 "함께 신청할 기업 찾기"는 개인에게 보이지 않습니다. */
export function purposeOptionsFor(type: AccountType): PurposeOption[] {
  const allowed = onboardingPurposesFor(type)
  return purposeOptionsByType[type].filter((option) => allowed.includes(option.value))
}

/** 목적을 건너뛰었을 때의 예시 검색입니다(아티팩트 DEFAULT_CHIPS). */
export function defaultChipsFor(type: AccountType): [string, string, string] {
  return type === 'INDIVIDUAL'
    ? ['예비창업자 지원사업', '청년 지원금 자격', '1인 사업자 지원']
    : ['경기 제조 스마트공장 지원', '수출 바우처 신청 자격', '청년 채용 장려금']
}

/** 목적에 맞는 예시 검색입니다. 같은 목적이라도 유형에 따라 문구가 다르므로 유형을 함께 받습니다. */
export function purposeChipsFor(purpose: OnboardingPurpose, type: AccountType): [string, string, string] {
  const option = purposeOptionsByType[type].find((candidate) => candidate.value === purpose)
    ?? purposeOptionsByType.INDIVIDUAL.find((candidate) => candidate.value === purpose)
    ?? purposeOptionsByType.BUSINESS.find((candidate) => candidate.value === purpose)
  return option?.chips ?? defaultChipsFor(type)
}

/** 목적별 첫 화면입니다. 건너뛰면 대화 검색입니다. */
export function firstScreenFor(purpose: OnboardingPurpose | null, type: AccountType): string {
  if (purpose === null) return appPaths.chat
  return purposeOptionsByType[type].find((option) => option.value === purpose)?.route ?? appPaths.chat
}
