import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

import { appContainer } from '../../../app/appContainer'
import { useAppDispatch, useAppSelector, useAppStore } from '../../../app/hooks'
import { useAuthSession } from '../auth/hooks/useAuthSession'
import {
  gettingStartedLoaded,
  selectGettingStartedReadAt,
  selectGettingStartedRefreshToken,
  selectGettingStartedRevision,
} from './state/gettingStartedSlice'

/** 화면을 옮길 때 다시 읽는 최소 간격입니다. 도우미를 열면 이 간격과 관계없이 바로 읽습니다. */
export const gettingStartedRefreshMs = 15_000

/**
 * 시작하기 안내를 읽어 Redux에 둡니다(GET · 모델 호출 없음). 작업 화면 틀에 한 번만 두며 아무것도 그리지 않습니다.
 * 로그인해 작업 화면에 들어오면 바로, 화면을 옮기면 마지막으로 읽은 지 15초가 지났을 때, 도우미를 열면 곧바로 다시 읽습니다.
 * 이미 읽는 중이면 그 결과를 기다립니다. 못 읽으면 알리지 않습니다. 처음이면 사이드바에 그리지 않고, 전에 읽은 안내가 있으면
 * 그대로 두며 15초 뒤 화면 이동 때 다시 읽습니다.
 */
export function GettingStartedSync() {
  const useCase = appContainer.resolve('gettingStartedUseCase')
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const { account } = useAuthSession()
  const accountEmail = account?.email ?? null
  const { pathname } = useLocation()
  const refreshToken = useAppSelector(selectGettingStartedRefreshToken)
  const handledToken = useRef(refreshToken)
  const inFlight = useRef<AbortController | null>(null)
  /** 마지막으로 읽기에 실패한 시각(ms)입니다. 실패한 뒤에도 15초 동안은 화면 이동으로 다시 읽지 않습니다. */
  const failedAt = useRef(0)

  // 계정이 바뀌거나 작업 화면 틀이 사라지면 진행 중인 읽기를 끊습니다. 화면 이동으로는 끊지 않습니다.
  // 끊긴 읽기는 성공으로 치지 않으므로 다시 그려지면(개발 모드의 두 번 실행 포함) 곧바로 다시 읽습니다.
  useEffect(() => () => {
    inFlight.current?.abort()
    inFlight.current = null
    failedAt.current = 0
  }, [accountEmail])

  useEffect(() => {
    if (accountEmail === null) return
    const requested = handledToken.current !== refreshToken
    handledToken.current = refreshToken
    if (inFlight.current !== null) return
    const lastRead = Math.max(selectGettingStartedReadAt(store.getState()), failedAt.current)
    if (!requested && Date.now() - lastRead < gettingStartedRefreshMs) return
    const controller = new AbortController()
    inFlight.current = controller
    // 읽는 사이 닫기·다시 보기를 저장하면 revision이 올라가 이 결과는 버려집니다.
    const revision = selectGettingStartedRevision(store.getState())
    useCase.guide(controller.signal)
      .then(
        (guide) => { if (!controller.signal.aborted) dispatch(gettingStartedLoaded({ accountEmail, guide, revision, at: Date.now() })) },
        () => { if (!controller.signal.aborted) failedAt.current = Date.now() },
      )
      .finally(() => { if (inFlight.current === controller) inFlight.current = null })
  }, [accountEmail, dispatch, pathname, refreshToken, store, useCase])

  return null
}
