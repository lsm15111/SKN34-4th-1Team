import { gettingStartedSchema } from '@govbiz/shared/data/models/GettingStartedDto'
import type { GettingStartedGuide } from '@govbiz/shared/domain/entities/GettingStarted'
import { getCoreApiBaseUrl } from './coreApiConfig'

/** 시작하기 요청 실패입니다. 서버 원문 대신 HTTP 상태만 남깁니다. 계약과 다른 응답은 502로 둡니다. */
export class GettingStartedApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Core API returned HTTP ${status} for the getting started request.`)
    this.name = 'GettingStartedApiError'
    this.status = status
  }
}

/**
 * 본인 시작하기 안내를 읽거나(GET) 닫기·다시 보기를 저장합니다(PUT `{ closed }`). 세션 쿠키로 인증하고,
 * 완료 상태는 기록이 생길 때마다 바뀌므로 브라우저 캐시를 쓰지 않으며 15초 안에 답이 없으면 끊습니다.
 */
export async function gettingStartedRequest(method: 'GET' | 'PUT', body?: { closed: boolean }, signal?: AbortSignal): Promise<GettingStartedGuide> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timer = setTimeout(abort, 15_000)
  try {
    const response = await fetch(`${getCoreApiBaseUrl()}/api/v1/me/getting-started`, {
      method, credentials: 'include', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.ok) throw new GettingStartedApiError(response.status)
    const parsed = gettingStartedSchema.safeParse(await response.json().catch(() => null))
    if (!parsed.success) throw new GettingStartedApiError(502)
    return parsed.data
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
