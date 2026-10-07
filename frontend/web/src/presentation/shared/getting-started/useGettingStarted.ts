import { useCallback, useEffect, useRef, useState } from 'react'
import type { GettingStartedGuide } from '@govbiz/shared/domain/entities/GettingStarted'

import { appContainer } from '../../../app/appContainer'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { useAuthSession } from '../auth/hooks/useAuthSession'
import { gettingStartedRefreshRequested, gettingStartedSaved, selectGettingStartedGuide } from './state/gettingStartedSlice'

/** 지금 계정의 시작하기 안내입니다. 아직 읽지 못했거나 읽기에 실패했으면 null입니다. 읽는 일은 `GettingStartedSync`가 맡습니다. */
export function useGettingStartedGuide(): GettingStartedGuide | null {
  return useAppSelector(selectGettingStartedGuide)
}

/** 도우미를 열 때처럼 다음 주기를 기다리지 않고 바로 다시 읽게 합니다. */
export function useRefreshGettingStarted(): () => void {
  const dispatch = useAppDispatch()
  return useCallback(() => { dispatch(gettingStartedRefreshRequested()) }, [dispatch])
}

type GettingStartedAction = 'close' | 'reopen'

/**
 * [닫기]와 [시작하기 다시 보기]입니다. 서버에 닫은 상태만 저장하고, 돌려받은 안내를 바로 반영합니다.
 * 실패하면 화면에 남길 수 있도록 어떤 동작이 실패했는지 알려 주고 안내는 그대로 둡니다.
 */
export function useGettingStartedActions() {
  const useCase = appContainer.resolve('gettingStartedUseCase')
  const dispatch = useAppDispatch()
  const { account } = useAuthSession()
  const accountEmail = account?.email ?? null
  const [pending, setPending] = useState<GettingStartedAction | null>(null)
  const [failed, setFailed] = useState<GettingStartedAction | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const save = useCallback(async (action: GettingStartedAction): Promise<boolean> => {
    if (accountEmail === null) return false
    setPending(action)
    setFailed(null)
    try {
      const guide = await (action === 'close' ? useCase.close() : useCase.reopen())
      dispatch(gettingStartedSaved({ accountEmail, guide }))
      return true
    } catch {
      if (mounted.current) setFailed(action)
      return false
    } finally {
      if (mounted.current) setPending(null)
    }
  }, [accountEmail, dispatch, useCase])

  return {
    pending,
    failed,
    close: useCallback(() => save('close'), [save]),
    reopen: useCallback(() => save('reopen'), [save]),
  }
}
