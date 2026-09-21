import { Link } from 'react-router'

import { appPaths } from '../routes/appPaths'
import { workspaceChipClassName } from '../workspace/WorkspacePage.styles'

export type PartnerSection = 'recruitments' | 'mine'

const partnerSectionTabStyles = {
  nav: 'flex flex-wrap items-center gap-2',
} as const

/**
 * "파트너 모집"의 두 보기(모집글·내 모집글)를 오가는 탭입니다. 같은 객체(모집글)의 다른 보기라 탭이 맞습니다.
 * 제안함은 다른 객체(받은·보낸 제안)라 여기 두지 않고 사이드바의 독립 항목입니다. 주소는 그대로라 기존 링크와 복귀 경로가 유지됩니다.
 */
export function PartnerSectionTabs({ active }: { active: PartnerSection }) {
  const tabs: { key: PartnerSection; label: string; to: string }[] = [
    { key: 'recruitments', label: '모집글', to: appPaths.partners },
    { key: 'mine', label: '내 모집글', to: appPaths.myPartners },
  ]

  return (
    <nav className={partnerSectionTabStyles.nav} aria-label="파트너 모집 탭">
      {tabs.map((tab) => (
        <Link
          className={workspaceChipClassName(tab.key === active)}
          key={tab.key}
          to={tab.to}
          aria-current={tab.key === active ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
