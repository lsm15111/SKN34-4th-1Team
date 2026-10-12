import { useEffect, useState } from 'react'
import {
  formatSupportProgramSearchElapsed, supportProgramSearchElapsedSeconds, supportProgramSearchSteps, supportProgramSearchWaitNote,
} from '@govbiz/shared/domain/entities/SupportProgramSearchProgress'

import { chatPageStyles } from './ChatPage.styles'

/**
 * 검색 대기 말풍선의 단계·지난 시간·안내입니다. 단계는 화면이 아는 사건으로만 넘기고(조건 정리는 보낸 순간 완료),
 * 서버가 하는 공고 찾기·자격 확인은 보통 걸리는 시간만 적습니다. 지난 시간은 매초 바뀌므로 읽어 주는 영역에 두지 않습니다.
 */
export function SearchProgress({ startedAt }: { startedAt: number | null }) {
  const elapsed = useElapsedSeconds(startedAt)
  const note = elapsed === null ? null : supportProgramSearchWaitNote(elapsed)
  return (
    <>
      <ol className={chatPageStyles.searchSteps} aria-label="검색 단계">
        {supportProgramSearchSteps.map((step) => (
          <li key={step.label} className={chatPageStyles.searchStep}>
            <span className={step.state === 'done' ? chatPageStyles.searchStepDoneMark : chatPageStyles.searchStepRunningMark} aria-hidden="true">
              {step.state === 'done' ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 5 5 9-10" />
                </svg>
              ) : null}
            </span>
            <span className={chatPageStyles.searchStepLabel}>{step.label}</span>
            <span className={chatPageStyles.searchStepNote}>{step.note}</span>
          </li>
        ))}
      </ol>
      {elapsed ? <p className={chatPageStyles.searchElapsed}>{formatSupportProgramSearchElapsed(elapsed)} 지났어요</p> : null}
      {note ? <p className={chatPageStyles.loadingDescription}>{note}</p> : null}
    </>
  )
}

/** 검색을 보낸 시각부터 1초마다 지난 시간을 다시 셉니다. 시각을 모르면 null입니다. */
function useElapsedSeconds(startedAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (startedAt === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [startedAt])
  return startedAt === null ? null : supportProgramSearchElapsedSeconds(startedAt, now)
}
