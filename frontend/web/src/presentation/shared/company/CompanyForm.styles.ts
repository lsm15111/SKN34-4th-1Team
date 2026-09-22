function classes(...groups: string[]) {
  return groups.join(' ')
}

/**
 * 기업 등록 폼(사업자번호 조회·조회 결과·기본정보 입력)의 스타일입니다. 프로필의 등록·수정 폼과 온보딩 2단계가 같은 모양을 씁니다.
 * 조회 결과 카드는 사업자 상태에 따라 바탕색이 달라집니다. 계속은 회색, 휴업은 노란빛, 폐업은 붉은빛.
 */
export const companyFormStyles = {
  form: 'flex flex-col gap-3',
  formGrid: 'grid grid-cols-1 gap-3 @min-[32rem]/column:grid-cols-2',
  formField: 'flex min-w-0 flex-col gap-1',
  formFieldWide: '@min-[32rem]/column:col-span-2',
  formLabel: 'flex items-center gap-1 text-[0.72rem] font-bold text-sample-muted',
  optionalMark: 'font-medium text-sample-muted',
  input: classes(
    'min-h-10 w-full rounded-[0.75rem] border border-sample-border bg-white px-3 text-[0.85rem] text-app-ink',
    'placeholder:text-sample-muted focus:border-[#087f46] focus:shadow-[0_0_0_3px_rgb(8_127_70_/_12%)] focus:outline-0',
    'aria-[invalid=true]:border-[#c9505f]',
  ),
  lookupRow: 'flex flex-wrap items-end gap-2 [&>label]:min-w-[14rem] [&>label]:flex-1',
  lookupResult: 'flex flex-col gap-1 rounded-[0.85rem] px-4 py-3',
  lookupResultOk: 'bg-[#f6f7f8]',
  lookupResultWarn: 'bg-[#fff4e0]',
  lookupResultDanger: 'bg-[#fff5f6]',
  lookupHeadline: 'flex flex-wrap items-center gap-2',
  lookupName: 'text-[0.95rem] font-bold text-app-ink',
  lookupDetail: 'text-[0.75rem] text-sample-muted',
  lookupNote: 'text-[0.78rem] leading-[1.55] text-app-ink',
  formError: 'm-0 text-[0.78rem] font-bold text-[#9a3947]',
  formHint: 'text-[0.72rem] text-sample-muted',
  formActions: 'flex flex-wrap justify-end gap-2',
} as const
