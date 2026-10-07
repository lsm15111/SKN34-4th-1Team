import { toSupportProgram } from '@govbiz/shared/data/models/SupportProgramDto'
import {
  SupportProgramApiError, SupportProgramInterpretationApiError, SupportProgramRequestApiError,
  SupportProgramSearchRestoreApiError, SupportProgramSearchTimeoutApiError,
} from '@govbiz/shared/data/api/supportProgramApi'
import { SupportProgramSearchRestoreError } from '@govbiz/shared/domain/errors/SupportProgramSearchRestoreError'
import type { RestoredSupportProgramSearchResult, SupportProgramSearchResult } from '@govbiz/shared/domain/entities/SupportProgramSearchResult'
import type { SupportProgramSearch } from '@govbiz/shared/domain/repositories/SupportProgramRepository'
import { ApiError, errorMessage, programClient } from './client'

/**
 * 조건 해석·검색 실패를 웹과 같은 종류(요청 제한·처리 중·시간 초과·일시 장애)로 나눠 안내합니다.
 * 서버 원문은 보이지 않고, 종류를 모르는 오류는 기존 일반 안내를 씁니다.
 */
export function supportProgramFailureMessage(error: unknown, action: 'interpret' | 'search'): string {
  if (error instanceof SupportProgramRequestApiError) {
    const reason = error.code === 'SUPPORT_PROGRAM_RATE_LIMITED'
      ? '짧은 시간에 요청이 많아 잠시 제한됐어요.' : '지금 다른 요청을 처리하고 있어 새 요청을 시작할 수 없어요.'
    return `${reason} ${error.retryAfterSeconds === null ? '잠시' : `약 ${error.retryAfterSeconds}초`} 후 다시 시도해 주세요.`
  }
  if (error instanceof SupportProgramInterpretationApiError) {
    return error.reason === 'timeout'
      ? '조건 해석 응답이 늦어 시간이 초과됐어요. 잠시 후 다시 보내 주세요.'
      : '조건 해석 서비스를 잠시 이용할 수 없어요. 잠시 후 다시 보내 주세요.'
  }
  if (error instanceof SupportProgramSearchTimeoutApiError) return '서버의 검색 시간이 초과됐어요. 같은 조건으로 다시 검색해 주세요.'
  if (error instanceof SupportProgramSearchRestoreError) return error.message
  if (error instanceof SupportProgramApiError) {
    return action === 'interpret' ? '메시지의 조건을 해석하지 못했어요. 다시 보내 주세요.' : '지원사업을 검색하지 못했어요. 잠시 후 다시 검색해 주세요.'
  }
  return errorMessage(error)
}

/** HTTP DTO conversion stays at the mobile API boundary, outside screen state. */
export async function searchPrograms(token: string | undefined, command: SupportProgramSearch, signal?: AbortSignal): Promise<SupportProgramSearchResult> {
  const response = await programClient(token).search(command, signal)
  return { ...response, programs: response.programs.map(toSupportProgram) }
}

export async function restoreSearchResults(token: string, resultToken: string, signal?: AbortSignal): Promise<RestoredSupportProgramSearchResult> {
  try {
    const response = await programClient(token).restoreSearch(resultToken, signal)
    return { ...response, programs: response.programs.map(toSupportProgram), context: {
      ...response.context, companyConditions: { ...response.context.companyConditions },
    } }
  } catch (cause) {
    if (signal?.aborted) throw cause
    throw new SupportProgramSearchRestoreError(cause instanceof ApiError && cause.status === 401 ? 'unauthorized'
      : cause instanceof SupportProgramSearchRestoreApiError ? cause.reason : 'unavailable')
  }
}
