// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { appContainer } from './app/appContainer'
import { createAppStore } from './app/store'
import type { Account } from './domain/entities/Account'
import { sessionRestored } from './presentation/shared/auth/state/authSlice'

const freshAccount: Account = {
  email: 'new@govbiz.local', role: 'USER', tier: 'MEMBER', emailVerified: true, hasPassword: true, company: null,
  accountType: null, onboardingPurpose: null, onboarded: false,
}

function Location() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

function renderApp(path: string, account: Account) {
  const store = createAppStore()
  store.dispatch(sessionRestored(account))
  render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /><Location /></MemoryRouter></Provider>)
  return store
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('최초 로그인 환영 화면', () => {
  it('아직 답하지 않은 계정은 어떤 작업 화면을 열어도 환영 화면을 먼저 보고, 사이드바와 도우미는 없다', async () => {
    renderApp('/app/saved-programs', freshAccount)
    expect(await screen.findByRole('heading', { name: '어떤 회원으로 시작할까요?' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/app/welcome')
    expect(screen.queryByRole('complementary', { name: '작업 사이드바' })).toBeNull()
    expect(screen.queryByRole('button', { name: /도우미/ })).toBeNull()
  })

  it('개인 회원을 고르면 기업 전용 목적은 보이지 않고, 목적을 고르면 저장한 뒤 그 첫 화면으로 간다', async () => {
    const complete = vi.spyOn(appContainer.resolve('completeOnboardingUseCase'), 'execute')
      .mockResolvedValue({ ...freshAccount, accountType: 'INDIVIDUAL', onboardingPurpose: 'PREPARE_DOCUMENTS', onboarded: true })
    renderApp('/app/chat', freshAccount)
    await screen.findByRole('heading', { name: '어떤 회원으로 시작할까요?' })
    // 기본 선택은 진입 장벽이 낮은 개인입니다.
    expect((screen.getByRole('radio', { name: /개인 회원/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '다음' }))

    expect(screen.getByRole('heading', { name: '무엇을 하러 오셨나요?' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: /함께 신청할 기업 찾기/ })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /신청 서류 준비/ }))
    fireEvent.click(screen.getByRole('button', { name: '이대로 시작하기' }))

    await waitFor(() => expect(complete).toHaveBeenCalledWith({ accountType: 'INDIVIDUAL', purpose: 'PREPARE_DOCUMENTS' }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/app/application-preparations'))
    // 답이 세션에 반영되어 작업 화면(사이드바)이 열립니다.
    expect(await screen.findByRole('complementary', { name: '작업 사이드바' })).toBeTruthy()
  })

  it('기업 회원은 목적을 건너뛸 수 있고 검색 화면에서 시작한다', async () => {
    const complete = vi.spyOn(appContainer.resolve('completeOnboardingUseCase'), 'execute')
      .mockResolvedValue({ ...freshAccount, accountType: 'BUSINESS', onboarded: true })
    renderApp('/app/chat', freshAccount)
    fireEvent.click(await screen.findByRole('radio', { name: /기업 회원/ }))
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByRole('radio', { name: /함께 신청할 기업 찾기/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }))
    await waitFor(() => expect(complete).toHaveBeenCalledWith({ accountType: 'BUSINESS', purpose: null }))
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/app/chat'))
  })

  it('이미 답한 계정은 환영 화면으로 보내지 않는다', async () => {
    renderApp('/app/saved-programs', { ...freshAccount, accountType: 'BUSINESS', onboarded: true })
    expect(await screen.findByRole('heading', { name: '관심 공고함' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/app/saved-programs')
  })
})

describe('예시 검색 칩', () => {
  it('환영 화면의 목적에 맞는 예시를 검색 첫 화면에 보여 준다', async () => {
    renderApp('/app/chat', { ...freshAccount, accountType: 'INDIVIDUAL', onboardingPurpose: 'PREPARE_DOCUMENTS', onboarded: true })
    expect(await screen.findByRole('button', { name: '사업계획서 양식이 있는 공고' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '서울 AI 창업지원 사업 찾아줘' })).toBeNull()
  })

  it('목적을 건너뛴 개인 회원은 개인 기본 예시를, 답하지 않은 계정은 고정 예시를 본다', async () => {
    renderApp('/app/chat', { ...freshAccount, accountType: 'INDIVIDUAL', onboarded: true })
    expect(await screen.findByRole('button', { name: '예비창업자 지원사업' })).toBeTruthy()
    cleanup()
    renderApp('/app/chat', { ...freshAccount, onboarded: true })
    expect(await screen.findByRole('button', { name: '서울 AI 창업지원 사업 찾아줘' })).toBeTruthy()
  })
})
