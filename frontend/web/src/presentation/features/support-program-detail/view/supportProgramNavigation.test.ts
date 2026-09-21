import { describe, expect, it } from 'vitest'

import { appPaths } from '../../../shared/routes/appPaths'
import { getSupportProgramSearchReturnTo, supportProgramBackLabel, supportProgramReturnToHere } from './supportProgramNavigation'

describe('getSupportProgramSearchReturnTo', () => {
  it('검색 화면은 검증된 필터만, 관심 공고함은 보던 탭만 되살린다', () => {
    expect(getSupportProgramSearchReturnTo({ searchReturnTo: '/app/chat?mode=filter&region=서울' })).toContain('/app/chat?')
    expect(getSupportProgramSearchReturnTo({ searchReturnTo: '/app/chat?foo=1' })).toBe('/')
    expect(getSupportProgramSearchReturnTo({ searchReturnTo: '/app/saved-programs?view=list' })).toBe('/app/saved-programs?view=list')
    expect(getSupportProgramSearchReturnTo({ searchReturnTo: '/app/saved-programs?view=nope' })).toBe(appPaths.savedPrograms)
  })

  it('리포트·중복 검토처럼 상세를 여는 앱 내부 화면은 쿼리까지 그대로 출처가 된다', () => {
    expect(getSupportProgramSearchReturnTo({ searchReturnTo: appPaths.reports })).toBe(appPaths.reports)
    expect(getSupportProgramSearchReturnTo({ searchReturnTo: '/app/combination-reviews/5' })).toBe('/app/combination-reviews/5')
    expect(getSupportProgramSearchReturnTo({ searchReturnTo: '/app/partners/detail?recruitmentId=3' })).toBe('/app/partners/detail?recruitmentId=3')
  })

  it('외부 주소·해시·상세 자신·앱 밖 경로는 검색 화면으로 떨어뜨린다', () => {
    for (const value of ['https://evil.example/app/reports', '//evil.example', '/app/reports#x', '/app/support-programs/detail?sourceCode=BIZINFO&sourceProgramId=1', '/pricing', '/app//reports']) {
      expect(getSupportProgramSearchReturnTo({ searchReturnTo: value }), value).toBe('/')
    }
    expect(getSupportProgramSearchReturnTo(null, '?back=%2Fapp%2Freports')).toBe(appPaths.reports)
    expect(getSupportProgramSearchReturnTo(null, '?back=https%3A%2F%2Fevil.example')).toBe('/')
  })
})

describe('supportProgramBackLabel', () => {
  it('출처 화면 이름으로 돌아가기 문구를 만든다', () => {
    expect(supportProgramBackLabel('/')).toBe('← 검색 결과로 돌아가기')
    expect(supportProgramBackLabel('/app/chat?mode=filter')).toBe('← 검색 결과로 돌아가기')
    expect(supportProgramBackLabel('/app/saved-programs?view=list')).toBe('← 관심 공고함으로 돌아가기')
    expect(supportProgramBackLabel(appPaths.reports)).toBe('← 기업 맞춤 리포트로 돌아가기')
    expect(supportProgramBackLabel('/app/combination-reviews/5')).toBe('← 중복 지원·수혜 검토로 돌아가기')
    expect(supportProgramBackLabel('/app/partners/detail?recruitmentId=3')).toBe('← 파트너 모집으로 돌아가기')
  })
})

describe('supportProgramReturnToHere', () => {
  it('앱 안 화면은 자기 경로와 쿼리를, 앱 밖이면 검색을 출처로 준다', () => {
    expect(supportProgramReturnToHere({ pathname: '/app/combination-reviews/new', search: '' })).toBe('/app/combination-reviews/new')
    expect(supportProgramReturnToHere({ pathname: '/app/partners/detail', search: '?recruitmentId=3' })).toBe('/app/partners/detail?recruitmentId=3')
    expect(supportProgramReturnToHere({ pathname: '/partners/detail', search: '?recruitmentId=3' })).toBe('/')
  })
})
