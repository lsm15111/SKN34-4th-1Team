import type { AccountType, OnboardingPurpose } from '../../../../domain/entities/Account'
import { onboardingPurposesFor } from '../../../../domain/entities/Account'
import { appPaths } from '../../../shared/routes/appPaths'

/** 환영 화면 1단계 선택지입니다. 내부 이름 대신 판단 기준("사업자등록번호가 있으면")을 사용자 말로 줍니다. */
export const accountTypeOptions: { value: AccountType; title: string; description: string; note: string }[] = [
  {
    value: 'INDIVIDUAL',
    title: '개인 회원',
    description: '예비창업자·프리랜서·1인 사업자. 창업 지원사업과 개인 대상 지원금을 찾아요.',
    note: '사업자등록번호 없이 바로 시작',
  },
  {
    value: 'BUSINESS',
    title: '기업 회원',
    description: '사업자등록번호로 기업을 등록하면 컨소시엄 모집글과 제안까지 쓸 수 있어요.',
    note: '등록은 프로필에서 한 번만',
  },
]

type PurposeOption = {
  value: OnboardingPurpose
  title: string
  description: string
  /** 고르면 처음 여는 화면 이름입니다. */
  firstScreen: string
  /** 처음 여는 화면 경로입니다. */
  route: string
  /** 검색 화면에 채울 예시 검색 3개입니다. */
  chips: [string, string, string]
}

const purposeOptions: Record<OnboardingPurpose, Omit<PurposeOption, 'value'>> = {
  FIND_STARTUP_PROGRAMS: {
    title: '창업 지원사업 찾기',
    description: '예비창업패키지처럼 사업자 없이 신청하는 공고를 먼저 보여 드려요.',
    firstScreen: '지원사업 검색', route: appPaths.chat,
    chips: ['예비창업자 지원사업', '청년 창업 지원금', '사업자 없이 신청 가능한 창업 공고'],
  },
  CHECK_GRANT_ELIGIBILITY: {
    title: '받을 수 있는 지원금 확인',
    description: '지역·나이·업종으로 신청 자격이 되는 지원금을 추려 드려요.',
    firstScreen: '지원사업 검색', route: appPaths.chat,
    chips: ['청년 지원금 자격', '1인 사업자 지원', '프리랜서 대상 지원사업'],
  },
  FIND_PROGRAMS: {
    title: '맞는 지원사업 찾기',
    description: '지역·업종·필요한 지원을 말하면 접수 중인 공고와 신청 조건을 찾아 드려요.',
    firstScreen: '지원사업 검색', route: appPaths.chat,
    chips: ['경기 제조 스마트공장 지원', '수출 바우처 신청 자격', '청년 채용 장려금'],
  },
  FIND_PARTNERS: {
    title: '함께 신청할 기업 찾기',
    description: '공고에 묶인 컨소시엄 모집글을 보고 제안을 주고받아요.',
    firstScreen: '파트너 모집', route: appPaths.partners,
    chips: ['컨소시엄 참여 가능 공고', '공동 R&D 과제 모집', '수요처 매칭 지원사업'],
  },
  PREPARE_DOCUMENTS: {
    title: '신청 서류 준비·중복 검토',
    description: '담아 둔 공고로 중복 지원을 검토하고 공식 양식에 맞춰 문서를 시작해요.',
    firstScreen: '신청 문서 작성', route: appPaths.applicationPreparations,
    chips: ['사업계획서 양식이 있는 공고', '중복 수혜 제한 조항', '접수 중인 바우처 사업'],
  },
}

/** 유형에 허용된 이용 목적만 순서대로 돌려줍니다. 기업 전용인 "함께 신청할 기업 찾기"는 개인에게 보이지 않습니다. */
export function purposeOptionsFor(type: AccountType): PurposeOption[] {
  return onboardingPurposesFor(type).map((value) => ({ value, ...purposeOptions[value] }))
}

/** 목적을 건너뛰었을 때의 첫 화면과 예시 검색입니다. */
export function defaultChipsFor(type: AccountType): [string, string, string] {
  return type === 'INDIVIDUAL'
    ? ['예비창업자 지원사업', '청년 지원금 자격', '1인 사업자 지원']
    : ['경기 제조 스마트공장 지원', '수출 바우처 신청 자격', '청년 채용 장려금']
}

export function firstScreenFor(purpose: OnboardingPurpose | null): string {
  return purpose === null ? appPaths.chat : purposeOptions[purpose].route
}
