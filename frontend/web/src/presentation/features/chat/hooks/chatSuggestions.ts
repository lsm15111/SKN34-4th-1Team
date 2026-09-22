import type { Account } from '../../../../domain/entities/Account'
import { defaultChipsFor, purposeChipsFor } from '../../onboarding/viewmodel/onboardingOptions'
import { supportProgramChatSuggestions } from './useSupportProgramChat'

/**
 * 검색 첫 화면의 예시 검색 3개입니다. 환영 화면의 답이 있으면 그 목적에 맞는 예시를, 유형만 있으면 유형 기본 예시를,
 * 비로그인이나 아직 답하지 않은 계정에는 지금까지의 고정 예시를 보여 줍니다. "내 회사와 무슨 상관"이 보이게 하는 가장 싼 방법입니다.
 */
export function chatSuggestionsFor(account: Account | null): readonly string[] {
  if (account?.onboardingPurpose) return purposeChipsFor(account.onboardingPurpose)
  if (account?.accountType) return defaultChipsFor(account.accountType)
  return supportProgramChatSuggestions
}
