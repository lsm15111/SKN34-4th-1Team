import { matchPath } from 'react-router'
import {
  type GettingStartedGuide,
  type GettingStartedStepId,
  type GettingStartedStepStatus,
  gettingStartedStepLabels,
  nextGettingStartedStep,
} from '@govbiz/shared/domain/entities/GettingStarted'

import { appPaths, savedProgramsPath } from '../routes/appPaths'

/** 시작하기 문구입니다. 해요체로 한 줄에 25자 안팎이고, 느낌표·이모지·사과를 쓰지 않습니다. */
export const gettingStartedMessages = {
  title: '시작하기',
  progress: (done: number, total: number) => `${done}/${total} 완료`,
  close: '닫기',
  closeLabel: '시작하기 닫기',
  closing: '닫는 중…',
  closeFailed: '닫지 못했어요. 잠시 후 다시 눌러 주세요.',
  reopen: '시작하기 다시 보기',
  reopenFailed: '다시 열지 못했어요. 잠시 후 다시 눌러 주세요.',
  status: { DONE: '완료', TODO: '할 일', LOCKED: '잠김' } satisfies Record<GettingStartedStepStatus, string>,
  statusNext: '다음 할 일',
  allDone: '모두 마쳤어요. 하루 뒤에 사라져요.',
} as const

/** 무언가를 쓰는 중인 화면입니다. 여기서는 사이드바에 시작하기를 두지 않아 작성에 끼어들지 않습니다. */
const composingRoutes = [
  appPaths.applicationPreparationNew,
  appPaths.applicationPreparationDetail,
  appPaths.combinationReviewNew,
  appPaths.combinationReviewDetail,
  appPaths.partnerNew,
  appPaths.partnerEdit,
] as const

/** 사이드바에 시작하기를 숨길 화면인지입니다. 환영·인증 화면에는 사이드바가 없어 따로 막지 않습니다. */
export function isGettingStartedHiddenOn(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '')
  return composingRoutes.some((route) => matchPath(route, path) !== null)
}

type GettingStartedStepCopy = {
  /** 사이드바에서 다음 할 일 아래에 보이는 한 줄입니다. 그 일을 하는 방법입니다. */
  hint: string | null
  /** 도우미 답에서 결론 다음에 오는 이유 한 줄입니다. */
  reason: string | null
  /** 지금 안 되는 것입니다. 도우미 답의 "아직 안 돼요" 줄이 됩니다. */
  limitation: string | null
  /** 잠겼을 때 사이드바에 보이는 이유 한 줄입니다. */
  lockedReason: string | null
  /** 그 일을 하는 화면입니다. 가입처럼 갈 화면이 없으면 null입니다. */
  to: string | null
  /** 도우미 답의 버튼 이름입니다. 화면만 열고 대신 실행하지 않습니다. */
  action: string | null
}

/** 단계별 안내입니다. 서버에 없는 단계가 오면 shared DTO가 먼저 걸러 이 표에 없는 단계는 오지 않습니다. */
export const gettingStartedStepCopy: Record<GettingStartedStepId, GettingStartedStepCopy> = {
  SIGN_UP: { hint: null, reason: null, limitation: null, lockedReason: null, to: null, action: null },
  COMPANY: {
    hint: '사업자등록번호로 조회해 등록해요.',
    reason: '등록하면 맞춤 리포트와 협업을 쓸 수 있어요.',
    limitation: '폐업한 사업자는 등록할 수 없어요.',
    lockedReason: null,
    to: appPaths.profile,
    action: '내 프로필 보기',
  },
  SAVE_PROGRAM: {
    hint: '검색 결과에서 [관심]을 눌러 담아요.',
    reason: '담은 공고는 마감 알림과 신청 준비로 이어져요.',
    limitation: null,
    lockedReason: null,
    to: appPaths.chat,
    action: '검색 화면 보기',
  },
  DEADLINE_REMINDER: {
    hint: '내 프로필의 계정과 알림에서 켜요.',
    reason: '관심 공고 마감 7·3·1일 전에 알려 드려요.',
    limitation: '이메일은 받을 주소를 먼저 확인해야 받아요.',
    lockedReason: null,
    to: appPaths.profile,
    action: '내 프로필 보기',
  },
  DAILY_REPORT: {
    hint: '리포트 화면에서 오늘 리포트를 만들어요.',
    reason: '기업 조건에 맞는 접수 중 공고를 골라 드려요.',
    limitation: '리포트는 하루에 한 번만 만들 수 있어요.',
    lockedReason: '기업을 등록하면 받을 수 있어요.',
    to: appPaths.reports,
    action: '리포트 보기',
  },
  START_PREPARATION: {
    hint: '신청 문서나 중복 검토를 시작해요.',
    reason: '관심 공고로 신청 문서를 미리 써 둘 수 있어요.',
    limitation: null,
    lockedReason: null,
    to: savedProgramsPath('pipeline'),
    action: '진행 관리 보기',
  },
}

/** 사이드바 체크리스트 한 줄입니다. */
export type GettingStartedItem = {
  id: GettingStartedStepId
  label: string
  status: GettingStartedStepStatus
  /** 다음 할 일(잠기지 않은 첫 할 일)만 강조합니다. */
  isNext: boolean
  /** 색이 아니라 글자로도 알리는 상태입니다. 낭독기에 읽히고 줄 끝에 작게 보입니다. */
  statusText: string
  /** 줄 아래 한 줄입니다. 다음 할 일은 하는 방법, 잠긴 단계는 이유이고 나머지는 없습니다. */
  note: string | null
  /** 그 일을 하는 화면입니다. 잠긴 단계와 가입은 링크가 없습니다. */
  to: string | null
}

export function gettingStartedItems(guide: Pick<GettingStartedGuide, 'steps'>): GettingStartedItem[] {
  const next = nextGettingStartedStep(guide)
  return guide.steps.map((step) => {
    const copy = gettingStartedStepCopy[step.id]
    const isNext = next?.id === step.id
    return {
      id: step.id,
      label: gettingStartedStepLabels[step.id],
      status: step.status,
      isNext,
      statusText: isNext ? gettingStartedMessages.statusNext : gettingStartedMessages.status[step.status],
      note: step.status === 'LOCKED' ? copy.lockedReason : isNext ? copy.hint : null,
      to: step.status === 'LOCKED' ? null : copy.to,
    }
  })
}
