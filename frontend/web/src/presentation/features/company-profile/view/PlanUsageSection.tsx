import { Link } from 'react-router'

import {
  isNearPlanLimit,
  planLabels,
  planUsageCountText,
  planUsageFeatureLabels,
  planUsageResetText,
  type PlanUsageItem,
} from '@govbiz/shared/domain/entities/PlanUsage'
import { planUsagePercent } from '../../../shared/plan-usage/planUsageView'
import type { PlanUsageLoad } from '../../../shared/plan-usage/usePlanUsage'
import { appPaths } from '../../../shared/routes/appPaths'
import { workspacePageStyles, workspaceTagClassName } from '../../../shared/workspace/WorkspacePage.styles'
import { companyProfileStyles } from './CompanyProfilePage.styles'

/**
 * 프로필의 요금제와 이용량 카드입니다. 지금 요금제와 기능별로 이번 기간에 쓴 양, 다시 채워지는 때를 보여 줍니다.
 * 결제는 아직 없으므로 요금제를 바꾸는 동작은 두지 않고 요금제 안내 화면으로만 잇습니다.
 */
export function PlanUsageSection({ load, onRetry }: { load: PlanUsageLoad; onRetry: () => void }) {
  const plan = load.status === 'ready' ? load.usage.plan : null
  return (
    <section className={workspacePageStyles.card} aria-label="요금제와 이용량">
      <div className={workspacePageStyles.cardHeader}>
        <h2 className={workspacePageStyles.cardTitle}>요금제와 이용량</h2>
        {plan !== null ? <span className={workspaceTagClassName('ok')}>{planLabels[plan]}</span> : null}
      </div>
      {load.status === 'loading' ? (
        <p className={workspacePageStyles.emptyNote} aria-live="polite">이용량을 불러오는 중이에요.</p>
      ) : null}
      {load.status === 'failed' ? (
        <div className={companyProfileStyles.settingRow}>
          <span className={companyProfileStyles.settingDescription} role="alert">이용량을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</span>
          <button className={workspacePageStyles.secondaryButton} type="button" onClick={onRetry}>다시 시도</button>
        </div>
      ) : null}
      {load.status === 'ready' ? (
        <ul className={companyProfileStyles.planUsageRows} aria-label="기능별 이용량">
          {load.usage.items.map((item) => <PlanUsageRow key={item.feature} item={item} />)}
        </ul>
      ) : null}
      <p className={companyProfileStyles.planNote}>
        결제는 아직 받지 않아요. 요금제별 한도는 요금제 화면에서 볼 수 있어요.{' '}
        <Link className={workspacePageStyles.quietLink} to={appPaths.pricing}>요금제 보기</Link>
      </p>
    </section>
  )
}

/** 기능 하나의 줄입니다. 진행 막대는 쓴 양을 한도 안에서만 채우고 화면 읽기 프로그램에는 "오늘 3/10회"처럼 읽힙니다. */
function PlanUsageRow({ item }: { item: PlanUsageItem }) {
  const label = planUsageFeatureLabels[item.feature]
  const countText = planUsageCountText(item)
  const near = isNearPlanLimit(item)
  return (
    <li className={companyProfileStyles.planUsageRow}>
      <div className={companyProfileStyles.planUsageRowHead}>
        <span className={companyProfileStyles.accountValue}>{label}</span>
        <span className={near ? companyProfileStyles.planUsageCountWarning : companyProfileStyles.planUsageCount}>{countText}</span>
      </div>
      <div
        className={companyProfileStyles.planUsageTrack}
        role="progressbar"
        aria-label={`${label} 이용량`}
        aria-valuenow={Math.min(item.used, item.limit)}
        aria-valuemin={0}
        aria-valuemax={item.limit}
        aria-valuetext={countText}
      >
        <div className={near ? companyProfileStyles.planUsageBarWarning : companyProfileStyles.planUsageBar} style={{ width: `${planUsagePercent(item)}%` }} />
      </div>
      <span className={companyProfileStyles.planUsageReset}>{planUsageResetText(item)}</span>
    </li>
  )
}
