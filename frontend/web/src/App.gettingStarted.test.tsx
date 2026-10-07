// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GettingStartedGuide } from '@govbiz/shared/domain/entities/GettingStarted'

import App from './App'
import { appContainer } from './app/appContainer'
import { createAppStore } from './app/store'
import type { Account } from './domain/entities/Account'
import { assistantMessages } from './presentation/shared/assistant/assistantMessages'
import { sessionRestored } from './presentation/shared/auth/state/authSlice'

vi.mock('./presentation/shared/core-api-status/CoreApiConnectionStatus', () => ({ CoreApiConnectionStatus: () => null }))

const member: Account = {
  email: 'member@govbiz.local', role: 'USER', tier: 'COMPANY', emailVerified: true, hasPassword: true, accountType: 'BUSINESS', onboarded: true,
  company: { companyName: '넥스트웨이브 주식회사', businessNumber: '2148812034', businessStatusCode: '01' },
}
const businessGuide: GettingStartedGuide = {
  visible: true,
  closed: false,
  completedAt: null,
  steps: [
    { id: 'SIGN_UP', status: 'DONE' },
    { id: 'COMPANY', status: 'DONE' },
    { id: 'SAVE_PROGRAM', status: 'TODO' },
    { id: 'DEADLINE_REMINDER', status: 'TODO' },
    { id: 'DAILY_REPORT', status: 'TODO' },
    { id: 'START_PREPARATION', status: 'TODO' },
  ],
}
const lockedGuide: GettingStartedGuide = {
  ...businessGuide,
  steps: businessGuide.steps.map((step) => step.id === 'COMPANY' ? { ...step, status: 'TODO' } : step.id === 'DAILY_REPORT' ? { ...step, status: 'LOCKED' } : step),
}
const closedGuide: GettingStartedGuide = { ...businessGuide, visible: false, closed: true }
/** 늘 보이는 도움말 주제입니다. 시작하기가 제공될 때만 "계정·기업"이 이 뒤에 붙습니다. */
const baseTopicLabels = ['지원사업 검색', '관심 공고·리포트', '중복 검토·신청 문서', '파트너·기업 등록']
const gettingStartedSummary = '사이드바 "시작하기"에 할 일이 순서대로 있어요. 맨 위의 끝나지 않은 일부터 하면 돼요.'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
  vi.stubEnv('VITE_ASSISTANT_AI_ENABLED', '')
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function renderApp(path: string, account: Account | null = member) {
  const store = createAppStore()
  store.dispatch(sessionRestored(account))
  render(<Provider store={store}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></Provider>)
  return store
}

function sidebar() {
  return screen.getByRole('complementary', { name: '작업 사이드바' })
}

function quickReplyLabels(panel: HTMLElement) {
  return within(within(panel).getByRole('group', { name: '빠른 답변' })).getAllByRole('button').map((button) => button.textContent)
}

function gettingStartedUseCase() {
  return appContainer.resolve('gettingStartedUseCase')
}

describe('사이드바 시작하기', () => {
  it('읽는 동안과 읽지 못했을 때는 자리 표시 없이 그리지 않는다', async () => {
    let finish!: (value: GettingStartedGuide) => void
    vi.spyOn(gettingStartedUseCase(), 'guide').mockReturnValue(new Promise<GettingStartedGuide>((resolve) => { finish = resolve }))
    renderApp('/app/partners')

    expect(sidebar()).toBeTruthy()
    expect(within(sidebar()).queryByRole('heading', { name: '시작하기' })).toBeNull()
    expect(within(sidebar()).queryByRole('status')).toBeNull()
    await act(async () => { finish(businessGuide) })
    expect(within(sidebar()).getByRole('heading', { name: '시작하기' })).toBeTruthy()
    cleanup()

    vi.spyOn(gettingStartedUseCase(), 'guide').mockRejectedValue(new Error('down'))
    renderApp('/app/partners')
    await act(async () => {})
    expect(within(sidebar()).queryByRole('heading', { name: '시작하기' })).toBeNull()
    expect(within(sidebar()).queryByRole('alert')).toBeNull()
  })

  it('진행 수와 단계 목록을 보여 주고 다음 할 일만 강조하며 끝낸 단계는 글자로도 완료를 알린다', async () => {
    vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(businessGuide)
    renderApp('/app/partners')

    const section = await within(sidebar()).findByRole('region', { name: '시작하기' })
    expect(within(section).getByText('2/6 완료')).toBeTruthy()
    const items = within(within(section).getByRole('list')).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '회원가입 · 완료',
      '기업 등록하기 · 완료',
      '관심 공고 담기 · 다음 할 일검색 결과에서 [관심]을 눌러 담아요.',
      '마감 알림 켜기 · 할 일',
      '맞춤 리포트 받기 · 할 일',
      '신청 준비 시작하기 · 할 일',
    ])
    // 가입은 갈 화면이 없어 링크가 아니고, 나머지는 그 일을 하는 화면을 엽니다.
    expect(within(items[0]!).queryByRole('link')).toBeNull()
    const next = within(items[2]!).getByRole('link')
    expect(next.getAttribute('href')).toBe('/app/chat')
    expect(next.getAttribute('aria-current')).toBe('step')
    expect(next.className).toContain('bg-brand-soft')
    expect(within(items[3]!).getByRole('link').getAttribute('aria-current')).toBeNull()
    expect(within(items[3]!).getByRole('link').getAttribute('href')).toBe('/app/profile')
    expect(within(items[5]!).getByRole('link').getAttribute('href')).toBe('/app/saved-programs?view=pipeline')
    // 끝낸 단계는 지운 줄로 남깁니다.
    expect(within(items[1]!).getByText('기업 등록하기').className).toContain('line-through')
  })

  it('기업이 없으면 맞춤 리포트를 링크 없이 잠그고 이유를 한 줄로 보여 준다', async () => {
    vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(lockedGuide)
    renderApp('/app/partners')

    const section = await within(sidebar()).findByRole('region', { name: '시작하기' })
    const report = within(section).getAllByRole('listitem')[4]!
    expect(report.textContent).toBe('맞춤 리포트 받기 · 잠김기업을 등록하면 받을 수 있어요.')
    expect(within(report).queryByRole('link')).toBeNull()
    const company = within(section).getAllByRole('listitem')[1]!
    expect(within(company).getByRole('link').getAttribute('aria-current')).toBe('step')
    expect(within(section).getByText('1/6 완료')).toBeTruthy()
  })

  it('닫으면 서버에 저장하고 계정 메뉴로 초점을 옮기며, 계정 메뉴의 다시 보기로 다시 연다', async () => {
    vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(businessGuide)
    const close = vi.spyOn(gettingStartedUseCase(), 'close').mockResolvedValue(closedGuide)
    const reopen = vi.spyOn(gettingStartedUseCase(), 'reopen').mockResolvedValue(businessGuide)
    renderApp('/app/partners')

    const section = await within(sidebar()).findByRole('region', { name: '시작하기' })
    fireEvent.click(within(section).getByRole('button', { name: '시작하기 닫기' }))
    await waitFor(() => expect(within(sidebar()).queryByRole('region', { name: '시작하기' })).toBeNull())
    expect(close).toHaveBeenCalledTimes(1)
    const accountButton = within(sidebar()).getByRole('button', { name: /계정 메뉴/ })
    expect(document.activeElement).toBe(accountButton)

    fireEvent.click(accountButton)
    const menu = within(sidebar()).getByLabelText('계정 메뉴')
    fireEvent.click(within(menu).getByRole('button', { name: '시작하기 다시 보기' }))
    const reopened = await within(sidebar()).findByRole('region', { name: '시작하기' })
    expect(reopen).toHaveBeenCalledTimes(1)
    expect(within(sidebar()).queryByLabelText('계정 메뉴')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(within(reopened).getByRole('heading', { name: '시작하기' })))
  })

  it('닫지 못하면 안내를 남기고 체크리스트를 그대로 둔다', async () => {
    vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(businessGuide)
    vi.spyOn(gettingStartedUseCase(), 'close').mockRejectedValue(new Error('down'))
    renderApp('/app/partners')

    const section = await within(sidebar()).findByRole('region', { name: '시작하기' })
    fireEvent.click(within(section).getByRole('button', { name: '시작하기 닫기' }))
    expect((await within(section).findByRole('alert')).textContent).toBe('닫지 못했어요. 잠시 후 다시 눌러 주세요.')
    expect(within(sidebar()).getByRole('region', { name: '시작하기' })).toBeTruthy()
  })

  it('모두 마치면 완료 안내를 한 줄 두고, 모집글을 쓰는 화면에서는 시작하기를 두지 않는다', async () => {
    const done: GettingStartedGuide = { ...businessGuide, completedAt: '2026-10-08T20:30:00+09:00', steps: businessGuide.steps.map((step) => ({ ...step, status: 'DONE' })) }
    vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(done)
    renderApp('/app/partners')

    const section = await within(sidebar()).findByRole('region', { name: '시작하기' })
    expect(within(section).getByText('6/6 완료')).toBeTruthy()
    expect(within(section).getByText('모두 마쳤어요. 하루 뒤에 사라져요.')).toBeTruthy()
    expect(within(section).queryByRole('link', { current: 'step' })).toBeNull()
    cleanup()

    vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(businessGuide)
    renderApp('/app/partners/new')
    await act(async () => {})
    expect(within(sidebar()).queryByRole('region', { name: '시작하기' })).toBeNull()
  })

  it('기간이 지나거나 대상이 아니면(둘 다 거짓) 체크리스트도 다시 보기도 두지 않는다', async () => {
    vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue({ ...businessGuide, visible: false, closed: false })
    renderApp('/app/partners')
    await act(async () => {})

    expect(within(sidebar()).queryByRole('region', { name: '시작하기' })).toBeNull()
    fireEvent.click(within(sidebar()).getByRole('button', { name: /계정 메뉴/ }))
    expect(within(within(sidebar()).getByLabelText('계정 메뉴')).queryByRole('button', { name: '시작하기 다시 보기' })).toBeNull()
  })
})

describe('도우미 "다음에 뭘 하면 되나요?"', () => {
  it('시작하기가 보이는 동안 바로 확인 맨 앞에 두고, 누르면 모델 없이 다음 단계와 화면 버튼으로 답한다', async () => {
    const read = vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(businessGuide)
    const ask = vi.spyOn(appContainer.resolve('askAssistantUseCase'), 'execute')
    renderApp('/app/partners')
    await within(sidebar()).findByRole('region', { name: '시작하기' })

    fireEvent.click(screen.getByRole('button', { name: assistantMessages.openLauncher }))
    // 패널을 열면 시작하기를 다시 읽습니다.
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    const panel = screen.getByRole('dialog', { name: assistantMessages.name })
    expect(quickReplyLabels(panel)).toEqual([
      ...baseTopicLabels, '계정·기업', assistantMessages.quickGettingStarted, assistantMessages.quickSavedPrograms, assistantMessages.quickReceivedProposals,
    ])

    fireEvent.click(within(panel).getByRole('button', { name: assistantMessages.quickGettingStarted }))
    const log = within(panel).getByRole('log', { name: '대화' })
    expect(within(log).getByText('다음은 ‘관심 공고 담기’예요.')).toBeTruthy()
    expect(within(log).getByText('담은 공고는 마감 알림과 신청 준비로 이어져요.')).toBeTruthy()
    expect(within(log).getByText('내 이용 현황 기준 · 시작하기 2/6')).toBeTruthy()
    const button = within(log).getByRole('link', { name: '검색 화면 보기' })
    expect(button.getAttribute('href')).toBe('/app/chat')
    expect(ask).not.toHaveBeenCalled()

    // 버튼은 화면만 열고 패널을 닫습니다.
    fireEvent.click(button)
    expect(screen.queryByRole('dialog', { name: assistantMessages.name })).toBeNull()
  })

  it('닫아 둔 동안은 "다음에 뭘 하면 되나요?"를 두지 않고, 계정·기업 주제와 찾는 말로 시작하기 도움말을 연다', async () => {
    const read = vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(closedGuide)
    renderApp('/app/partners')
    await waitFor(() => expect(read).toHaveBeenCalled())
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: assistantMessages.openLauncher }))
    const panel = screen.getByRole('dialog', { name: assistantMessages.name })
    await act(async () => {})
    expect(within(panel).queryByRole('button', { name: assistantMessages.quickGettingStarted })).toBeNull()
    expect(quickReplyLabels(panel)).toEqual([...baseTopicLabels, '계정·기업', assistantMessages.quickSavedPrograms, assistantMessages.quickReceivedProposals])

    fireEvent.click(within(panel).getByRole('button', { name: '계정·기업' }))
    fireEvent.click(within(panel).getByRole('button', { name: '처음인데 뭐부터 하면 되나요?' }))
    const log = within(panel).getByRole('log', { name: '대화' })
    expect(within(log).getByText(gettingStartedSummary)).toBeTruthy()
    expect(within(log).getByText(assistantMessages.helpSource('처음이라면 무엇부터 하나요'))).toBeTruthy()

    const input = within(panel).getByRole('textbox', { name: assistantMessages.placeholder })
    fireEvent.change(input, { target: { value: '다음에 뭘 해요?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(within(log).getAllByText(gettingStartedSummary)).toHaveLength(2)
  })

  it('시작하기가 제공되지 않으면(visible·closed 모두 거짓) 계정·기업 주제·찾는 말·알약에 시작하기 도움말이 없다', async () => {
    const read = vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue({ ...businessGuide, visible: false, closed: false })
    const ask = vi.spyOn(appContainer.resolve('askAssistantUseCase'), 'execute')
    renderApp('/app/partners')
    await waitFor(() => expect(read).toHaveBeenCalled())
    await act(async () => {})

    fireEvent.click(screen.getByRole('button', { name: assistantMessages.openLauncher }))
    const panel = screen.getByRole('dialog', { name: assistantMessages.name })
    await act(async () => {})
    expect(quickReplyLabels(panel)).toEqual([...baseTopicLabels, assistantMessages.quickSavedPrograms, assistantMessages.quickReceivedProposals])

    const input = within(panel).getByRole('textbox', { name: assistantMessages.placeholder })
    fireEvent.change(input, { target: { value: '처음인데 뭐부터 해요?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const log = within(panel).getByRole('log', { name: '대화' })
    expect(within(log).getByText(assistantMessages.freeTextPreparing)).toBeTruthy()
    expect(within(log).queryByText(gettingStartedSummary)).toBeNull()
    expect(quickReplyLabels(panel)).not.toContain('계정·기업')
    expect(ask).not.toHaveBeenCalled()
  })

  it('비로그인에는 계정·기업 주제가 없고 찾는 말로도 시작하기 도움말을 찾지 않는다', async () => {
    const read = vi.spyOn(gettingStartedUseCase(), 'guide')
    renderApp('/pricing', null)

    fireEvent.click(screen.getByRole('button', { name: assistantMessages.openLauncher }))
    const panel = screen.getByRole('dialog', { name: assistantMessages.name })
    expect(quickReplyLabels(panel)).toEqual([...baseTopicLabels, assistantMessages.quickLoginBenefits])

    const input = within(panel).getByRole('textbox', { name: assistantMessages.placeholder })
    fireEvent.change(input, { target: { value: '처음인데 뭐부터 해요?' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const log = within(panel).getByRole('log', { name: '대화' })
    expect(within(log).getByText(assistantMessages.freeTextPreparing)).toBeTruthy()
    expect(within(log).queryByText(gettingStartedSummary)).toBeNull()
    expect(read).not.toHaveBeenCalled()
  })

  it('AI 자유 질문에는 시작하기가 제공될 때만 시작하기 도움말을 실어 보낸다', async () => {
    vi.stubEnv('VITE_ASSISTANT_AI_ENABLED', 'true')
    const ask = vi.spyOn(appContainer.resolve('askAssistantUseCase'), 'execute').mockResolvedValue({
      outcome: 'answered',
      answer: { intent: 'OUT_OF_SCOPE', answer: '도와드릴 수 없는 질문이에요.', citations: [], clarificationQuestion: null, searchQuery: null, accountTopic: null, navigation: null, cards: [] },
    })
    const sentHelpIds = async (state: GettingStartedGuide) => {
      const read = vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(state)
      renderApp('/app/partners')
      await waitFor(() => expect(read).toHaveBeenCalled())
      await act(async () => {})
      fireEvent.click(screen.getByRole('button', { name: assistantMessages.openLauncher }))
      const panel = screen.getByRole('dialog', { name: assistantMessages.name })
      const input = within(panel).getByRole('textbox', { name: assistantMessages.placeholder })
      fireEvent.change(input, { target: { value: '처음인데 뭐부터 해요?' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      await within(panel).findByText('도와드릴 수 없는 질문이에요.')
      const ids = ask.mock.calls.at(-1)![0].helpEntries.map((entry) => entry.id)
      cleanup()
      return ids
    }

    expect(await sentHelpIds({ ...businessGuide, visible: false, closed: false })).not.toContain('getting-started')
    const offeredIds = await sentHelpIds(closedGuide)
    expect(offeredIds).toContain('getting-started')
    expect(offeredIds).toContain('search-score-meaning')
  })

  it('AI가 꺼져 있어도 "뭐부터 해요?"처럼 물으면 시작하기 도움말로 답한다', async () => {
    vi.spyOn(gettingStartedUseCase(), 'guide').mockResolvedValue(businessGuide)
    const ask = vi.spyOn(appContainer.resolve('askAssistantUseCase'), 'execute')
    renderApp('/app/partners')
    // 시작하기를 읽은 뒤에야 시작하기 도움말을 씁니다.
    await within(sidebar()).findByRole('region', { name: '시작하기' })

    fireEvent.click(screen.getByRole('button', { name: assistantMessages.openLauncher }))
    const panel = screen.getByRole('dialog', { name: assistantMessages.name })
    const input = within(panel).getByRole('textbox', { name: assistantMessages.placeholder })
    fireEvent.change(input, { target: { value: '처음인데 뭐부터 해요?' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const log = within(panel).getByRole('log', { name: '대화' })
    expect(within(log).getByText(gettingStartedSummary)).toBeTruthy()
    expect(within(log).getByText(assistantMessages.helpSource('처음이라면 무엇부터 하나요'))).toBeTruthy()
    expect(within(log).queryByText(assistantMessages.freeTextPreparing)).toBeNull()
    expect(ask).not.toHaveBeenCalled()
  })
})
