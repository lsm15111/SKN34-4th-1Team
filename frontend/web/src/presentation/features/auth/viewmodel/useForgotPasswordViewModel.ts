import { type FormEvent, useEffect, useRef, useState } from 'react'

import { appContainer } from '../../../../app/appContainer'
import { MAX_EMAIL_LENGTH, checkEmailAddress, type EmailAddressProblem } from '../../../../domain/entities/EmailAddress'
import type { RequestPasswordResetUseCase } from '../../../../domain/usecases/RequestPasswordResetUseCase'

type PasswordResetRequestUseCase = Pick<RequestPasswordResetUseCase, 'execute'>

export const forgotPasswordMessages = {
  emailRequired: '가입한 이메일을 입력해 주세요.',
  emailInvalid: '이메일 형식으로 입력해 주세요. 예: name@example.com',
  emailTooLong: `이메일은 ${MAX_EMAIL_LENGTH}자 이내로 입력해 주세요.`,
  emailNotRegistered: '가입되지 않은 이메일입니다. 주소를 다시 확인하거나 아래에서 회원가입해 주세요.',
  sent: '비밀번호 재설정 링크를 보냈습니다. 30분 안에 메일의 링크를 열어 주세요.',
  mailUnavailable: '지금은 재설정 메일을 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.',
  rateLimited: (retryAfterSeconds: number | null) =>
    retryAfterSeconds === null
      ? '요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요.'
      : `요청이 많아 잠시 막혔습니다. ${retryAfterSeconds}초 뒤에 다시 시도해 주세요.`,
  requestFailed: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
} as const

type ForgotPasswordError = { field: 'email' | null; message: string }

const emailProblemMessages: Record<EmailAddressProblem, string> = {
  empty: forgotPasswordMessages.emailRequired,
  'too-long': forgotPasswordMessages.emailTooLong,
  invalid: forgotPasswordMessages.emailInvalid,
}

/**
 * 비밀번호 찾기 화면의 대표 ViewModel입니다. 이메일 형식을 먼저 확인한 뒤 재설정 링크를 요청하고,
 * 가입되지 않은 이메일은 회원가입으로 안내합니다.
 */
export function useForgotPasswordViewModel(
  requestUseCase: PasswordResetRequestUseCase = appContainer.resolve('requestPasswordResetUseCase'),
) {
  const [email, setEmail] = useState('')
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState<ForgotPasswordError | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    // 브라우저 검사(type="email")는 user@localhost처럼 메일이 갈 수 없는 주소도 통과시키므로 공용 규칙으로 다시 봅니다.
    const problem = checkEmailAddress(email)
    if (problem !== null) {
      setError({ field: 'email', message: emailProblemMessages[problem] })
      ;(event.currentTarget.elements.namedItem('email') as HTMLInputElement | null)?.focus()
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await requestUseCase.execute(email)
      if (!isMounted.current) return
      if (result.outcome === 'not-registered') {
        setError({ field: 'email', message: forgotPasswordMessages.emailNotRegistered })
        return
      }
      if (result.outcome === 'rate-limited') {
        setError({ field: null, message: forgotPasswordMessages.rateLimited(result.retryAfterSeconds) })
        return
      }
      if (result.outcome === 'mail-unavailable') {
        setError({ field: null, message: forgotPasswordMessages.mailUnavailable })
        return
      }
      setIsSent(true)
    } catch {
      if (!isMounted.current) return
      setError({ field: null, message: forgotPasswordMessages.requestFailed })
    } finally {
      if (isMounted.current) setIsSubmitting(false)
    }
  }

  /** 입력 칸을 벗어날 때 형식을 미리 알립니다. 아직 아무것도 안 썼을 때는 재촉하지 않습니다. */
  function checkEmail() {
    if (!email.trim() || isSubmitting) return
    const problem = checkEmailAddress(email)
    setError(problem === null ? null : { field: 'email', message: emailProblemMessages[problem] })
  }

  return {
    email,
    isSent,
    error,
    isSubmitting,
    updateEmail: (value: string) => { setEmail(value); setError(null) },
    checkEmail,
    submit,
  }
}
