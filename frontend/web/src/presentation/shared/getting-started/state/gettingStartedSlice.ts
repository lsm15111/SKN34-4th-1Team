import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { GettingStartedGuide } from '@govbiz/shared/domain/entities/GettingStarted'

import type { RootState } from '../../../../app/store'
import { sessionRestored, signedIn, signedOut } from '../../auth/state/authSlice'

/**
 * 계정의 시작하기 안내 서버 사본입니다. 사이드바 체크리스트와 도우미의 "다음에 뭘 하면 되나요?"가 함께 읽으므로 Redux에 둡니다.
 * `readAt`은 마지막으로 읽기에 성공한 시각(ms)으로 화면 이동 때 다시 읽을지 정하고(작업 화면 틀이 다시 그려져도 유지),
 * `refreshToken`은 도우미를 열었을 때 바로 다시 읽게 합니다. `revision`은 닫기·다시 보기 저장과 계정 전환마다 올라가,
 * 그 전에 시작한 읽기가 늦게 도착해도 덮어쓰지 못하게 합니다.
 */
type GettingStartedState = {
  accountEmail: string | null
  guide: GettingStartedGuide | null
  readAt: number
  refreshToken: number
  revision: number
}

const initialState: GettingStartedState = { accountEmail: null, guide: null, readAt: 0, refreshToken: 0, revision: 0 }

/** 다른 계정으로 바뀌면 이전 계정의 안내를 지우고, 진행 중이던 읽기 결과도 받지 않습니다. */
function switchAccount(state: GettingStartedState, accountEmail: string | null): GettingStartedState {
  if (state.accountEmail === accountEmail) return state
  return { ...initialState, accountEmail, refreshToken: state.refreshToken, revision: state.revision + 1 }
}

const gettingStartedSlice = createSlice({
  name: 'gettingStarted',
  initialState,
  reducers: {
    /** 읽은 안내와 읽은 시각입니다. 읽는 사이 저장했거나 계정이 바뀌었으면(`revision`이 다르면) 버립니다. */
    gettingStartedLoaded(state, action: PayloadAction<{ accountEmail: string; guide: GettingStartedGuide; revision: number; at: number }>) {
      if (action.payload.revision !== state.revision || action.payload.accountEmail !== state.accountEmail) return
      state.guide = action.payload.guide
      state.readAt = action.payload.at
    },
    /** 닫기·다시 보기를 저장한 결과입니다. 진행 중인 읽기 결과보다 우선합니다. */
    gettingStartedSaved(state, action: PayloadAction<{ accountEmail: string; guide: GettingStartedGuide }>) {
      if (action.payload.accountEmail !== state.accountEmail) return
      state.guide = action.payload.guide
      state.revision += 1
    },
    gettingStartedRefreshRequested(state) {
      state.refreshToken += 1
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signedOut, (state) => switchAccount(state, null))
      .addCase(signedIn, (state, action) => switchAccount(state, action.payload.email))
      .addCase(sessionRestored, (state, action) => switchAccount(state, action.payload?.email ?? null))
  },
})

export const { gettingStartedLoaded, gettingStartedSaved, gettingStartedRefreshRequested } = gettingStartedSlice.actions

function isCurrentAccount(state: RootState): boolean {
  return state.gettingStarted.accountEmail !== null && state.gettingStarted.accountEmail === state.auth.account?.email
}

/** 지금 로그인한 계정의 안내입니다. 아직 읽지 못했으면 null입니다. */
export const selectGettingStartedGuide = (state: RootState): GettingStartedGuide | null =>
  (isCurrentAccount(state) ? state.gettingStarted.guide : null)
export const selectGettingStartedReadAt = (state: RootState) => (isCurrentAccount(state) ? state.gettingStarted.readAt : 0)
export const selectGettingStartedRefreshToken = (state: RootState) => state.gettingStarted.refreshToken
export const selectGettingStartedRevision = (state: RootState) => state.gettingStarted.revision

export default gettingStartedSlice.reducer
