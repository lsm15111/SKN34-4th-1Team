import { Link } from 'react-router'

import { useAuthSession } from '../auth/hooks/useAuthSession'
import { appPaths } from '../routes/appPaths'
import { workspacePageStyles } from '../workspace/WorkspacePage.styles'
import { WorkspacePageHeader } from '../workspace/WorkspacePageHeader'

/**
 * "파트너 모집" 목록의 머리글입니다. 제목과 작성 버튼을 한 줄에 둡니다. 내 글은 목록의 "내가 쓴 모집글만" 칩으로 봅니다.
 * 이름은 사이드바 항목과 같은 "파트너 모집"입니다. 제안함은 제 머리글을 씁니다.
 * 기업을 등록하지 않은 회원은 작성 대신 프로필 등록으로 안내합니다.
 */
export function PartnerManagementHeader() {
  const { hasCompany } = useAuthSession()

  return (
    <WorkspacePageHeader
      title="파트너 모집"
      actions={
        <Link
          className={hasCompany ? workspacePageStyles.primaryButton : workspacePageStyles.secondaryButton}
          to={hasCompany ? appPaths.partnerNew : appPaths.profile}
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
          {hasCompany ? '모집글 작성' : '기업 등록 후 작성'}
        </Link>
      }
    />
  )
}
