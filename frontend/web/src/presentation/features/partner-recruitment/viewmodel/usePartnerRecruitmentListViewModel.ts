import { useSearchParams } from 'react-router'

import { appContainer } from '../../../../app/appContainer'
import type { PartnerRecruitmentSummary } from '../../../../domain/entities/PartnerRecruitment'
import type { ClosePartnerRecruitmentUseCase } from '../../../../domain/usecases/PartnerRecruitmentUseCases'
import { appPaths } from '../../../shared/routes/appPaths'
import { recruitmentCloseMessages } from './usePartnerRecruitmentDetailViewModel'
import { useState } from 'react'

import { partnerRoleLabels, type PartnerRole } from '../../../../domain/entities/PartnerRecruitment'
import {
  defaultPartnerRecruitmentQuery,
  hasPartnerRecruitmentNarrowing,
  partnerRecruitmentSortLabels,
  type PartnerRecruitmentQuery,
  type PartnerRecruitmentSort,
} from '../../../../domain/entities/PartnerRecruitmentQuery'
import { regionNamesWithoutNationwide } from '../../../../domain/entities/Region'
import { useAuthSession } from '../../../shared/auth/hooks/useAuthSession'
import { usePartnerRecruitmentBrowse } from '../../../shared/partner-recruitment/usePartnerRecruitmentBrowse'
import { toFilterChoiceOptions, type FilterChoiceOption } from '../../../shared/workspace/filterChoiceOptions'

const roleOptions: FilterChoiceOption[] = (Object.keys(partnerRoleLabels) as PartnerRole[])
  .map((role) => ({ value: role, label: partnerRoleLabels[role] }))
// "전체"가 전국 모집글까지 뜻하므로 전국은 선택지에 두지 않습니다.
const regionOptions = toFilterChoiceOptions(regionNamesWithoutNationwide)

/** 조회 버튼을 눌러야 적용되는 조건입니다. 정렬·내 글만은 바로 적용되므로 여기 없습니다. */
type PartnerRecruitmentDraft = Pick<PartnerRecruitmentQuery, 'keyword' | 'seekingRoles' | 'regions'>
const emptyDraft: PartnerRecruitmentDraft = { keyword: '', seekingRoles: [], regions: [] }

function toggled<Value>(values: Value[], value: Value): Value[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}
const sortOptions: FilterChoiceOption[] = (Object.keys(partnerRecruitmentSortLabels) as PartnerRecruitmentSort[])
  .map((sort) => ({ value: sort, label: partnerRecruitmentSortLabels[sort] }))

/**
 * 파트너 모집 목록의 대표 ViewModel입니다. 검색어·찾는 역할·지역은 입력 중인 초안으로 두었다가 조회 버튼에서 적용하고,
 * 정렬·페이지·내 글만 칩은 바로 적용해 모집 API로 조회합니다. 내 글은 카드에서 바로 수정·마감합니다. 세션의 기업 등록 여부로 작성 안내 문구를 정합니다(작성 버튼은 공용 파트너 관리 머리글이 맡음).
 */
type CloseState =
  | { status: 'idle' }
  | { status: 'confirming'; recruitment: PartnerRecruitmentSummary }
  | { status: 'closing'; recruitment: PartnerRecruitmentSummary }
  | { status: 'failed'; recruitment: PartnerRecruitmentSummary; message: string }

export function usePartnerRecruitmentListViewModel(
  closeUseCase: Pick<ClosePartnerRecruitmentUseCase, 'execute'> = appContainer.resolve('closePartnerRecruitmentUseCase'),
) {
  const { hasCompany } = useAuthSession()
  // 예전 "내 모집글" 주소(/app/partners/mine)는 ?mine=1로 넘어오므로 첫 조회부터 내 글만 봅니다.
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState<PartnerRecruitmentQuery>(() => ({ ...defaultPartnerRecruitmentQuery, mineOnly: searchParams.get('mine') === '1' }))
  const [closedIds, setClosedIds] = useState<ReadonlySet<number>>(new Set())
  const [closeState, setCloseState] = useState<CloseState>({ status: 'idle' })
  const [draft, setDraft] = useState<PartnerRecruitmentDraft>(emptyDraft)
  const { phase, page, retry } = usePartnerRecruitmentBrowse(query)

  // 카드에서 마감한 글은 다시 읽지 않고 그 카드만 마감 상태로 바꿉니다. 내 글만 볼 때는 마감된 글을 뒤로 보냅니다.
  const recruitments = (page?.recruitments ?? [])
    .map((recruitment) => (closedIds.has(recruitment.id) ? { ...recruitment, status: 'CLOSED' as const } : recruitment))
    .sort((a, b) => (query.mineOnly ? Number(a.status === 'CLOSED') - Number(b.status === 'CLOSED') : 0))

  async function confirmClose() {
    if (closeState.status !== 'confirming' && closeState.status !== 'failed') return
    const target = closeState.recruitment
    setCloseState({ status: 'closing', recruitment: target })
    try {
      const outcome = await closeUseCase.execute(target.id)
      switch (outcome.outcome) {
        case 'closed':
          setClosedIds((current) => new Set([...current, target.id]))
          setCloseState({ status: 'idle' })
          return
        case 'already-closed':
          setClosedIds((current) => new Set([...current, target.id]))
          setCloseState({ status: 'failed', recruitment: target, message: recruitmentCloseMessages.alreadyClosed })
          return
        case 'forbidden':
          setCloseState({ status: 'failed', recruitment: target, message: recruitmentCloseMessages.notMine })
          return
        case 'not-found':
          setCloseState({ status: 'failed', recruitment: target, message: recruitmentCloseMessages.notFound })
          return
      }
    } catch {
      setCloseState({ status: 'failed', recruitment: target, message: recruitmentCloseMessages.failed })
    }
  }

  /** 조건이 바뀌면 첫 페이지부터 다시 봅니다. */
  function update(patch: Partial<PartnerRecruitmentQuery>) {
    setQuery((current) => ({ ...current, page: 1, ...patch }))
  }

  return {
    hasCompany,
    phase,
    recruitments,
    total: page?.total ?? 0,
    totalPages: page?.totalPages ?? 0,
    retry,
    query,
    draft,
    roleOptions,
    regionOptions,
    sortOptions,
    updateKeyword: (keyword: string) => setDraft((current) => ({ ...current, keyword })),
    toggleSeekingRole: (role: string) => setDraft((current) => ({ ...current, seekingRoles: toggled(current.seekingRoles, role as PartnerRole) })),
    clearSeekingRoles: () => setDraft((current) => ({ ...current, seekingRoles: [] })),
    toggleRegion: (region: string) => setDraft((current) => ({ ...current, regions: toggled(current.regions, region) })),
    clearRegions: () => setDraft((current) => ({ ...current, regions: [] })),
    /** 조회 버튼·Enter로 초안을 적용합니다. */
    submitSearch: () => update({ ...draft, keyword: draft.keyword.trim() }),
    selectSort: (sort: string) => update({ sort: sort as PartnerRecruitmentSort }),
    /** "내가 쓴 모집글만" 칩입니다. 같은 객체(모집글)의 필터라 탭이 아니라 칩이고 바로 적용됩니다. */
    toggleMineOnly: () => update({ mineOnly: !query.mineOnly }),
    editPathFor: (id: number) => `${appPaths.partnerEdit}?${new URLSearchParams({ recruitmentId: String(id) })}`,
    closingRecruitment: closeState.status === 'idle' ? null : closeState.recruitment,
    isClosing: closeState.status === 'closing',
    closeError: closeState.status === 'failed' ? closeState.message : null,
    openCloseConfirm: (recruitment: PartnerRecruitmentSummary) => setCloseState({ status: 'confirming', recruitment }),
    cancelClose: () => setCloseState({ status: 'idle' }),
    confirmClose,
    goToPage: (target: number) => setQuery((current) => ({ ...current, page: target })),
    hasActiveNarrowing: hasPartnerRecruitmentNarrowing(query),
    clearNarrowing: () => {
      setDraft(emptyDraft)
      setQuery({ ...defaultPartnerRecruitmentQuery, sort: query.sort })
    },
    // 처음 읽기 전에도 "0건 · 정렬"로 보여 건수 자리를 비우지 않습니다.
    resultSummary: `${page?.total ?? 0}건 · ${partnerRecruitmentSortLabels[query.sort]}`,
  }
}
