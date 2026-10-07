import { z } from 'zod'
import { gettingStartedStepIds, gettingStartedStepStatuses } from '../../domain/entities/GettingStarted'

const gettingStartedStepSchema = z.object({
  id: z.enum(gettingStartedStepIds),
  status: z.enum(gettingStartedStepStatuses),
})

/**
 * `GET`·`PUT /api/v1/me/getting-started` 응답입니다. 앱이 서버보다 늦게 갱신돼도 모르는 단계(또는 상태) 하나 때문에 안내 전체를
 * 버리지 않고 그 단계만 뺍니다. 나머지 필드가 계약과 다르면 실패입니다.
 */
export const gettingStartedSchema = z.object({
  visible: z.boolean(),
  closed: z.boolean(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  steps: z.array(z.unknown()).max(20).transform((steps) => steps.flatMap((step) => {
    const parsed = gettingStartedStepSchema.safeParse(step)
    return parsed.success ? [parsed.data] : []
  })),
})
