import { workspacePageStyles } from '../workspace/WorkspacePage.styles'
import { companyFormStyles } from './CompanyForm.styles'

/**
 * 사업자등록번호 입력 칸과 [조회] 버튼입니다. 숫자만 받아 `000-00-00000`로 붙이는 것은 `useBusinessLookup`이 하고,
 * 여기서는 10자리가 될 때까지 버튼을 잠그고 오류·안내 한 줄만 보여 줍니다. 프로필 등록 폼과 온보딩 2단계가 함께 씁니다.
 */
export function BusinessNumberField({ id, value, hint, error, lookup, onChange }: {
  id: string
  value: string
  hint: string
  error?: string
  lookup: { canLookup: boolean; isLooking: boolean; onLookup: () => void }
  onChange: (value: string) => void
}) {
  return (
    <>
      <div className={companyFormStyles.lookupRow}>
        <label className={companyFormStyles.formField} htmlFor={id}>
          <span className={companyFormStyles.formLabel}>사업자등록번호</span>
          <input
            className={companyFormStyles.input}
            id={id}
            type="text"
            name="businessNumber"
            inputMode="numeric"
            autoComplete="off"
            maxLength={12}
            placeholder="000-00-00000"
            aria-invalid={error !== undefined}
            aria-describedby={error ? `${id}-error` : `${id}-hint`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <button className={workspacePageStyles.secondaryButton} type="button" onClick={lookup.onLookup} disabled={lookup.isLooking || !lookup.canLookup}>
          {lookup.isLooking ? '조회 중…' : '조회'}
        </button>
      </div>
      {error
        ? <p id={`${id}-error`} className={companyFormStyles.formError} role="alert">{error}</p>
        : <span id={`${id}-hint`} className={companyFormStyles.formHint}>{hint}</span>}
    </>
  )
}
