import { readPlanQuotaProblem } from '@govbiz/shared/data/models/PlanUsageDto'
import type { SupportProgramIdentity } from '../../domain/repositories/SupportProgramRepository'
import { AccountApiError } from './accountApi'
import { getCoreApiBaseUrl } from './coreApiConfig'
import {
  savedSupportProgramDtoSchema,
  savedSupportProgramListDtoSchema,
  savedSupportProgramStatusDtoSchema,
  type SavedSupportProgramDto,
} from '../models/SavedSupportProgramDto'

const SAVED_PROGRAMS_PATH = '/api/v1/me/saved-programs'

/** 관심 공고함은 회원 것이라 모든 요청이 세션 쿠키를 보냅니다. */
const withSessionCookie: RequestCredentials = 'include'

export async function listSavedSupportProgramsApi(signal?: AbortSignal): Promise<SavedSupportProgramDto[]> {
  const response = await fetch(`${getCoreApiBaseUrl()}${SAVED_PROGRAMS_PATH}`, {
    headers: { Accept: 'application/json' },
    credentials: withSessionCookie,
    cache: 'no-store',
    signal,
  })
  await rejectFailedResponse(response)
  return savedSupportProgramListDtoSchema.parse(await response.json()).programs
}

export async function getSavedSupportProgramStatusApi(identity: SupportProgramIdentity, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(`${getCoreApiBaseUrl()}${SAVED_PROGRAMS_PATH}/status?${identityParams(identity)}`, {
    headers: { Accept: 'application/json' },
    credentials: withSessionCookie,
    cache: 'no-store',
    signal,
  })
  await rejectFailedResponse(response)
  return savedSupportProgramStatusDtoSchema.parse(await response.json()).saved
}

/** 원본 ID에 `/`가 올 수 있어 경로가 아니라 본문으로 보냅니다. */
export async function saveSupportProgramApi(identity: SupportProgramIdentity, signal?: AbortSignal): Promise<SavedSupportProgramDto> {
  const response = await fetch(`${getCoreApiBaseUrl()}${SAVED_PROGRAMS_PATH}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
    credentials: withSessionCookie,
    signal,
  })
  await rejectFailedResponse(response)
  return savedSupportProgramDtoSchema.parse(await response.json())
}

export async function removeSavedSupportProgramApi(identity: SupportProgramIdentity, signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${getCoreApiBaseUrl()}${SAVED_PROGRAMS_PATH}?${identityParams(identity)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: withSessionCookie,
    signal,
  })
  await rejectFailedResponse(response)
}

function identityParams(identity: SupportProgramIdentity): URLSearchParams {
  return new URLSearchParams({ sourceCode: identity.sourceCode, sourceProgramId: identity.sourceProgramId })
}

/**
 * 실패는 계정 API와 같은 ProblemDetail이라 같은 오류 타입으로 던집니다. 관심 공고 개수 한도(429 PLAN_QUOTA_EXCEEDED)와
 * 이용량 확인 실패(503 QUOTA_UNAVAILABLE)는 화면이 shared 안내를 보이도록 shared 오류로 바꿉니다.
 */
async function rejectFailedResponse(response: Response): Promise<void> {
  if (response.ok) return
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  const quota = readPlanQuotaProblem(response.status, payload)
  if (quota) throw quota
  const record = typeof payload === 'object' && payload !== null ? payload as { code?: unknown } : {}
  throw new AccountApiError(response.status, typeof record.code === 'string' ? record.code : null)
}
