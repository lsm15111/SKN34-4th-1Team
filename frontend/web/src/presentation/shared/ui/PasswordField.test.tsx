// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PasswordField } from './PasswordField'

describe('PasswordField', () => {
  afterEach(cleanup)

  it('버튼을 누르면 글자를 보였다가 다시 가리고 눌림 상태를 알린다', () => {
    render(<label>비밀번호<PasswordField className="control" name="password" defaultValue="secret-1" /></label>)
    const input = screen.getByLabelText('비밀번호') as HTMLInputElement
    expect(input.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 표시' }))
    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: '비밀번호 숨기기' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: '비밀번호 숨기기' }))
    expect(input.type).toBe('password')
  })

  it('표시한 채로 폼을 제출하면 다시 가린다', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <form onSubmit={onSubmit} aria-label="로그인">
        <label>비밀번호<PasswordField className="control" name="password" /></label>
        <button type="submit">제출</button>
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 표시' }))
    expect((screen.getByLabelText('비밀번호') as HTMLInputElement).type).toBe('text')
    fireEvent.submit(screen.getByRole('form', { name: '로그인' }))
    expect(onSubmit).toHaveBeenCalled()
    expect((screen.getByLabelText('비밀번호') as HTMLInputElement).type).toBe('password')
  })
})
