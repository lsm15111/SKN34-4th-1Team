import type { GettingStartedGuide } from '../entities/GettingStarted'

export interface GettingStartedRepository {
  guide(signal?: AbortSignal): Promise<GettingStartedGuide>
  /** 닫기(true)·다시 보기(false)를 저장하고 다시 계산한 안내를 돌려받습니다. */
  setClosed(closed: boolean, signal?: AbortSignal): Promise<GettingStartedGuide>
}
