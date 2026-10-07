/** 시작하기 단계입니다. 서버가 화면에 보일 순서대로 보냅니다. */
export const gettingStartedStepIds = ['SIGN_UP', 'COMPANY', 'SAVE_PROGRAM', 'DEADLINE_REMINDER', 'DAILY_REPORT', 'START_PREPARATION'] as const
export type GettingStartedStepId = (typeof gettingStartedStepIds)[number]

/** LOCKED는 앞 단계를 마쳐야 할 수 있는 단계입니다(기업이 없을 때의 맞춤 리포트). */
export const gettingStartedStepStatuses = ['DONE', 'TODO', 'LOCKED'] as const
export type GettingStartedStepStatus = (typeof gettingStartedStepStatuses)[number]

export type GettingStartedStep = { id: GettingStartedStepId; status: GettingStartedStepStatus }

/**
 * 시작하기 안내입니다. 단계 완료는 서버가 이미 있는 기록(기업 등록·관심 공고·마감 알림·리포트·신청 준비)으로 계산합니다.
 * `visible`이면 보여 주고, `closed`이면 사용자가 닫아 숨긴 상태라 "시작하기 다시 보기"로 다시 열 수 있습니다.
 * 둘 다 거짓이면 기간이 지났거나 대상이 아니라 어디에도 두지 않습니다.
 */
export type GettingStartedGuide = {
  visible: boolean
  closed: boolean
  /** 처음으로 모든 단계를 마친 시각(서울 +09:00, ISO 8601)입니다. */
  completedAt: string | null
  steps: GettingStartedStep[]
}

/** 단계 이름입니다. 웹 사이드바·도우미와 앱 카드가 같은 이름을 씁니다. */
export const gettingStartedStepLabels: Record<GettingStartedStepId, string> = {
  SIGN_UP: '회원가입',
  COMPANY: '기업 등록하기',
  SAVE_PROGRAM: '관심 공고 담기',
  DEADLINE_REMINDER: '마감 알림 켜기',
  DAILY_REPORT: '맞춤 리포트 받기',
  START_PREPARATION: '신청 준비 시작하기',
}

/** 끝낸 단계 수와 전체 단계 수입니다. 잠긴 단계도 전체에 셉니다. 예: 기업 회원이 가입·기업 등록을 마쳤으면 2/6입니다. */
export function gettingStartedProgress(guide: Pick<GettingStartedGuide, 'steps'>): { done: number; total: number } {
  return { done: guide.steps.filter((step) => step.status === 'DONE').length, total: guide.steps.length }
}

/** 다음에 할 단계입니다. 잠기지 않은 첫 할 일이며, 남은 할 일이 없으면 null입니다. */
export function nextGettingStartedStep(guide: Pick<GettingStartedGuide, 'steps'>): GettingStartedStep | null {
  return guide.steps.find((step) => step.status === 'TODO') ?? null
}
