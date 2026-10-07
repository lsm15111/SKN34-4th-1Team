// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter, useNavigate } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GettingStartedGuide } from '@govbiz/shared/domain/entities/GettingStarted'

import { appContainer } from '../../../app/appContainer'
import { createAppStore } from '../../../app/store'
import type { Account } from '../../../domain/entities/Account'
import { sessionRestored, signedIn, signedOut } from '../auth/state/authSlice'
import { GettingStartedSync, gettingStartedRefreshMs } from './GettingStartedSync'
import {
  gettingStartedLoaded,
  gettingStartedRefreshRequested,
  gettingStartedSaved,
  selectGettingStartedGuide,
} from './state/gettingStartedSlice'

const member: Account = { email: 'member@govbiz.local', role: 'USER', tier: 'MEMBER', emailVerified: true, hasPassword: true, accountType: 'BUSINESS', onboarded: true, company: null }
const other: Account = { ...member, email: 'other@govbiz.local' }
const guide: GettingStartedGuide = { visible: true, closed: false, completedAt: null, steps: [{ id: 'SIGN_UP', status: 'DONE' }, { id: 'COMPANY', status: 'TODO' }] }
const closedGuide: GettingStartedGuide = { ...guide, visible: false, closed: true }

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function Harness() {
  const navigate = useNavigate()
  return (
    <>
      <GettingStartedSync />
      <button type="button" onClick={() => navigate('/app/reports')}>리포트로</button>
      <button type="button" onClick={() => navigate('/app/profile')}>프로필로</button>
    </>
  )
}

function renderSync(account: Account | null, { strict = false } = {}) {
  const store = createAppStore()
  store.dispatch(sessionRestored(account))
  const tree = <Provider store={store}><MemoryRouter initialEntries={['/app/partners']}><Harness /></MemoryRouter></Provider>
  render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return store
}

function clock(start = 1_000_000) {
  let now = start
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  return { advance: (ms: number) => { now += ms } }
}

describe('시작하기 읽기', () => {
  it('작업 화면에 들어오면 읽고, 15초 안의 화면 이동은 다시 읽지 않으며 그 뒤 이동과 도우미 열기는 다시 읽는다', async () => {
    const time = clock()
    const read = vi.spyOn(appContainer.resolve('gettingStartedUseCase'), 'guide').mockResolvedValue(guide)
    const store = renderSync(member)

    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(1)
    expect(selectGettingStartedGuide(store.getState())).toEqual(guide)

    time.advance(gettingStartedRefreshMs - 1)
    fireEvent.click(screen.getByRole('button', { name: '리포트로' }))
    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(1)

    time.advance(1)
    fireEvent.click(screen.getByRole('button', { name: '프로필로' }))
    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(2)

    // 도우미를 열면 간격과 관계없이 바로 읽습니다.
    act(() => { store.dispatch(gettingStartedRefreshRequested()) })
    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('개발 모드에서 효과가 두 번 실행돼 첫 읽기가 끊겨도 다시 읽어 안내를 채운다', async () => {
    clock()
    const read = vi.spyOn(appContainer.resolve('gettingStartedUseCase'), 'guide')
      .mockImplementation((signal?: AbortSignal) => new Promise<GettingStartedGuide>((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
        queueMicrotask(() => { if (!signal?.aborted) resolve(guide) })
      }))
    const store = renderSync(member, { strict: true })

    await act(async () => {})
    // StrictMode가 효과를 정리하며 첫 읽기를 끊고, 끊긴 읽기는 성공으로 치지 않아 곧바로 다시 읽습니다.
    expect(read).toHaveBeenCalledTimes(2)
    expect(read.mock.calls[0]![0]?.aborted).toBe(true)
    expect(selectGettingStartedGuide(store.getState())).toEqual(guide)
  })

  it('읽는 중에 도우미를 열거나 화면을 옮기면 새로 읽지 않고 그 결과를 기다린다', async () => {
    clock()
    let finish!: (value: GettingStartedGuide) => void
    const read = vi.spyOn(appContainer.resolve('gettingStartedUseCase'), 'guide')
      .mockReturnValue(new Promise<GettingStartedGuide>((resolve) => { finish = resolve }))
    const store = renderSync(member)
    await act(async () => {})

    act(() => { store.dispatch(gettingStartedRefreshRequested()) })
    fireEvent.click(screen.getByRole('button', { name: '리포트로' }))
    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(1)
    await act(async () => { finish(guide) })
    expect(selectGettingStartedGuide(store.getState())).toEqual(guide)
  })

  it('로그인하지 않았으면 읽지 않고, 읽지 못하면 알리지 않은 채 15초 뒤 화면 이동 때 다시 읽는다', async () => {
    const time = clock()
    const read = vi.spyOn(appContainer.resolve('gettingStartedUseCase'), 'guide').mockRejectedValue(new Error('down'))
    renderSync(null)
    await act(async () => {})
    expect(read).not.toHaveBeenCalled()
    cleanup()

    const store = renderSync(member)
    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(1)
    expect(selectGettingStartedGuide(store.getState())).toBeNull()

    time.advance(gettingStartedRefreshMs - 1)
    fireEvent.click(screen.getByRole('button', { name: '리포트로' }))
    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(1)

    read.mockResolvedValue(guide)
    time.advance(1)
    fireEvent.click(screen.getByRole('button', { name: '프로필로' }))
    await act(async () => {})
    expect(read).toHaveBeenCalledTimes(2)
    expect(selectGettingStartedGuide(store.getState())).toEqual(guide)
  })

  it('읽는 사이 닫기를 저장했으면 늦게 온 읽기 결과가 저장 결과를 덮지 않는다', async () => {
    let finish!: (value: GettingStartedGuide) => void
    vi.spyOn(appContainer.resolve('gettingStartedUseCase'), 'guide')
      .mockReturnValue(new Promise<GettingStartedGuide>((resolve) => { finish = resolve }))
    const store = renderSync(member)
    await act(async () => {})

    act(() => { store.dispatch(gettingStartedSaved({ accountEmail: member.email, guide: closedGuide })) })
    await act(async () => { finish(guide) })
    expect(selectGettingStartedGuide(store.getState())).toEqual(closedGuide)
  })
})

describe('시작하기 상태', () => {
  it('계정이 바뀌거나 로그아웃하면 이전 계정의 안내와 늦게 온 결과를 버린다', () => {
    const store = createAppStore()
    store.dispatch(sessionRestored(member))
    const revision = store.getState().gettingStarted.revision
    store.dispatch(gettingStartedLoaded({ accountEmail: member.email, guide, revision, at: 1 }))
    expect(selectGettingStartedGuide(store.getState())).toEqual(guide)

    store.dispatch(signedIn(other))
    expect(selectGettingStartedGuide(store.getState())).toBeNull()
    // 이전 계정으로 시작한 읽기가 늦게 와도 받지 않습니다.
    store.dispatch(gettingStartedLoaded({ accountEmail: member.email, guide, revision, at: 2 }))
    expect(store.getState().gettingStarted.guide).toBeNull()

    store.dispatch(gettingStartedSaved({ accountEmail: other.email, guide: closedGuide }))
    expect(selectGettingStartedGuide(store.getState())).toEqual(closedGuide)
    store.dispatch(signedOut())
    expect(store.getState().gettingStarted.guide).toBeNull()
  })
})
