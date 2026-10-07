import { appPaths, publicPaths } from '../routes/appPaths'

/** 로그인 뒤 돌아갈 경로를 `?next=`에 담습니다. 외부 주소로 새지 않도록 앱 안의 절대 경로만 허용합니다. */
export function loginPathFor(returnTo: string): string {
  return returnTo && returnTo !== publicPaths.landing ? `${publicPaths.login}?next=${encodeURIComponent(returnTo)}` : publicPaths.login
}

/** 회원가입과 로그인 사이에서도 선택한 검색 결과의 복귀 경로를 유지합니다. */
export function signupPathFor(returnTo: string): string {
  return returnTo && returnTo !== publicPaths.landing ? `${publicPaths.signup}?next=${encodeURIComponent(returnTo)}` : publicPaths.signup
}

export function readReturnPath(search: string, fallback: string = appPaths.chat): string {
  const next = new URLSearchParams(search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') && !/\p{C}/u.test(next) ? next : fallback
}

/** 환영 단계(회원 유형·기업 등록) 자신은 돌아갈 곳이 아닙니다. 마친 뒤 다시 환영 화면으로 오지 않게 합니다. */
function isWelcomePath(path: string): boolean {
  return path === appPaths.welcome || path.startsWith(`${appPaths.welcome}/`) || path.startsWith(`${appPaths.welcome}?`)
}

/**
 * 환영 단계 주소에 원래 가려던 곳을 `?next=`로 담습니다. 공고 상세에서 가입했으면 환영 단계를 마친 뒤 그 공고로 돌아갑니다.
 * 기본 도착지인 작업 채팅과 환영 단계 자신은 담지 않습니다.
 */
export function welcomeStepPathFor(step: string, returnTo: string): string {
  return !returnTo || returnTo === appPaths.chat || isWelcomePath(returnTo) ? step : `${step}?next=${encodeURIComponent(returnTo)}`
}

/** 환영 단계를 마치거나 [나중에 하기]를 누른 뒤 갈 곳입니다. `next`가 없거나 환영 단계를 가리키면 작업 채팅입니다. */
export function readWelcomeReturnPath(search: string): string {
  const next = readReturnPath(search)
  return isWelcomePath(next) ? appPaths.chat : next
}
