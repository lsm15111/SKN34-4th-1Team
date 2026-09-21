import { APP_PREFIX, appPaths, isAppPath, readSavedProgramsViewMode, savedProgramsPath } from '../../../shared/routes/appPaths'
import { readCatalogFilters, writeCatalogFilters } from '../../../shared/support-program/catalogSearchParams'

/** 비로그인 상세·질문 주소에 검색 복귀 경로를 담는 쿼리 이름입니다. */
export const BACK_PARAM = 'back'

/** 검증을 통과한 앱 내부 복귀 경로입니다. 외부 URL·해시·프로토콜 상대 주소는 여기에 들어오지 않습니다. */
export type SupportProgramSearchReturnTo = string

/**
 * 상세를 연 화면(출처)으로 돌아가는 경로를 정합니다. 화이트리스트 세 개가 아니라 출처를 승계하므로
 * 리포트·중복 검토·모집글처럼 상세를 여는 화면이 늘어도 규칙이 깨지지 않습니다.
 * - 검색 화면(`/`, `/app/chat`)은 검증된 필터만 되살리고, 관심 공고함은 보던 탭만 되살립니다.
 * - 그 밖의 `/app/` 아래 경로는 쿼리까지 그대로 씁니다. 외부 URL·`//`·해시는 검색 화면으로 떨어뜨립니다.
 * 이동 상태가 없으면(새로고침·공유 URL) 비로그인 링크가 주소에 실어 둔 `back`을 같은 규칙으로 읽습니다.
 */
export function getSupportProgramSearchReturnTo(state: unknown, search = ''): SupportProgramSearchReturnTo {
  const fromState = typeof state === 'object' && state !== null && 'searchReturnTo' in state && typeof state.searchReturnTo === 'string'
    ? state.searchReturnTo : null
  const value = fromState ?? new URLSearchParams(search).get(BACK_PARAM)
  if (value === null) return '/'
  if (value === '/' || value === appPaths.chat || value === appPaths.savedPrograms) return value
  if (value.includes('#') || value.startsWith('//') || value.includes('://')) return '/'
  const queryIndex = value.indexOf('?')
  const path = queryIndex < 0 ? value : value.slice(0, queryIndex)
  const params = new URLSearchParams(queryIndex < 0 ? '' : value.slice(queryIndex + 1))
  // 관심 공고함은 보던 탭만 되살립니다. 모르는 탭 이름이면 기본 탭으로 돌아갑니다.
  if (path === appPaths.savedPrograms) return savedProgramsPath(readSavedProgramsViewMode(params.get('view')))
  if (path === '/' || path === appPaths.chat) {
    if (params.get('mode') !== 'filter') return '/'
    return `${path}?${writeCatalogFilters(readCatalogFilters(params))}`
  }
  // 상세·질문 화면 자신은 출처가 될 수 없고(되돌아가면 제자리), `..`·`//`로 다른 경로를 흉내 낸 값도 받지 않습니다.
  if (path.startsWith(appPaths.supportProgramDetail) || path.includes('//') || path.split('/').includes('..')) return '/'
  // 앱에 실제로 있는 화면 경로만 출처가 됩니다. appPaths에 화면을 더하면 자동으로 허용됩니다.
  const isKnownScreen = Object.values(appPaths).some((known) => {
    const base = known.replace(/\/:[^/]+/g, '')
    return path === base || path.startsWith(`${base}/`)
  })
  return isAppPath(path) && isKnownScreen ? value : '/'
}

/** 출처 화면의 이름입니다. 사이드바 메뉴 이름과 같은 말을 써서 어디로 돌아가는지 바로 읽히게 합니다. */
const returnLabels: ReadonlyArray<readonly [string, string]> = [
  [appPaths.savedPrograms, '관심 공고함으로'],
  [appPaths.reports, '기업 맞춤 리포트로'],
  [appPaths.combinationReviews, '중복 지원·수혜 검토로'],
  [appPaths.applicationPreparations, '신청 문서 작성으로'],
  [appPaths.partners, '파트너 모집으로'],
  [appPaths.proposals, '제안함으로'],
]

/** 상세 위 돌아가기 링크 문구입니다. 출처 화면 이름을 쓰고, 검색 화면이면 검색 결과로 돌아갑니다. */
export function supportProgramBackLabel(returnTo: SupportProgramSearchReturnTo): string {
  const matched = returnLabels.find(([prefix]) => returnTo === prefix || returnTo.startsWith(`${prefix}?`) || returnTo.startsWith(`${prefix}/`))
  return `← ${matched ? matched[1] : '검색 결과로'} 돌아가기`
}

/** 상세를 여는 화면이 자기 경로(쿼리 포함)를 출처로 넘길 때 씁니다. `/app` 밖이면 검색으로 돌아갑니다. */
export function supportProgramReturnToHere(location: { pathname: string; search: string }): SupportProgramSearchReturnTo {
  return location.pathname.startsWith(`${APP_PREFIX}/`) ? `${location.pathname}${location.search}` : '/'
}

/**
 * 진행 관리 파이프라인(준비 중~탈락)에서 넘어온 상세인지 나타냅니다. 그 공고는 신청을 준비 중인 사업이라
 * 관심 공고함에서 빼면 진행 관리에서도 보이지 않게 되므로, 빼기 전에 확인을 받는 데 씁니다.
 */
export function getSupportProgramFromPipeline(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'fromPipeline' in state && state.fromPipeline === true
}
