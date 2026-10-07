import { vi } from 'vitest'

// 작업 화면 틀이 사이드바 "시작하기"를 위해 읽는 안내가 다른 기능 테스트의 순차 fetch 응답을 소비하지 않게 경계만 격리합니다.
// 응답이 오지 않으므로 시작하기와 도우미의 "다음에 뭘 하면 되나요?"는 그려지지 않습니다. API 테스트는 이 mock을 해제하고,
// 화면 테스트는 UseCase를 직접 바꿔 검증합니다.
vi.mock('../data/api/gettingStartedApi', async (importOriginal) => ({
  ...await importOriginal<object>(),
  gettingStartedRequest: () => new Promise(() => {}),
}))
