import { Navigate } from 'react-router'

import { BusinessLookupResult } from '../../../shared/company/BusinessLookupResult'
import { BusinessNumberField } from '../../../shared/company/BusinessNumberField'
import { CompanyProfileFields } from '../../../shared/company/CompanyProfileFields'
import { companyFormStyles } from '../../../shared/company/CompanyForm.styles'
import { companyOnboardingMessages, useCompanyOnboardingViewModel } from '../viewmodel/useCompanyOnboardingViewModel'
import { onboardingStyles as s } from './Onboarding.styles'
import { OnboardingShell } from './OnboardingShell'

/**
 * 온보딩 2단계 · 기업을 등록할까요? 카드 하나 안에서 위에서 아래로 열립니다. 번호를 조회하기 전에는 정보 입력 폼이
 * 보이지 않고, 조회 결과가 계속·휴업이면 폼이 열립니다. 폐업은 결과 카드가 이유를 말하고 폼은 닫힌 채입니다.
 * [나중에 하기]는 처음부터 끝까지 항상 보입니다.
 */
export function CompanyOnboardingPage() {
  const vm = useCompanyOnboardingViewModel()
  if (vm.redirectTo !== null) return <Navigate replace to={vm.redirectTo} />

  return (
    <form className="contents" aria-label="기업 등록" onSubmit={vm.submit} noValidate>
      <OnboardingShell
        titleId="welcome-company-title"
        steps={[{ label: '기업 회원', state: 'done' }, { label: '기업 정보', state: 'on' }]}
        foot={
          <>
            {vm.formErrors.form ? <span className={s.error} role="alert">{vm.formErrors.form}</span> : null}
            <span className={s.grow} />
            <button type="button" className={s.quiet} onClick={vm.skip} disabled={vm.isSaving}>나중에 하기</button>
            <button type="submit" className={s.primary} disabled={vm.isSaving || !vm.canRegister}>{vm.isSaving ? '등록 중…' : '등록하고 시작'}</button>
          </>
        }
      >
        <div className={s.body}>
          <span className={s.eyebrow}>2 / 2 · 건너뛸 수 있어요</span>
          <h1 id="welcome-company-title" className={s.title}>기업을 등록할까요?</h1>
          <p className={s.lead}>사업자등록번호를 조회해 상호를 확인하고, 소재지·업종·설립연도만 적으면 끝이에요. 등록하면 파트너 모집글과 제안을 쓸 수 있어요.</p>
          <div className={s.card}>
            <BusinessNumberField
              id="welcome-businessNumber"
              value={vm.businessNumber}
              hint={vm.businessNumberHint}
              error={vm.formErrors.businessNumber}
              lookup={{ canLookup: vm.canLookup, isLooking: vm.isLooking, onLookup: vm.lookupBusiness }}
              onChange={vm.updateBusinessNumber}
            />
            {vm.lookup.status === 'found' ? <BusinessLookupResult business={vm.lookup.business} /> : null}
            {vm.lookup.status === 'failed' && vm.lookup.reason === 'unavailable' ? (
              <div className={s.unavailable} role="status" aria-label="조회 결과">
                <strong className={s.unavailableTitle}>{companyOnboardingMessages.lookupUnavailableTitle}</strong>
                <span className={s.unavailableBody}>{companyOnboardingMessages.lookupUnavailableBody}</span>
                <div className={s.unavailableActions}>
                  <button type="button" className={`${s.secondary} !h-9 text-[0.8rem]`} onClick={vm.lookupBusiness}>다시 시도</button>
                </div>
              </div>
            ) : null}
            {vm.canRegister ? (
              <>
                <CompanyProfileFields
                  idPrefix="welcome"
                  values={vm.form}
                  errors={vm.formErrors}
                  regions={vm.regions}
                  industries={vm.industries}
                  foundedYearMin={vm.foundedYearMin}
                  currentYear={vm.currentYear}
                  homepagePreview={vm.homepagePreview}
                  focusField={vm.focusField}
                  onFocused={vm.clearFocusField}
                  onChange={vm.updateForm}
                />
                <span className={companyFormStyles.formHint}>등록하면 상호와 사업자 상태는 바꿀 수 없고, 나머지는 프로필에서 언제든 고칠 수 있어요.</span>
              </>
            ) : null}
          </div>
        </div>
      </OnboardingShell>
    </form>
  )
}
