import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { publicPaths } from '../../../shared/routes/appPaths'
import type { OnboardingIcon } from '../viewmodel/onboardingOptions'
import { onboardingStyles as s } from './Onboarding.styles'

const iconPaths: Record<OnboardingIcon | 'info' | 'check', string> = {
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5M12 8h.01',
  check: 'M5 12l4 4L19 6',
}

export function OnboardingIconGlyph({ name, size = 18 }: { name: keyof typeof iconPaths; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  )
}

export type OnboardingStep = { label: string; state: 'on' | 'done' | 'idle' }

/**
 * 온보딩 두 화면의 껍데기입니다. 로고와 단계 알약(1 회원 유형 · 2 기업 정보), 제목 영역, 버튼 줄을 같은 자리에 두어
 * 1단계에서 2단계로 넘어가도 화면이 흔들리지 않습니다. 사이드바·도우미 없이 단독으로 뜹니다.
 */
export function OnboardingShell({ titleId, steps, children, foot }: {
  titleId: string
  steps: OnboardingStep[]
  children: ReactNode
  foot: ReactNode
}) {
  const current = steps.findIndex((step) => step.state === 'on') + 1
  return (
    <main className={s.page} aria-labelledby={titleId}>
      <div className={s.block}>
        <div className={s.top}>
          <Link className={s.brand} to={publicPaths.landing} aria-label="GovBiz 홈으로"><span className={s.brandMark} aria-hidden="true">G</span>GovBiz</Link>
          <ol className={s.steps} aria-label="온보딩 단계">
            {steps.map((step, index) => (
              <li key={step.label} className={`${s.step} ${step.state === 'on' ? s.stepOn : step.state === 'done' ? s.stepDone : ''}`} aria-current={step.state === 'on' ? 'step' : undefined}>
                <span className={`${s.stepMark} ${step.state === 'idle' ? '' : s.stepMarkOn}`} aria-hidden="true">
                  {step.state === 'done' ? <OnboardingIconGlyph name="check" size={10} /> : index + 1}
                </span>
                {step.state === 'on' ? <span className={s.stepMobileOnly}>/{steps.length}&nbsp;</span> : null}
                {step.label}
              </li>
            ))}
          </ol>
        </div>
        {current > 1 ? (
          <div className={s.progress} aria-hidden="true">
            <div className={s.progressFill} style={{ width: `${(current / steps.length) * 100}%` }} />
          </div>
        ) : null}
        {children}
        <div className={s.foot}>{foot}</div>
      </div>
    </main>
  )
}
