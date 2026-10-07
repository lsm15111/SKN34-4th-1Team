// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it } from 'vitest'
import { PricingPage } from './PricingPage'

afterEach(cleanup)

function renderPage(layout: 'public' | 'workspace' = 'public') {
  return render(<MemoryRouter><PricingPage layout={layout} /></MemoryRouter>)
}

it('shows the free plan as the only plan in use and states the enforced limits as numbers', () => {
  renderPage()
  const free = screen.getByRole('article', { name: '무료' })
  expect(within(free).getByText('지금 이용 가능')).toBeTruthy()
  expect(within(free).getByText('AI 대화 검색 하루 10회')).toBeTruthy()
  expect(within(free).getByText('신청 문서 초안 월 1건 · 중복 검토 월 2회')).toBeTruthy()
  expect(within(free).getByRole('link', { name: '무료로 지원사업 찾기' })).toBeTruthy()
  for (const name of ['플러스', '프리미엄']) {
    const card = screen.getByRole('article', { name })
    expect(within(card).getByText('출시 예정')).toBeTruthy()
    expect(within(card).getByRole('button', { name: '출시 준비 중' }).hasAttribute('disabled')).toBe(true)
  }
  // 가격은 부가세 포함 총액과 공급가액, 연간 결제 총액을 함께 보여 줍니다.
  expect(screen.getByText('부가세 포함 · 공급가액 9,000원 · 연간 결제 시 연 99,000원(2개월 무료)')).toBeTruthy()
  expect(screen.queryByText(/정식 출시 전까지 회원 무료/)).toBeNull()
})

it('compares the limits for guests and each plan in one table', () => {
  renderPage('workspace')
  const table = screen.getByRole('table', { name: '로그인 전과 요금제별 기능 이용 한도' })
  const aiSearch = within(table).getByRole('row', { name: /AI 대화 검색/ })
  expect(within(aiSearch).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['하루 3회 · 결과 2건', '하루 10회', '하루 40회', '하루 150회'])
  const evidence = within(table).getByRole('row', { name: /공고 원문 질문/ })
  expect(within(evidence).getAllByRole('cell')[0].textContent).toBe('로그인 필요')
  expect(screen.queryByText(/무제한/)).toBeNull()
})

it('lists the saved-program, partner and concurrent-job limits with the same numbers the server enforces', () => {
  renderPage()
  const table = screen.getByRole('table', { name: '로그인 전과 요금제별 기능 이용 한도' })
  const cells = (name: RegExp) => within(within(table).getByRole('row', { name })).getAllByRole('cell').map((cell) => cell.textContent)
  expect(cells(/^관심 공고/)).toEqual(['로그인 필요', '30개', '300개', '1,000개'])
  expect(cells(/^파트너 모집글/)).toEqual(['로그인 필요', '동시 1개', '동시 5개', '동시 20개'])
  expect(cells(/^파트너 제안 보내기/)).toEqual(['로그인 필요', '월 3건', '월 30건', '월 100건'])
  expect(cells(/^동시 분석·초안/)).toEqual(['로그인 필요', '1건', '3건', '5건'])
  const free = screen.getByRole('article', { name: '무료' })
  expect(within(free).getByText('관심 공고 30개 · 동시 분석·초안 1건')).toBeTruthy()
  expect(within(free).getByText('파트너 모집글 동시 1개 · 제안 월 3건')).toBeTruthy()
  expect(within(screen.getByRole('article', { name: '프리미엄' })).getByText('파트너 모집글 동시 20개 · 제안 월 100건')).toBeTruthy()
})
