import { type BusinessLookup, formatBusinessNumber } from '../../../domain/entities/Company'
import { workspaceTagClassName } from '../workspace/WorkspacePage.styles'
import { companyFormStyles } from './CompanyForm.styles'
import { businessStatusNotes, businessStatusTone } from './companyRegistrationForm'

/**
 * 사업자 조회 결과 카드입니다. 상호·상태 배지·번호와 상태별 안내 한 줄을 보여 줍니다.
 * 계속은 녹색, 휴업은 주의(등록은 되지만 파트너 기능 잠김), 폐업은 위험(등록 불가)입니다. 살아 있는 영역이라 스크린 리더가 읽습니다.
 */
export function BusinessLookupResult({ business }: { business: BusinessLookup }) {
  const tone = businessStatusTone(business.businessStatusCode)
  const surface = tone === 'ok' ? companyFormStyles.lookupResultOk : tone === 'warn' ? companyFormStyles.lookupResultWarn : companyFormStyles.lookupResultDanger
  return (
    <div className={`${companyFormStyles.lookupResult} ${surface}`} role="status" aria-label="조회 결과">
      <div className={companyFormStyles.lookupHeadline}>
        <strong className={companyFormStyles.lookupName}>{business.companyName}</strong>
        <span className={workspaceTagClassName(tone)}>{business.businessStatus}</span>
      </div>
      <span className={companyFormStyles.lookupDetail}>{formatBusinessNumber(business.businessNumber)}</span>
      <span className={companyFormStyles.lookupNote}>{businessStatusNotes[business.businessStatusCode]}</span>
    </div>
  )
}
