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

const individual: Account = {
  email: 'solo@govbiz.local', role: 'USER', tier: 'MEMBER', emailVerified: false, hasPassword: false, company: null,
  accountType: 'INDIVIDUAL', onboardingPurpose: 'PREPARE_DOCUMENTS', onboarded: true,
}

function renderApp(path: string, account: Account = individual) {
  const store = createAppStore()
  store.dispatch(sessionRestored(account))
  render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>)
}

beforeEach(() => {
  vi.spyOn(appContainer.resolve('getMyCompanyUseCase'), 'execute').mockResolvedValue(null)
  vi.spyOn(appContainer.resolve('getCompanyPartnerProfileUseCase'), 'execute')
    .mockResolvedValue({ isSet: false, roles: [], interestAreas: [], introduction: '', capabilities: [], updatedAt: null })
  vi.spyOn(appContainer.resolve('browseSavedSupportProgramsUseCase'), 'execute').mockResolvedValue([])
  vi.spyOn(appContainer.resolve('applicationPreparationUseCase'), 'list').mockResolvedValue({ items: [], nextBeforeId: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('개인 회원', () => {
  it('사이드바의 협업 무리는 둘러보기만 열리고 이유를 한 줄로 보여 주며 제안함은 없다', async () => {
    renderApp('/app/chat')
    const sidebar = await screen.findByRole('complementary', { name: '작업 사이드바' })
    expect(within(sidebar).getByRole('link', { name: '파트너 모집 둘러보기' }).getAttribute('href')).toBe('/app/partners')
    expect(within(sidebar).getByText('모집글 작성·제안은 기업 회원으로 전환하고 기업을 등록하면 열려요')).toBeTruthy()
    expect(within(sidebar).queryByRole('link', { name: /제안함/ })).toBeNull()
  })

  it('프로필은 개인 회원 표시와 목적 기반 완성도 100%를 보여 주고, 전환 카드로 기업 회원이 된다', async () => {
    const complete = vi.spyOn(appContainer.resolve('completeOnboardingUseCase'), 'execute')
      .mockResolvedValue({ ...individual, accountType: 'BUSINESS' })
    renderApp('/app/profile')
    expect(await screen.findByText('개인 회원')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: '프로필 완성도' }).getAttribute('aria-valuenow')).toBe('100')
    const summary = screen.getByRole('region', { name: '프로필 요약' })
    expect(within(summary).getByText('이용 목적 정하기', { selector: 'span' })).toBeTruthy()
    expect(within(summary).queryByText('이메일 인증')).toBeNull()

    fireEvent.click(within(screen.getByRole('region', { name: '기업 회원으로 전환' })).getByRole('button', { name: '기업 회원으로 전환' }))
    // 문서 준비 목적은 기업에도 허용되므로 그대로 넘깁니다.
    await waitFor(() => expect(complete).toHaveBeenCalledWith({ accountType: 'BUSINESS', purpose: 'PREPARE_DOCUMENTS' }))
    expect(await screen.findByText('기업 회원')).toBeTruthy()
    expect(screen.queryByRole('region', { name: '기업 회원으로 전환' })).toBeNull()
    expect(screen.getByText(/사업자등록번호를 조회해 등록하면 기업 회원이 되어/)).toBeTruthy()
  })
})
