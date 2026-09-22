import { useState } from 'react'
import { useNavigate } from 'react-router'

import { appContainer } from '../../../../app/appContainer'
import { useAppDispatch } from '../../../../app/hooks'
import type { AccountType, OnboardingPurpose } from '../../../../domain/entities/Account'
import type { CompleteOnboardingUseCase } from '../../../../domain/usecases/AccountProfileUseCases'
import { useAuthSession } from '../../../shared/auth/hooks/useAuthSession'
import { signedIn } from '../../../shared/auth/state/authSlice'
import { firstScreenFor, purposeOptionsFor } from './onboardingOptions'

export const welcomeMessages = {
  saveFailed: '답을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
} as const

/**
 * 최초 로그인 환영 화면입니다. 1단계 회원 유형은 건너뛸 수 없고(앱 구조가 갈리는 답), 2단계 이용 목적은 건너뛸 수 있습니다.
 * 답은 서버에 저장되고 세션 계정에 바로 반영되어 다시 이 화면으로 오지 않습니다. 이미 답한 계정이 다시 열면 기존 답이 채워져 있습니다.
 */
export function useWelcomeViewModel(
  completeOnboardingUseCase: Pick<CompleteOnboardingUseCase, 'execute'> = appContainer.resolve('completeOnboardingUseCase'),
) {
  const { account } = useAuthSession()
  const navigate = useNavigate()
  const dispatchToStore = useAppDispatch()
  const [step, setStep] = useState<1 | 2>(1)
  // 기본은 진입 장벽이 낮은 개인입니다.
  const [type, setType] = useState<AccountType>(account?.accountType ?? 'INDIVIDUAL')
  const [purpose, setPurpose] = useState<OnboardingPurpose | null>(account?.onboardingPurpose ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function chooseType(next: AccountType) {
    setType(next)
    // 유형을 바꾸면 그 유형에 없는 목적은 지웁니다.
    if (purpose !== null && !purposeOptionsFor(next).some((option) => option.value === purpose)) setPurpose(null)
  }

  async function finish(chosenPurpose: OnboardingPurpose | null) {
    setIsSaving(true)
    setError(null)
    try {
      const updated = await completeOnboardingUseCase.execute({ accountType: type, purpose: chosenPurpose })
      dispatchToStore(signedIn(updated))
      navigate(firstScreenFor(chosenPurpose), { replace: true })
    } catch {
      setError(welcomeMessages.saveFailed)
      setIsSaving(false)
    }
  }

  return {
    step,
    type,
    purpose,
    purposeOptions: purposeOptionsFor(type),
    isSaving,
    error,
    chooseType,
    choosePurpose: setPurpose,
    goToPurposeStep: () => setStep(2),
    goBackToTypeStep: () => setStep(1),
    /** 목적을 고르지 않고 시작합니다. */
    skipPurpose: () => void finish(null),
    /** 고른 목적으로 시작합니다. 고른 것이 없으면 건너뛰기와 같습니다. */
    start: () => void finish(purpose),
  }
}
