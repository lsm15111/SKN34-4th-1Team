/** 관리자는 서버에서 SQL이나 개발용 로그인으로만 지정됩니다. */
export type AccountRole = 'USER' | 'ADMIN'

/**
 * 화면 권한을 정하는 확인 단계입니다. 서버가 계정 상태로 계산해 내려 주며 앱은 이 값을 믿고 라우트를 지킵니다.
 * `COMPANY`는 사업자등록번호 조회를 통과한 기업을 등록하면 내려옵니다.
 */
export type AccountTier = 'MEMBER' | 'COMPANY' | 'ADMIN'

/** 환영 화면에서 고르는 회원 유형입니다. 사업자등록번호가 있으면 기업, 아직 없으면 개인입니다. */
export type AccountType = 'INDIVIDUAL' | 'BUSINESS'

/** 환영 화면 2단계의 이용 목적입니다. 유형마다 고를 수 있는 값이 다르고 건너뛸 수 있습니다. */
export type OnboardingPurpose =
  | 'FIND_STARTUP_PROGRAMS'
  | 'CHECK_GRANT_ELIGIBILITY'
  | 'FIND_PROGRAMS'
  | 'FIND_PARTNERS'
  | 'PREPARE_DOCUMENTS'

const purposesByType: Record<AccountType, OnboardingPurpose[]> = {
  INDIVIDUAL: ['FIND_STARTUP_PROGRAMS', 'CHECK_GRANT_ELIGIBILITY', 'PREPARE_DOCUMENTS'],
  BUSINESS: ['FIND_PROGRAMS', 'FIND_PARTNERS', 'PREPARE_DOCUMENTS'],
}

/** 유형에 허용된 이용 목적입니다. 서버와 같은 규칙이라 화면이 고를 수 없는 값을 보여 주지 않습니다. */
export function onboardingPurposesFor(type: AccountType): OnboardingPurpose[] {
  return purposesByType[type]
}

export function isOnboardingPurposeAllowed(type: AccountType, purpose: OnboardingPurpose): boolean {
  return purposesByType[type].includes(purpose)
}

/** 로그인한 계정입니다. 비밀번호·토큰은 포함하지 않습니다. */
export type Account = {
  email: string
  role: AccountRole
  tier: AccountTier
  emailVerified: boolean
  /** 등록한 기업 요약입니다. 없으면 null이며 사이드바는 이메일만 보여 줍니다. */
  company: AccountCompanySummary | null
  /** 거짓이면 소셜 로그인으로만 가입해 비밀번호가 없는 계정입니다. 프로필은 비밀번호 항목을 숨기고 계정 삭제는 비밀번호를 묻지 않습니다. */
  hasPassword: boolean
  /** 환영 화면에서 고른 회원 유형입니다. 아직이면 null입니다. */
  accountType: AccountType | null
  /** 환영 화면에서 고른 이용 목적입니다. 건너뛰었거나 아직이면 null입니다. */
  onboardingPurpose: OnboardingPurpose | null
  /** 거짓이면 로그인 뒤 다른 작업 화면보다 먼저 `/app/welcome`을 보여 줍니다. */
  onboarded: boolean
}

export type AccountCompanySummary = {
  companyName: string
  businessNumber: string
}

const tierRank: Record<AccountTier, number> = { MEMBER: 1, COMPANY: 2, ADMIN: 3 }

/** 계정이 요구 단계 이상인지 확인합니다. 관리자는 모든 단계를 포함합니다. */
export function meetsTier(account: Account, minimum: AccountTier): boolean {
  return tierRank[account.tier] >= tierRank[minimum]
}
