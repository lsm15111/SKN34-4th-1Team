// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { appContainer } from './app/appContainer'
import { createAppStore } from './app/store'
import type { Account } from './domain/entities/Account'
import { sessionRestored } from './presentation/shared/auth/state/authSlice'

const business: Account = {
  email: 'biz@govbiz.local', role: 'USER', tier: 'MEMBER', emailVerified: true, hasPassword: true, company: null,
  accountType: 'BUSINESS', onboardingPurpose: 'FIND_PROGRAMS', onboarded: true,
}
const individual: Account = { ...business, email: 'solo@govbiz.local', accountType: 'INDIVIDUAL', onboardingPurpose: null }

function renderApp(account: Account) {
  const store = createAppStore()
  store.dispatch(sessionRestored(account))
  render(<Provider store={store}><MemoryRouter initialEntries={['/app/chat']}><App /></MemoryRouter></Provider>)
}

beforeEach(() => {
  vi.spyOn(appContainer.resolve('browseSavedSupportProgramsUseCase'), 'execute').mockResolvedValue([])
  vi.spyOn(appContainer.resolve('browsePartnerProposalsUseCase'), 'execute').mockResolvedValue({ proposals: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } as never)
  vi.spyOn(appContainer.resolve('applicationPreparationUseCase'), 'list').mockResolvedValue({ items: [], nextBeforeId: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.localStorage.clear() })

describe('사이드바 시작하기 체크리스트', () => {
  it('기업 회원은 기업 등록 전에는 제안 보내기가 이유와 함께 잠기고, 다음 할 일이 강조된다', async () => {
    renderApp(business)
    const card = await screen.findByRole('region', { name: '시작하기' })
    expect(within(card).getByText('0/4')).toBeTruthy()
    // 검색은 아직 대화가 없어 다음 할 일입니다.
    expect(within(card).getByRole('link', { name: /지원사업 검색해 보기/ }).getAttribute('aria-current')).toBe('step')
    expect(within(card).getByRole('link', { name: /기업 등록하기/ }).getAttribute('href')).toBe('/app/profile')
    const locked = within(card).getByText(/파트너에게 제안 보내기/).closest('span')!
    expect(locked.getAttribute('aria-disabled')).toBe('true')
    expect(within(card).getByText('기업 등록 뒤 열려요')).toBeTruthy()
  })

  it('개인 회원은 이용 목적·첫 신청 문서 항목을 보고, 닫으면 사라지며 계정 메뉴에서 다시 볼 수 있다', async () => {
    renderApp(individual)
    const card = await screen.findByRole('region', { name: '시작하기' })
    expect(within(card).getByRole('link', { name: /이용 목적 정하기/ }).getAttribute('href')).toBe('/app/welcome')
    expect(within(card).getByRole('link', { name: /첫 신청 문서 시작/ })).toBeTruthy()
    expect(within(card).queryByText(/기업 등록하기/)).toBeNull()

    fireEvent.click(within(card).getByRole('button', { name: '시작하기 닫기' }))
    expect(screen.queryByRole('region', { name: '시작하기' })).toBeNull()
    const sidebar = screen.getByRole('complementary', { name: '작업 사이드바' })
    fireEvent.click(within(sidebar).getByRole('button', { name: /계정 메뉴/ }))
    fireEvent.click(within(sidebar).getByRole('button', { name: '시작하기 다시 보기' }))
    expect(await screen.findByRole('region', { name: '시작하기' })).toBeTruthy()
  })

  it('담은 공고가 있으면 완료로 표시하고, 모두 마치면 카드가 사라진다', async () => {
    vi.spyOn(appContainer.resolve('browseSavedSupportProgramsUseCase'), 'execute').mockResolvedValue([{ id: 1 } as never])
    vi.spyOn(appContainer.resolve('applicationPreparationUseCase'), 'list').mockResolvedValue({ items: [{ id: 1 } as never], nextBeforeId: null })
    renderApp({ ...individual, onboardingPurpose: 'PREPARE_DOCUMENTS' })
    const card = await screen.findByRole('region', { name: '시작하기' })
    await waitFor(() => expect(within(card).getByText('3/4')).toBeTruthy())
    expect(within(card).getByText(/관심 공고 담기/).closest('span')?.className).toContain('line-through')
  })
})
