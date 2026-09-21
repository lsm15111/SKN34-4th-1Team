import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'

/**
 * 비밀번호 입력칸입니다. 오른쪽 끝의 버튼으로 입력한 글자를 보이게 하거나 다시 가립니다.
 * KRDS 로그인 패턴이 요구하는 표시 토글입니다. 상태는 버튼의 aria-pressed와 이름으로 전합니다.
 * 라벨이 입력칸을 감싸는 화면이 있어 라벨 글자에 섞이는 별도 안내 문구는 두지 않습니다.
 * 표시한 채로 제출하면 다른 사람이 볼 수 있으므로 폼이 제출되는 순간 다시 가립니다.
 */
type PasswordFieldProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  /** 입력칸 자체에 붙일 클래스입니다. 화면의 다른 입력칸과 같은 모양을 물려받습니다. */
  className: string
}

const toggleClassName = [
  'absolute top-1/2 right-2 inline-flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full',
  'border-0 bg-transparent text-ink-muted hover:bg-surface-muted hover:text-app-ink',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary',
].join(' ')

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <path d="M4 4l16 16" />}
    </svg>
  )
}

export function PasswordField({ className, ...inputProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 표시 상태로 제출하면 화면에 비밀번호가 남으므로 폼 제출 때 가립니다. 폼이 없으면 아무것도 하지 않습니다.
  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const hide = () => setIsVisible(false)
    form.addEventListener('submit', hide)
    return () => form.removeEventListener('submit', hide)
  }, [])

  return (
    <div className="relative">
      <input ref={inputRef} {...inputProps} className={`${className} pr-14`} type={isVisible ? 'text' : 'password'} />
      <button
        type="button"
        className={toggleClassName}
        aria-pressed={isVisible}
        aria-label={isVisible ? '비밀번호 숨기기' : '비밀번호 표시'}
        onClick={() => setIsVisible((value) => !value)}
      >
        <EyeIcon open={isVisible} />
      </button>
    </div>
  )
}
