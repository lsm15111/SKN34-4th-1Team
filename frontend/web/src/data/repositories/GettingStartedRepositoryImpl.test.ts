import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GettingStartedGuide } from '@govbiz/shared/domain/entities/GettingStarted'
import { GettingStartedRepositoryImpl } from './GettingStartedRepositoryImpl'

// 다른 기능 테스트에서는 setupGettingStarted가 이 경계를 막아 둡니다. 여기서는 실제 HTTP 계약을 확인합니다.
vi.unmock('../api/gettingStartedApi')

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

const guide: GettingStartedGuide = {
  visible: true,
  closed: false,
  completedAt: null,
  steps: [{ id: 'SIGN_UP', status: 'DONE' }, { id: 'SAVE_PROGRAM', status: 'TODO' }],
}

describe('시작하기 API 경계', () => {
  it('세션 쿠키와 no-store로 GET하고, 앱이 모르는 단계는 빼고 읽는다', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...guide, steps: [...guide.steps, { id: 'PARTNER_PROFILE', status: 'TODO' }] }))
    vi.stubGlobal('fetch', fetcher)

    expect(await new GettingStartedRepositoryImpl().guide()).toEqual(guide)
    const [url, init] = fetcher.mock.calls[0]!
    expect(new URL(String(url)).pathname).toBe('/api/v1/me/getting-started')
    expect(init).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
    expect(init.body).toBeUndefined()
  })

  it('닫기와 다시 보기는 { closed }를 PUT하고 다시 계산한 안내를 받는다', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ ...guide, visible: false, closed: true }))
      .mockResolvedValueOnce(Response.json(guide))
    vi.stubGlobal('fetch', fetcher)
    const repository = new GettingStartedRepositoryImpl()

    expect(await repository.setClosed(true)).toMatchObject({ visible: false, closed: true })
    expect(await repository.setClosed(false)).toMatchObject({ visible: true, closed: false })
    expect(fetcher.mock.calls.map(([, init]) => [init.method, init.body, init.headers['Content-Type']])).toEqual([
      ['PUT', '{"closed":true}', 'application/json'],
      ['PUT', '{"closed":false}', 'application/json'],
    ])
  })

  it('로그인이 끝난 세션·서버 오류·계약과 다른 응답을 안내로 바꾸지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ code: 'AUTHENTICATION_REQUIRED' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ ...guide, visible: 'yes' }))
      .mockResolvedValueOnce(new Response('not json')))
    const repository = new GettingStartedRepositoryImpl()
    await expect(repository.guide()).rejects.toMatchObject({ name: 'GettingStartedApiError', status: 401 })
    await expect(repository.guide()).rejects.toMatchObject({ status: 502 })
    await expect(repository.guide()).rejects.toMatchObject({ status: 502 })
  })

  it('15초 안에 답이 없으면 끊고, 화면이 떠나 취소하면 요청도 취소한다', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetcher)
    const repository = new GettingStartedRepositoryImpl()

    const timedOut = expect(repository.guide()).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(14_999)
    expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await timedOut

    const controller = new AbortController()
    const cancelled = expect(repository.guide(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await cancelled
  })
})
