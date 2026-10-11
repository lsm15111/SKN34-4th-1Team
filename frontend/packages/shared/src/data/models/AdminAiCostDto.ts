import { z } from 'zod'

import type { AdminAiCostSummary, AdminAiModelPrice } from '../../domain/entities/AdminAiCost'

const countSchema = z.number().int().nonnegative()
const usdSchema = z.string().regex(/^-?\d+\.\d{6}$/)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const priceSchema = z.string().regex(/^\d+(\.\d+)?$/)

const totalsSchema = z.object({
  calls: countSchema,
  inputTokens: countSchema,
  cachedInputTokens: countSchema,
  outputTokens: countSchema,
  estimatedUsd: usdSchema,
  unpricedCalls: countSchema,
})

export const adminAiCostSummaryDtoSchema = z.object({
  from: dateSchema,
  to: dateSchema,
  totals: totalsSchema,
  actualUsd: usdSchema.nullable(),
  actualConfigured: z.boolean(),
  actualFetchedAt: z.string().min(1).nullable(),
  krwPerUsd: z.string().regex(/^\d+(\.\d+)?$/).nullable(),
  byFeature: z.array(z.object({ key: z.string().min(1).nullable(), serviceTier: z.string().nullable(), totals: totalsSchema })),
  byModel: z.array(z.object({ key: z.string().min(1), serviceTier: z.string().min(1), totals: totalsSchema })),
  days: z.array(z.object({ date: dateSchema, estimatedUsd: usdSchema, calls: countSchema, actualUsd: usdSchema.nullable() })),
  topAccounts: z.array(z.object({
    accountId: z.number().int().positive(),
    email: z.string().min(1),
    planCode: z.string().min(1).nullable(),
    totals: totalsSchema,
  })),
})

export const adminAiModelPriceDtoSchema = z.object({
  id: z.number().int().positive(),
  modelPrefix: z.string().min(1),
  serviceTier: z.enum(['default', 'priority', 'flex']),
  inputUsdPerMillion: priceSchema,
  cachedInputUsdPerMillion: priceSchema.nullable(),
  outputUsdPerMillion: priceSchema,
  effectiveFrom: dateSchema,
  note: z.string().nullable(),
})

export const adminAiCostSyncDtoSchema = z.object({ from: dateSchema, to: dateSchema, lines: countSchema, amountUsd: usdSchema })

export type AdminAiCostSummaryDto = z.infer<typeof adminAiCostSummaryDtoSchema>
export type AdminAiModelPriceDto = z.infer<typeof adminAiModelPriceDtoSchema>
export type AdminAiCostSyncDto = z.infer<typeof adminAiCostSyncDtoSchema>

/** DTO를 복사해 View가 외부 HTTP 응답 객체를 직접 보유하지 않게 합니다. */
export function toAdminAiCostSummary(dto: AdminAiCostSummaryDto): AdminAiCostSummary {
  return {
    from: dto.from,
    to: dto.to,
    totals: { ...dto.totals },
    actualUsd: dto.actualUsd,
    actualConfigured: dto.actualConfigured,
    actualFetchedAt: dto.actualFetchedAt,
    krwPerUsd: dto.krwPerUsd,
    byFeature: dto.byFeature.map((group) => ({ key: group.key, totals: { ...group.totals } })),
    byModel: dto.byModel.map((group) => ({ key: group.key, serviceTier: group.serviceTier, totals: { ...group.totals } })),
    days: dto.days.map((day) => ({ ...day })),
    topAccounts: dto.topAccounts.map((account) => ({ ...account, totals: { ...account.totals } })),
  }
}

export function toAdminAiModelPrice(dto: AdminAiModelPriceDto): AdminAiModelPrice {
  return { ...dto }
}
