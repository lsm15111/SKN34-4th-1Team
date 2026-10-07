import { describe, expect, it } from 'vitest'
import { type GettingStartedGuide, gettingStartedStepIds } from '@govbiz/shared/domain/entities/GettingStarted'

import { gettingStartedItems, gettingStartedStepCopy, isGettingStartedHiddenOn } from './gettingStartedView'

const businessGuide: GettingStartedGuide = {
  visible: true,
  closed: false,
  completedAt: null,
  steps: [
    { id: 'SIGN_UP', status: 'DONE' },
    { id: 'COMPANY', status: 'DONE' },
    { id: 'SAVE_PROGRAM', status: 'TODO' },
    { id: 'DEADLINE_REMINDER', status: 'TODO' },
    { id: 'DAILY_REPORT', status: 'TODO' },
    { id: 'START_PREPARATION', status: 'TODO' },
  ],
}

describe('시작하기 체크리스트 줄', () => {
  it('첫 할 일만 다음 할 일로 강조하고 방법 한 줄을 붙이며, 끝낸 단계는 글자로도 완료를 알린다', () => {
    const items = gettingStartedItems(businessGuide)

    expect(items.map((item) => [item.label, item.statusText, item.isNext])).toEqual([
      ['회원가입', '완료', false],
      ['기업 등록하기', '완료', false],
      ['관심 공고 담기', '다음 할 일', true],
      ['마감 알림 켜기', '할 일', false],
      ['맞춤 리포트 받기', '할 일', false],
      ['신청 준비 시작하기', '할 일', false],
    ])
    expect(items.map((item) => item.note)).toEqual([null, null, '검색 결과에서 [관심]을 눌러 담아요.', null, null, null])
    // 가입은 갈 화면이 없고, 나머지는 그 일을 하는 화면으로 갑니다.
    expect(items.map((item) => item.to)).toEqual([
      null, '/app/profile', '/app/chat', '/app/profile', '/app/reports', '/app/saved-programs?view=pipeline',
    ])
  })

  it('잠긴 단계는 링크 없이 이유를 보이고 다음 할 일로 고르지 않는다', () => {
    const items = gettingStartedItems({
      steps: [
        { id: 'SIGN_UP', status: 'DONE' },
        { id: 'COMPANY', status: 'DONE' },
        { id: 'SAVE_PROGRAM', status: 'DONE' },
        { id: 'DEADLINE_REMINDER', status: 'DONE' },
        { id: 'DAILY_REPORT', status: 'LOCKED' },
        { id: 'START_PREPARATION', status: 'TODO' },
      ],
    })
    const locked = items.find((item) => item.id === 'DAILY_REPORT')!
    expect(locked).toMatchObject({ statusText: '잠김', isNext: false, to: null, note: '기업을 등록하면 받을 수 있어요.' })
    expect(items.find((item) => item.isNext)?.id).toBe('START_PREPARATION')
  })

  it('신청 문서·중복 검토·모집글을 쓰는 화면에서는 숨기고 목록·결과·보기 화면에서는 둔다', () => {
    for (const path of ['/app/application-preparations/new', '/app/application-preparations/12', '/app/combination-reviews/new',
      '/app/combination-reviews/3/', '/app/partners/new', '/app/partners/edit']) {
      expect(isGettingStartedHiddenOn(path), path).toBe(true)
    }
    for (const path of ['/app/chat', '/app/saved-programs', '/app/application-preparations', '/app/application-preparations/12/documents',
      '/app/combination-reviews', '/app/combination-reviews/3/runs/9', '/app/partners', '/app/profile', '/app/reports']) {
      expect(isGettingStartedHiddenOn(path), path).toBe(false)
    }
  })

  it('안내 문구는 해요체 한 줄이고 느낌표·이모지·사과가 없다', () => {
    for (const id of gettingStartedStepIds) {
      const copy = gettingStartedStepCopy[id]
      for (const line of [copy.hint, copy.reason, copy.limitation, copy.lockedReason].filter((value): value is string => value !== null)) {
        expect(line, `${id}: ${line}`).toMatch(/요\.$/)
        expect(line.length, `${id}: ${line}`).toBeLessThanOrEqual(30)
        expect(line, `${id}: ${line}`).not.toMatch(/[!！]|죄송|\p{Extended_Pictographic}/u)
      }
      if (id !== 'SIGN_UP') {
        expect(copy.to, id).not.toBeNull()
        expect(copy.action, id).toMatch(/ 보기$/)
      }
    }
  })
})
