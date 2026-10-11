// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { createAppStore } from '../../../../app/store'
import { appContainer } from '../../../../app/appContainer'
import { supportProgramClient } from '../../../../data/api/supportProgramClient'
import { emptyConversationContext, readyConversationProposal } from '../../../../data/fixtures/supportProgramConversation'
import { supportPrograms } from '../../../../data/fixtures/supportPrograms'
import { completeSearchResult } from '../../../../data/fixtures/supportProgramSearchResult'
import { signedIn } from '../../../shared/auth/state/authSlice'
import { conversationHistoryOpened, createChatConversationSnapshot } from '../state/chatSlice'
import { RouteDocumentTitle } from '../../../shared/routes/RouteDocumentTitle'
import { SupportProgramSearchPage } from '../../support-program-catalog/view/SupportProgramSearchPage'

vi.mock('../hooks/useSupportProgramSearchReadiness', () => ({ useSupportProgramSearchReadiness: () => ({
  canSearch: true, isError: false, isInitialLoading: false, isRefreshing: false, refetch: vi.fn(), data: { searchState: 'SEARCHABLE' },
}) }))
vi.mock('../viewmodel/useSearchResultInterests', async (importOriginal) => ({
  ...await importOriginal<typeof import('../viewmodel/useSearchResultInterests')>(), useSearchResultInterests: () => null,
}))
vi.mock('../../../shared/plan-usage/usePlanUsage', () => ({ usePlanUsage: () => ({ usage: null, reload: vi.fn() }) }))
vi.mock('../../combination-review/view/CombinationReviewPages', () => ({
  CombinationReviewPanel: ({ id, onCreated }: { id: number | null; onCreated: (id: number) => void }) => (
    <section aria-label="대화 중복 검토"><p>{id === null ? '새 검토' : `저장된 검토 ${id}`}</p>
      <button onClick={() => onCreated(12)}>검토 저장</button></section>
  ),
}))
vi.mock('../../partner-recruitment/view/PartnerRecruitmentListPage', () => ({
  PartnerRecruitmentPanel: () => <section aria-label="대화 파트너 조회">전체 모집글 패널</section>,
}))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup(role: 'ADMIN' | 'USER') {
  const store = createAppStore()
  store.dispatch(signedIn({ email: 'test@govbiz.local', role, tier: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
    emailVerified: true, hasPassword: true, accountType: null, onboarded: true, company: null }))
  render(<Provider store={store}><MemoryRouter initialEntries={['/app/chat']}>
    <RouteDocumentTitle /><SupportProgramSearchPage layout="workspace" />
  </MemoryRouter></Provider>)
  return store
}

it('관리자는 검색 확인 후 같은 입력창에서 선택 공고의 근거를 읽는다', async () => {
  const gov = vi.spyOn(supportProgramClient, 'sendGovAgentMessage').mockResolvedValue({ outcome: 'SEARCH',
    interpretation: readyConversationProposal({ ...emptyConversationContext, query: 'AI 창업' }) })
  const search = vi.spyOn(appContainer.resolve('searchSupportProgramsUseCase'), 'execute')
    .mockResolvedValue(completeSearchResult({ query: 'AI 창업', programs: [supportPrograms[0]] }))
  setup('ADMIN')
  expect(screen.getByRole('tab', { name: 'Gov 에이전트' })).toBeTruthy()
  expect(document.title).toBe('Gov 에이전트 · GovBiz')
  const input = screen.getByRole('textbox', { name: '지원사업 검색어' })
  fireEvent.change(input, { target: { value: 'AI 창업지원 찾아줘' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '검색 전송' })))
  expect(search).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '이 조건으로 검색' })))
  fireEvent.click(screen.getByRole('button', { name: '이 공고 선택' }))
  expect(screen.getByText('선택한 공고:')).toBeTruthy()
  const program = supportPrograms[0]
  gov.mockResolvedValue({ outcome: 'EVIDENCE', program: { sourceCode: program.sourceCode, sourceProgramId: program.id },
    evidence: { answer: '누리집에서 신청하세요.', answerStatus: 'ANSWERED', citations: [{ excerpt: '누리집 온라인 신청',
      sourceUrl: program.sourceUrl, sourceLabel: '기업마당 상세 본문', chunkOrder: 0 }] } })
  fireEvent.change(input, { target: { value: '신청 방법은?' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '검색 전송' })))
  expect(screen.getByText('누리집에서 신청하세요.')).toBeTruthy()
  expect(screen.getByRole('link', { name: /근거 1.*기업마당/ }).getAttribute('href')).toBe(program.sourceUrl)
  expect(screen.getByRole('textbox', { name: '지원사업 검색어' })).toBe(input)
  expect(search).toHaveBeenCalledOnce()
})

it('일반 회원은 AI 대화 검색 이름을 유지한다', () => {
  setup('USER')
  expect(screen.getByRole('tab', { name: 'AI 대화 검색' })).toBeTruthy()
  expect(screen.queryByRole('tab', { name: 'Gov 에이전트' })).toBeNull()
  expect(screen.queryByText(/선택한 공고:/)).toBeNull()
  expect(document.title).toBe('AI 대화 검색 · GovBiz')
})

it('관리자는 대화에서 검토 건을 저장·복원하고 파트너 조회로 전환하면 이전 검토를 링크로 남긴다', async () => {
  const gov = vi.spyOn(supportProgramClient, 'sendGovAgentMessage').mockResolvedValue({
    outcome: 'COMBINATION_REVIEW', program: null, message: '비교할 공고를 선택하세요.',
  })
  const store = setup('ADMIN')
  const input = screen.getByRole('textbox', { name: '지원사업 검색어' })
  fireEvent.change(input, { target: { value: '중복 지원 검토해줘' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '검색 전송' })))
  expect(screen.getByRole('region', { name: '대화 중복 검토' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '검토 저장' }))
  expect(screen.getByText('저장된 검토 12')).toBeTruthy()
  const snapshot = createChatConversationSnapshot(store.getState().chat)
  act(() => store.dispatch(conversationHistoryOpened({ accountEmail: 'test@govbiz.local', snapshot })))
  expect(screen.getByText('저장된 검토 12')).toBeTruthy()
  expect(gov).toHaveBeenCalledOnce()
  gov.mockResolvedValue({ outcome: 'PARTNERS', message: '전체 모집글에서 찾아보세요.' })
  fireEvent.change(input, { target: { value: '파트너 모집글 찾아줘' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: '검색 전송' })))
  expect(screen.queryByRole('region', { name: '대화 중복 검토' })).toBeNull()
  expect(screen.getByRole('link', { name: '중복 검토 화면에서 이어서 보기' }).getAttribute('href')).toBe('/app/combination-reviews/12')
  expect(screen.getByRole('region', { name: '대화 파트너 조회' })).toBeTruthy()
  expect(screen.getByRole('textbox', { name: '지원사업 검색어' })).toBe(input)
})

it('일반 회원에게 저장된 Gov 카드가 있어도 실행 패널을 열지 않는다', () => {
  const gov = vi.spyOn(supportProgramClient, 'sendGovAgentMessage')
  const store = setup('USER')
  const snapshot = createChatConversationSnapshot(store.getState().chat)
  snapshot.messages = [...snapshot.messages,
    { id: 'review', role: 'assistant', text: '중복 검토', govReview: { program: null, message: '중복 검토', reviewId: 12 } },
    { id: 'partners', role: 'assistant', text: '파트너 조회', govPartners: { message: '모집글' } },
  ]
  act(() => store.dispatch(conversationHistoryOpened({ accountEmail: 'test@govbiz.local', snapshot })))
  expect(screen.queryByRole('region', { name: '대화 중복 검토' })).toBeNull()
  expect(screen.queryByRole('region', { name: '대화 파트너 조회' })).toBeNull()
  expect(gov).not.toHaveBeenCalled()
})
