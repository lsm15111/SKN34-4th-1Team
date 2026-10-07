import { readPlanQuotaProblem } from '@govbiz/shared/data/models/PlanUsageDto'
import type { PartnerProposalBox, PartnerProposalInput } from '../../domain/entities/PartnerProposal'
import type { PartnerProposalAction } from '../../domain/repositories/PartnerProposalRepository'
import { AccountApiError } from './accountApi'
import { getCoreApiBaseUrl } from './coreApiConfig'
import {
  partnerProposalBoxDtoSchema,
  partnerProposalDtoSchema,
  type PartnerProposalBoxDto,
  type PartnerProposalDto,
} from '../models/PartnerProposalDto'

const RECRUITMENTS_PATH = '/api/v1/partners/recruitments'
const PROPOSALS_PATH = '/api/v1/partners/proposals'
const MY_PROPOSALS_PATH = '/api/v1/me/proposals'

/** 제안은 당사자만 다루므로 모든 요청이 세션 쿠키를 함께 보냅니다. */
const withSessionCookie: RequestCredentials = 'include'

export async function sendPartnerProposalApi(
  recruitmentId: number,
  input: PartnerProposalInput,
  signal?: AbortSignal,
): Promise<PartnerProposalDto> {
  const response = await fetch(`${getCoreApiBaseUrl()}${RECRUITMENTS_PATH}/${recruitmentId}/proposals`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    credentials: withSessionCookie,
    signal,
  })
  await rejectFailedResponse(response)

  return partnerProposalDtoSchema.parse(await response.json())
}

export async function respondPartnerProposalApi(
  id: number,
  action: PartnerProposalAction,
  signal?: AbortSignal,
): Promise<PartnerProposalDto> {
  const response = await fetch(`${getCoreApiBaseUrl()}${PROPOSALS_PATH}/${id}/${action}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: withSessionCookie,
    signal,
  })
  await rejectFailedResponse(response)

  return partnerProposalDtoSchema.parse(await response.json())
}

export async function browsePartnerProposalsApi(box: PartnerProposalBox, signal?: AbortSignal): Promise<PartnerProposalBoxDto> {
  const query = new URLSearchParams({ box })
  const response = await fetch(`${getCoreApiBaseUrl()}${MY_PROPOSALS_PATH}?${query}`, {
    headers: { Accept: 'application/json' },
    credentials: withSessionCookie,
    cache: 'no-store',
    signal,
  })
  await rejectFailedResponse(response)

  const page = partnerProposalBoxDtoSchema.parse(await response.json())
  if (page.box !== box) throw new Error('요청한 제안함과 응답이 다릅니다.')
  return page
}

/** 이번 달 제안 수 한도(429 PLAN_QUOTA_EXCEEDED)와 이용량 확인 실패(503 QUOTA_UNAVAILABLE)는 shared 오류로 바꿉니다. */
async function rejectFailedResponse(response: Response): Promise<void> {
  if (response.ok) return

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    // 본문이 JSON이 아니면 상태 코드만으로 판단합니다.
  }
  const quota = readPlanQuotaProblem(response.status, payload)
  if (quota) throw quota
  const record = typeof payload === 'object' && payload !== null ? payload as { code?: unknown } : {}
  throw new AccountApiError(response.status, typeof record.code === 'string' ? record.code : null)
}
