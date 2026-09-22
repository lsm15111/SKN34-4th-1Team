// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { appContainer } from './app/appContainer'
import { createAppStore } from './app/store'
import { partnerRecruitmentDetail, partnerRecruitmentPage } from './data/fixtures/partnerRecruitments'
import type { Account } from './domain/entities/Account'
import { sessionRestored } from './presentation/shared/auth/state/authSlice'

vi.mock('./presentation/shared/core-api-status/CoreApiConnectionStatus', () => ({
  CoreApiConnectionStatus: () => null,
}))

const base = { email: 'member@govbiz.local', role: 'USER' as const, emailVerified: true, hasPassword: true, onboarded: true }
const individual: Account = { ...base, tier: 'MEMBER', accountType: 'INDIVIDUAL', company: null }
const unregistered: Account = { ...base, tier: 'MEMBER', accountType: 'BUSINESS', company: null }
const suspended: Account = { ...base, tier: 'COMPANY', accountType: 'BUSINESS', company: { companyName: '한빛정밀', businessNumber: '1112233334', businessStatusCode: '02' } }
const active: Account = { ...base, tier: 'COMPANY', accountType: 'BUSINESS', company: { companyName: '테스트 기업 주식회사', businessNumber: '1234567890', businessStatusCode: '01' } }

function renderApp(path: string, account: Account) {
  const store = createAppStore()
  store.dispatch(sessionRestored(account))
  render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>)
}

function sidebar() {
  return screen.getByRole('complementary', { name: '작업 사이드바' })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
  vi.spyOn(appContainer.resolve('browsePartnerRecruitmentsUseCase'), 'execute').mockResolvedValue(partnerRecruitmentPage)
  vi.spyOn(appContainer.resolve('getPartnerRecruitmentDetailUseCase'), 'execute').mockResolvedValue(partnerRecruitmentDetail)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('파트너 기능 잠금 이유', () => {
  it('개인 회원은 파트너 관리 메뉴가 둘러보기로 열리고 기업 회원 전환 안내가 붙는다', async () => {
    renderApp('/app/partners', individual)
    const menu = within(sidebar()).getByRole('link', { name: /파트너 관리/ })
    expect(menu.getAttribute('href')).toBe('/app/partners')
    expect(within(menu).getByText('둘러보기')).toBeTruthy()
    expect(within(sidebar()).getByText('기업 회원으로 전환하면 모집글·제안을 쓸 수 있어요')).toBeTruthy()
    expect(screen.getByRole('link', { name: '기업 등록 후 작성' }).getAttribute('href')).toBe('/app/profile')
    await screen.findByRole('article', { name: /AI 실증 과제/ })
  })

  it('기업 미등록 회원은 프로필 등록 안내를, 계속사업자는 잠금 없이 작성 버튼을 본다', async () => {
    renderApp('/app/partners', unregistered)
    expect(within(sidebar()).getByText('프로필에서 사업자등록번호를 등록하면 열려요')).toBeTruthy()
    expect(screen.getByRole('link', { name: '기업 등록 후 작성' })).toBeTruthy()
    cleanup()

    renderApp('/app/partners', active)
    expect(within(sidebar()).queryByText(/쓸 수 있어요|열려요/)).toBeNull()
    expect(within(sidebar()).queryByText('둘러보기')).toBeNull()
    expect(screen.getByRole('link', { name: '모집글 작성' }).getAttribute('href')).toBe('/app/partners/new')
  })

  it('휴업 기업은 모집글 작성 화면 대신 계속사업자 안내를 보고, 내 모집글이 비어 있으면 같은 이유를 본다', async () => {
    renderApp('/app/partners/new', suspended)
    expect(within(sidebar()).getByText('모집글·제안은 계속사업자만 쓸 수 있어요')).toBeTruthy()
    const guard = screen.getByRole('region', { name: '계속사업자만 작성 가능' })
    expect(within(guard).getByRole('heading', { name: '계속사업자만 쓸 수 있어요' })).toBeTruthy()
    expect(within(guard).getByText(/휴업 상태의 기업은 모집글을 올리거나 제안을 보낼 수 없어요/)).toBeTruthy()
    expect(within(guard).getByRole('link', { name: '프로필에서 기업 정보 확인' }).getAttribute('href')).toBe('/app/profile')
    expect(screen.queryByRole('form', { name: '모집글 작성' })).toBeNull()
    cleanup()

    vi.spyOn(appContainer.resolve('browsePartnerRecruitmentsUseCase'), 'execute')
      .mockResolvedValue({ recruitments: [], total: 0, page: 1, pageSize: 12, totalPages: 0 })
    renderApp('/app/partners/mine', suspended)
    const empty = await screen.findByRole('region', { name: '내 모집글 없음' })
    expect(within(empty).getByText(/휴업 상태의 기업은 모집글을 올리거나 제안을 보낼 수 없어요/)).toBeTruthy()
    expect(within(empty).getByRole('link', { name: '계속사업자만 작성' }).getAttribute('href')).toBe('/app/profile')
  })

  it('휴업 기업은 모집글 상세에서 제안 폼이 잠기고 이유를 본다', async () => {
    renderApp('/app/partners/detail?recruitmentId=101', suspended)
    const proposalForm = await screen.findByRole('form', { name: '참여 제안' })
    expect(within(proposalForm).getByText(/휴업 상태의 기업은 모집글을 올리거나 제안을 보낼 수 없어요/)).toBeTruthy()
    expect(within(proposalForm).getByRole('link', { name: '프로필에서 기업 정보 확인' }).getAttribute('href')).toBe('/app/profile')
    expect((within(proposalForm).getByRole('button', { name: '참여 제안 보내기' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('서버가 계속사업자만 허용한다고 거절하면 제안 폼에 같은 이유를 보여 준다', async () => {
    vi.spyOn(appContainer.resolve('sendPartnerProposalUseCase'), 'execute').mockResolvedValue({ outcome: 'active-business-required' })
    renderApp('/app/partners/detail?recruitmentId=101', active)
    const proposalForm = await screen.findByRole('form', { name: '참여 제안' })
    fireEvent.change(within(proposalForm).getByLabelText('제안 메시지'), { target: { value: '함께 하고 싶습니다.' } })
    fireEvent.click(within(proposalForm).getByRole('button', { name: '참여 제안 보내기' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('계속사업자만'))
  })

  it('프로필 요약은 휴업 기업에 주의 배지와 파트너 잠금 안내를 붙인다', async () => {
    vi.spyOn(appContainer.resolve('getMyCompanyUseCase'), 'execute').mockResolvedValue({
      businessNumber: '1112233334', companyName: '한빛정밀', businessStatus: '휴업자', businessStatusCode: '02',
      region: '경기도', industry: '제조업', foundedYear: 2015, homepageUrl: null,
      businessVerifiedAt: '2026-09-22T10:00:00', updatedAt: '2026-09-22T10:00:00',
    })
    renderApp('/app/profile', suspended)
    const summary = await screen.findByRole('region', { name: '프로필 요약' })
    expect(within(summary).getByText('휴업자')).toBeTruthy()
    expect(within(summary).getByText(/국세청 상태가 휴업이라 파트너 모집글·제안은 잠겨 있어요/)).toBeTruthy()
  })
})
