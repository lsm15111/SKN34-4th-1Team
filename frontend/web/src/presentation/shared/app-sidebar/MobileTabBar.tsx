import { Link, useLocation } from 'react-router'

import { usePendingReceivedProposalCount } from '../partner-proposal/useReceivedProposals'
import { useAuthSession } from '../auth/hooks/useAuthSession'
import { appPaths } from '../routes/appPaths'

/**
 * 좁은 화면(모바일)에서 작업 화면 아래에 고정되는 탭 5개입니다. 자주 가는 네 곳은 한 번에 가고,
 * 나머지 메뉴는 "더보기"가 사이드바 메뉴를 엽니다. 다섯 개를 넘기지 않는 것은 하단 탭의 통상 상한입니다.
 * 제안함에는 받은 제안 대기 수를 배지로 붙여 사이드바와 같은 신호를 줍니다.
 */
const tabClassName = 'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[0.66rem] font-bold no-underline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary'

function TabIcon({ name }: { name: 'search' | 'bookmark' | 'inbox' | 'mail' | 'building' | 'more' }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    bookmark: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
    inbox: <><path d="M4 5h16v14H4z" /><path d="M4 13h5l1.5 2h3L15 13h5" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
    more: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function MobileTabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { pathname } = useLocation()
  const pendingCount = usePendingReceivedProposalCount()
  const { account } = useAuthSession()
  // 개인 회원은 제안을 받을 수 없으므로 제안함 대신 프로필(기업 전환 카드가 있는 곳)을 둡니다.
  const fourth = account?.accountType === 'INDIVIDUAL'
    ? { label: '프로필', icon: 'building' as const, to: appPaths.profile, active: pathname.startsWith(appPaths.profile) }
    : { label: '제안함', icon: 'mail' as const, to: appPaths.proposals, active: pathname.startsWith(appPaths.proposals) }
  const tabs: { label: string; icon: 'search' | 'bookmark' | 'inbox' | 'mail' | 'building'; to: string; active: boolean }[] = [
    { label: '검색', icon: 'search', to: appPaths.chat, active: pathname === appPaths.chat || pathname.startsWith(appPaths.supportProgramDetail) },
    { label: '관심함', icon: 'bookmark', to: appPaths.savedPrograms, active: pathname.startsWith(appPaths.savedPrograms) },
    { label: '리포트', icon: 'inbox', to: appPaths.reports, active: pathname === appPaths.reports },
    fourth,
  ]
  const badge = pendingCount === null || pendingCount === 0 ? null : pendingCount > 99 ? '99+' : String(pendingCount)

  return (
    <nav className="flex shrink-0 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]" aria-label="모바일 하단 탭">
      {tabs.map((tab) => (
        <Link key={tab.to} to={tab.to} className={`${tabClassName} ${tab.active ? 'text-brand-primary' : 'text-ink-muted'}`}
          aria-current={tab.active ? 'page' : undefined}>
          <span className="relative">
            <TabIcon name={tab.icon} />
            {tab.label === '제안함' && badge ? (
              <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-danger px-1 text-[0.6rem] leading-4 text-white" aria-label={`대기 ${badge}건`}>{badge}</span>
            ) : null}
          </span>
          {tab.label}
        </Link>
      ))}
      <button type="button" className={`${tabClassName} cursor-pointer border-0 bg-transparent text-ink-muted`} onClick={onOpenMenu}>
        <TabIcon name="more" />
        더보기
      </button>
    </nav>
  )
}
