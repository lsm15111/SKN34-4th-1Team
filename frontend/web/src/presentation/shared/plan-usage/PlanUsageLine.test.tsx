// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlanUsage, PlanUsageItem } from '@govbiz/shared/domain/entities/PlanUsage'
import { PlanQuotaExceededError, QuotaUnavailableError } from '@govbiz/shared/domain/errors/PlanQuotaError'

import { PlanUsageLine } from './PlanUsageLine'
import { planQuotaFailureMessage, planUsagePercent, planUsageView } from './planUsageView'
import { usePlanUsage } from './usePlanUsage'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const resetsAt = '2026-10-09T00:00:00+09:00'
const question = (used: number): PlanUsageItem => ({ feature: 'EVIDENCE_QUESTION', period: 'DAY', limit: 10, used, resetsAt })
const usageOf = (...items: PlanUsageItem[]): PlanUsage => ({ plan: 'FREE', items })

function renderLine(item: PlanUsageItem, pricingPath = '/app/pricing') {
  const view = planUsageView(usageOf(item), item.feature)!
  render(<MemoryRouter><PlanUsageLine view={view} pricingPath={pricingPath} /></MemoryRouter>)
  return screen.getByText(view.isLimitReached ? view.limitMessage : view.countText).closest('p')!
}

describe('이용량 한 줄', () => {
  it('80% 전에는 기능 이름과 이번 기간 사용량만 차분하게 보여 준다', () => {
    const line = renderLine(question(7))
    expect(line.textContent).toBe('공고 원문 질문·오늘 7/10회')
    expect(line.className).toContain('text-ink-muted')
    expect(screen.queryByRole('link', { name: '요금제 보기' })).toBeNull()
  })

  it('80%부터 경고 색으로 다시 채워지는 때와 요금제 안내 링크를 붙인다', () => {
    const line = renderLine(question(8))
    expect(line.className).toContain('text-warning')
    expect(line.textContent).toContain('오늘 8/10회')
    expect(line.textContent).toContain('자정(서울 시간)에 다시 채워져요.')
    expect(screen.getByRole('link', { name: '요금제 보기' }).getAttribute('href')).toBe('/app/pricing')
  })

  it('개수 한도는 지금 가진 개수를 적고, 다 채우면 빼면 다시 담을 수 있다고 알린다', () => {
    const saved: PlanUsageItem = { feature: 'SAVED_PROGRAM', period: 'TOTAL', limit: 30, used: 12, resetsAt: null }
    expect(renderLine(saved).textContent).toBe('관심 공고·12/30개')
    cleanup()
    const near = renderLine({ ...saved, used: 24 })
    expect(near.className).toContain('text-warning')
    expect(near.textContent).toContain('담은 공고를 빼면 그만큼 새로 담을 수 있어요.')
    cleanup()
    const full = renderLine({ feature: 'PARTNER_RECRUITMENT', period: 'TOTAL', limit: 1, used: 1, resetsAt: null })
    expect(full.textContent).toContain('모집 중인 모집글은 1개까지 둘 수 있어요. 모집글을 마감하거나 모집 기간이 끝나면 새로 쓸 수 있어요.')
    expect(screen.getByRole('link', { name: '요금제 보기' })).toBeTruthy()
  })

  it('다 쓰면 shared 안내로 다 쓴 사실과 다시 채워지는 때를 알린다', () => {
    const line = renderLine({ feature: 'COMBINATION_REVIEW', period: 'MONTH', limit: 2, used: 3, resetsAt: '2026-11-01T00:00:00+09:00' })
    expect(line.textContent).toContain('이번 달 중복 검토 2회를 모두 썼어요. 진행 중인 검토도 횟수에 들어가요. 11월 1일에 다시 채워져요.')
    expect(line.className).toContain('text-warning')
    expect(screen.getByRole('link', { name: '요금제 보기' })).toBeTruthy()
  })
})

describe('planUsageView', () => {
  it('읽지 못했거나 그 기능이 없으면 그리지 않도록 null을 돌려준다', () => {
    expect(planUsageView(null, 'AI_SEARCH')).toBeNull()
    // 로그인 전에는 회원 전용 기능 줄이 없습니다.
    expect(planUsageView({ plan: null, items: [{ feature: 'AI_SEARCH', period: 'DAY', limit: 3, used: 0, resetsAt }] }, 'EVIDENCE_QUESTION')).toBeNull()
  })

  it('로그인 전 AI 대화 검색은 체험 횟수로, 회원은 이번 기간 사용량으로 적는다', () => {
    const guest = planUsageView({ plan: null, items: [{ feature: 'AI_SEARCH', period: 'DAY', limit: 3, used: 4, resetsAt }] }, 'AI_SEARCH')!
    expect(guest).toMatchObject({ label: 'AI 대화 검색', countText: '로그인 전 체험 3/3회', isNearLimit: true, isLimitReached: true })
    expect(guest.limitMessage).toContain('로그인하면 회원 한도로 이어서 검색할 수 있고, 필터 검색은 계속 쓸 수 있어요.')
    const memberView = planUsageView(usageOf({ feature: 'AI_SEARCH', period: 'DAY', limit: 10, used: 2, resetsAt }), 'AI_SEARCH')!
    expect(memberView).toMatchObject({ countText: '오늘 2/10회', isNearLimit: false, isLimitReached: false, resetText: '자정(서울 시간)에 다시 채워져요.' })
  })

  it('진행 막대는 한도를 넘겨 세어져도 100%에서 멈춘다', () => {
    expect(planUsagePercent(question(3))).toBe(30)
    expect(planUsagePercent(question(12))).toBe(100)
  })

  it('요금제 한도와 이용량 확인 실패만 shared 안내로 바꾸고 나머지는 그대로 둔다', () => {
    const exceeded = new PlanQuotaExceededError({ feature: 'EVIDENCE_QUESTION', period: 'DAY', plan: 'FREE', limit: 10, resetsAt })
    expect(planQuotaFailureMessage(exceeded)).toBe('오늘 공고 원문 질문 10회를 모두 썼어요. 자정(서울 시간)에 다시 채워져요.')
    expect(planQuotaFailureMessage(new QuotaUnavailableError())).toBe('지금은 이용량을 확인할 수 없어 실행하지 않았어요. 잠시 후 다시 시도해 주세요.')
    expect(planQuotaFailureMessage(new Error('other'))).toBeNull()
    expect(planQuotaFailureMessage(null)).toBeNull()
  })
})

describe('usePlanUsage', () => {
  it('들어올 때 읽고, 다시 읽는 동안에는 앞서 읽은 값을 두며, 실패하면 숨긴 뒤 다시 시도할 수 있다', async () => {
    let resolveSecond!: (usage: PlanUsage) => void
    const useCase = {
      usage: vi.fn()
        .mockResolvedValueOnce(usageOf(question(1)))
        .mockReturnValueOnce(new Promise<PlanUsage>((resolve) => { resolveSecond = resolve }))
        .mockRejectedValueOnce(new Error('usage unavailable'))
        .mockResolvedValueOnce(usageOf(question(3))),
    }
    const { result } = renderHook(() => usePlanUsage(true, useCase))
    expect(result.current.load).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current.usage).toEqual(usageOf(question(1))))

    act(() => result.current.reload())
    expect(result.current.usage).toEqual(usageOf(question(1)))
    await act(async () => resolveSecond(usageOf(question(2))))
    expect(result.current.usage).toEqual(usageOf(question(2)))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.load).toEqual({ status: 'failed' }))
    expect(result.current.usage).toBeNull()

    act(() => result.current.reload())
    expect(result.current.load).toEqual({ status: 'loading' })
    await waitFor(() => expect(result.current.usage).toEqual(usageOf(question(3))))
    expect(useCase.usage).toHaveBeenCalledTimes(4)
  })

  it('꺼 두면 읽지 않고, 화면을 떠나면 요청을 취소한다', () => {
    const useCase = { usage: vi.fn(() => new Promise<PlanUsage>(() => {})) }
    const disabled = renderHook(() => usePlanUsage(false, useCase))
    expect(useCase.usage).not.toHaveBeenCalled()
    disabled.unmount()

    const enabled = renderHook(() => usePlanUsage(true, useCase))
    const signal = (useCase.usage.mock.calls[0] as unknown as [AbortSignal])[0]
    expect(signal.aborted).toBe(false)
    enabled.unmount()
    expect(signal.aborted).toBe(true)
  })
})
