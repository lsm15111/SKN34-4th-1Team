// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchProgress } from './SearchProgress'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-08T03:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SearchProgress', () => {
  it('보낸 시각부터 지난 시간을 매초 세고 10초 뒤에 보통 걸리는 시간, 45초 뒤에 늦어짐을 알린다', () => {
    render(<SearchProgress startedAt={Date.now()} />)
    expect(screen.queryByText(/지났어요/)).toBeNull()
    expect(screen.queryByText(/보통 30초 안팎 걸려요/)).toBeNull()

    act(() => { vi.advanceTimersByTime(9_000) })
    expect(screen.getByText('9초 지났어요')).toBeTruthy()
    expect(screen.queryByText(/보통 30초 안팎 걸려요/)).toBeNull()

    act(() => { vi.advanceTimersByTime(1_000) })
    expect(screen.getByText('10초 지났어요')).toBeTruthy()
    expect(screen.getByText('후보 공고마다 지원 대상과 지역을 확인하고 있어요. 보통 30초 안팎 걸려요.')).toBeTruthy()

    act(() => { vi.advanceTimersByTime(55_000) })
    expect(screen.getByText('1분 5초 지났어요')).toBeTruthy()
    expect(screen.getByText('평소보다 오래 걸리고 있어요. 조금만 더 기다려 주세요.')).toBeTruthy()
  })

  it('화면을 떠났다 돌아와도 처음 보낸 시각부터 이어서 센다', () => {
    render(<SearchProgress startedAt={Date.now() - 12_000} />)
    expect(screen.getByText('12초 지났어요')).toBeTruthy()
    expect(screen.getByText(/보통 30초 안팎 걸려요/)).toBeTruthy()
  })

  it('보낸 시각을 모르면 단계만 보여 주고 시간을 추측하지 않는다', () => {
    render(<SearchProgress startedAt={null} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(screen.queryByText(/지났어요|걸려요/)).toBeNull()
  })
})
