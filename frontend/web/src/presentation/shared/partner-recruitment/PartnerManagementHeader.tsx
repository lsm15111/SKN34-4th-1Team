import { Link } from 'react-router'

import { useAuthSession } from '../auth/hooks/useAuthSession'
import { partnerWriteLockedLabel } from '../auth/partnerAccess'
import { appPaths } from '../routes/appPaths'
import { workspacePageStyles } from '../workspace/WorkspacePage.styles'
import { WorkspacePageHeader } from '../workspace/WorkspacePageHeader'
import { type PartnerSection, PartnerSectionTabs } from './PartnerSectionTabs'

/**
 * 모집글·내 모집글·제안함 세 화면이 똑같이 쓰는 "파트너 관리" 머리글입니다. 제목·탭·작성 버튼을 한 줄에 두고 [active]만 다릅니다.
 * 쓰기가 잠긴 회원(개인·기업 미등록·휴업)은 작성 대신 프로필로 안내하고, 버튼 글자가 이유를 짧게 말합니다.
 */
export function PartnerManagementHeader({ active }: { active: PartnerSection }) {
  const { partnerWriteLock } = useAuthSession()
  const canWrite = partnerWriteLock === null

  return (
    <WorkspacePageHeader
      title="파트너 관리"
      tabs={<PartnerSectionTabs active={active} />}
      actions={
        <Link
          className={canWrite ? workspacePageStyles.primaryButton : workspacePageStyles.secondaryButton}
          to={canWrite ? appPaths.partnerNew : appPaths.profile}
          title={partnerWriteLock?.reason}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {partnerWriteLockedLabel(partnerWriteLock)}
        </Link>
      }
    />
  )
}
