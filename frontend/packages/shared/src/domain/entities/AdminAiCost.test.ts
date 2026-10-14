import { describe, expect, it } from 'vitest'
import { estimateAiCostUsd, findAdminAiModelPrice, formatEstimatedAiCostUsd, type AdminAiModelPrice } from './AdminAiCost'

const price = (id: number, modelPrefix: string, input: string, output: string, overrides: Partial<AdminAiModelPrice> = {}): AdminAiModelPrice => ({
  id, modelPrefix, serviceTier: 'default', inputUsdPerMillion: input, cachedInputUsdPerMillion: null,
  cacheWriteInputUsdPerMillion: null, cacheWrite12hInputUsdPerMillion: null, outputUsdPerMillion: output, effectiveFrom: '2026-10-01', note: null,
  ...overrides,
})

describe('가격 찾기', () => {
  const prices = [
    price(1, 'gpt-6', '1', '2'),
    price(2, 'gpt-6-luna', '0.1', '0.5'),
    price(3, 'gpt-6-luna', '0.08', '0.4', { effectiveFrom: '2026-11-01' }),
    price(4, 'gpt-6-luna', '0.2', '1', { serviceTier: 'priority' }),
  ]

  it('Core처럼 가장 긴 접두어와 기준일 이전 가장 최근 시작일을 고른다', () => {
    expect(findAdminAiModelPrice(prices, 'gpt-6-luna', 'default', '2026-10-15')?.id).toBe(2)
    expect(findAdminAiModelPrice(prices, 'gpt-6-luna-2026-07-30', 'default', '2026-11-02')?.id).toBe(3)
    expect(findAdminAiModelPrice(prices, 'gpt-6-sol', 'default', '2026-10-15')?.id).toBe(1)
  })

  it('처리 등급·접두어 경계·시작일이 맞지 않으면 고르지 않는다', () => {
    expect(findAdminAiModelPrice(prices, 'gpt-6-luna', 'priority', '2026-10-15')?.id).toBe(4)
    expect(findAdminAiModelPrice(prices, 'gpt-6-luna', 'flex', '2026-10-15')).toBeNull()
    expect(findAdminAiModelPrice(prices, 'gpt-60', 'default', '2026-10-15')).toBeNull()
    expect(findAdminAiModelPrice(prices, 'gpt-6-luna', 'default', '2026-09-30')).toBeNull()
  })
})

describe('추정 비용', () => {
  const prices = [price(1, 'gpt-6-luna', '0.1', '0.5', { cachedInputUsdPerMillion: '0.01' }), price(2, 'text-embedding-3-small', '0.02', '0')]

  it('입력·출력 토큰에 가격을 곱하고 캐시 읽기는 캐시 가격으로 계산한다', () => {
    expect(estimateAiCostUsd(prices, { model: 'gpt-6-luna', inputTokens: 1581, outputTokens: 70, on: '2026-10-14' })).toBeCloseTo(0.0001931, 10)
    expect(estimateAiCostUsd(prices, { model: 'gpt-6-luna', inputTokens: 1000, cachedInputTokens: 400, outputTokens: 0, on: '2026-10-14' })).toBeCloseTo(0.000064, 10)
    expect(estimateAiCostUsd(prices, { model: 'text-embedding-3-small', inputTokens: 500, outputTokens: 0, on: '2026-10-14' })).toBeCloseTo(0.00001, 10)
  })

  it('가격이 없으면 0이 아니라 null이다', () => {
    expect(estimateAiCostUsd(prices, { model: 'unknown-model', inputTokens: 10, outputTokens: 10, on: '2026-10-14' })).toBeNull()
    expect(estimateAiCostUsd(prices, { model: 'gpt-6-luna', serviceTier: 'priority', inputTokens: 10, outputTokens: 10, on: '2026-10-14' })).toBeNull()
  })

  it('작은 금액은 유효 숫자 두 자리로, 큰 금액은 소수 넷째 자리까지 보인다', () => {
    expect(formatEstimatedAiCostUsd(0.0001931)).toBe('$0.00019')
    expect(formatEstimatedAiCostUsd(0.41289)).toBe('$0.4129')
    expect(formatEstimatedAiCostUsd(0)).toBe('$0')
  })
})
