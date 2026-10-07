import { describe, expect, it } from 'vitest'

import { appPaths, publicPaths } from '../routes/appPaths'
import {
  findHelpEntriesByKeyword, findHelpEntry, findOfferedHelpEntry, helpActionHref, helpEntries, helpEntriesForRoute, helpEntriesForSurface,
  isHelpEntryOffered, offeredChatbotHelpEntries,
} from './helpContent'
import type { HelpFeature } from './helpTypes'

const knownPaths = new Set<string>(Object.values(appPaths).filter((path) => !path.includes(':')))
const pathOf = (to: string) => to.split('?')[0] ?? ''

describe('도움말 항목', () => {
  it('id가 겹치지 않고 related는 실제 있는 항목만 가리킨다', () => {
    const ids = helpEntries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entry of helpEntries) {
      for (const related of entry.related) {
        expect(findHelpEntry(related), `${entry.id}의 related ${related}`).toBeDefined()
        expect(related).not.toBe(entry.id)
      }
    }
  })

  it('표시에 쓰는 문구를 비워 두지 않는다', () => {
    for (const entry of helpEntries) {
      expect(entry.title.trim(), entry.id).not.toBe('')
      expect(entry.question.trim(), entry.id).not.toBe('')
      expect(entry.summary.trim(), entry.id).not.toBe('')
      expect(entry.body.length, entry.id).toBeGreaterThan(0)
      expect(entry.body.every((paragraph) => paragraph.trim() !== ''), entry.id).toBe(true)
      expect(entry.surfaces.length, entry.id).toBeGreaterThan(0)
      expect(entry.updatedOn, entry.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('막히는 지점은 다음에 갈 곳을 반드시 준다', () => {
    for (const entry of helpEntries.filter((candidate) => candidate.category === 'blocker')) {
      expect(entry.action, entry.id).not.toBeNull()
      expect(entry.action?.label.trim(), entry.id).not.toBe('')
    }
  })

  it('routes와 action은 실제 화면 경로만 쓴다', () => {
    for (const entry of helpEntries) {
      for (const route of entry.routes) expect(knownPaths.has(route), `${entry.id}의 route ${route}`).toBe(true)
      if (entry.action !== null) expect(knownPaths.has(pathOf(entry.action.to)), `${entry.id}의 action ${entry.action.to}`).toBe(true)
    }
  })

})

describe('화면별 추천 질문', () => {
  it('공개 랜딩과 작업 채팅이 같은 질문을 낸다', () => {
    const fromLanding = helpEntriesForRoute(publicPaths.landing).map((entry) => entry.id)
    expect(helpEntriesForRoute(appPaths.chat).map((entry) => entry.id)).toEqual(fromLanding)
    expect(fromLanding).toContain('search-score-meaning')
  })

  it('하위 경로에서도 해당 화면의 질문을 낸다', () => {
    const ids = helpEntriesForRoute(`${appPaths.combinationReviews}/new`, 5).map((entry) => entry.id)
    expect(ids).toContain('review-save-vs-run')
    expect(ids).toContain('review-input-revision')
    expect(ids).not.toContain('search-score-meaning')
  })

  it('그 화면을 지정한 항목만 낸다', () => {
    const ids = helpEntriesForRoute(appPaths.profile, 5).map((entry) => entry.id)
    expect(ids[0]).toBe('partner-write-requires-company')
    for (const id of ids) expect(findHelpEntry(id)?.routes.some((route) => appPaths.profile.startsWith(route)), id).toBe(true)
  })

  it('아는 화면이 없으면 추천 질문이 없고 개수 제한을 지킨다', () => {
    expect(helpEntriesForRoute(appPaths.adminAccounts)).toEqual([])
    expect(helpEntriesForRoute(appPaths.proposals).map((entry) => entry.id)).toEqual(['proposal-box'])
    expect(helpEntriesForRoute(appPaths.chat, 2)).toHaveLength(2)
  })

  it('준비 중 기능을 설명하는 항목은 두지 않는다', () => {
    expect(findHelpEntry('feature-status-preparing')).toBeUndefined()
  })

  it('챗봇 표면에 없는 항목은 추천하지 않는다', () => {
    const chatbotIds = new Set(helpEntriesForSurface('chatbot').map((entry) => entry.id))
    for (const entry of helpEntriesForRoute(appPaths.chat, 99)) expect(chatbotIds.has(entry.id)).toBe(true)
  })
})

describe('시작하기 도움말', () => {
  const offered: HelpFeature[] = ['getting-started']

  it('기능 상태를 아는 도우미 표면에만 두고 시작하기가 제공될 때만 쓴다', () => {
    const entry = findHelpEntry('getting-started')
    expect(entry).toMatchObject({ surfaces: ['chatbot'], requires: 'getting-started', audience: 'member' })
    for (const surface of ['guide', 'faq', 'manual'] as const) {
      expect(helpEntriesForSurface(surface).map((item) => item.id), surface).not.toContain('getting-started')
    }
    // 시작하기가 제공되지 않으면(꺼짐·기간 지남·관리자·비로그인) 도우미가 쓸 항목에서도 빠집니다.
    expect(offeredChatbotHelpEntries([]).map((item) => item.id)).not.toContain('getting-started')
    expect(offeredChatbotHelpEntries(offered).map((item) => item.id)).toContain('getting-started')
    expect(findOfferedHelpEntry('getting-started', [])).toBeUndefined()
    expect(findOfferedHelpEntry('getting-started', offered)?.id).toBe('getting-started')
    expect(isHelpEntryOffered(findHelpEntry('search-score-meaning')!, [])).toBe(true)
    expect(helpEntriesForRoute(appPaths.profile, 5).map((item) => item.id)).not.toContain('getting-started')
    expect(helpEntriesForRoute(appPaths.profile, 5, offered).map((item) => item.id)).toContain('getting-started')
  })

  it('AI가 꺼져도 제공되는 동안은 찾는 말로 찾고, 제공되지 않으면 찾지 않는다', () => {
    expect(findHelpEntry('getting-started')?.keywords).toEqual(['처음', '시작', '뭐부터', '다음에뭘'])
    for (const text of ['처음인데 뭐부터 해요?', '뭐부터 해요', '다음에 뭘 하면 되나요?', '시작은 어떻게 하나요']) {
      expect(findHelpEntriesByKeyword(text, offered).map((item) => item.id), text).toEqual(['getting-started'])
      expect(findHelpEntriesByKeyword(text, []), text).toEqual([])
    }
  })

  it('찾는 말이 없는 항목은 입력으로 찾지 않는다', () => {
    for (const text of ['점수가 뭐야?', '모집글은 어떻게 쓰나요?', '', '   ?']) {
      expect(findHelpEntriesByKeyword(text, offered), text).toEqual([])
    }
  })
})

describe('도움말이 안내하는 경로', () => {
  it('작업 화면에서는 내부 경로를 그대로 쓴다', () => {
    expect(helpActionHref(appPaths.profile, true)).toBe(appPaths.profile)
    expect(helpActionHref(`${appPaths.chat}?mode=filter`, true)).toBe(`${appPaths.chat}?mode=filter`)
  })

  it('공개 화면에서는 대응하는 공개 경로로 바꾸고 질의 문자열을 유지한다', () => {
    expect(helpActionHref(appPaths.chat, false)).toBe(publicPaths.landing)
    expect(helpActionHref(`${appPaths.chat}?mode=filter`, false)).toBe(`${publicPaths.landing}?mode=filter`)
    expect(helpActionHref(appPaths.pricing, false)).toBe(publicPaths.pricing)
    expect(helpActionHref(appPaths.partners, false)).toBe(publicPaths.partners)
  })

  it('공개 대응이 없는 화면은 그대로 두어 기존 경로 보호가 로그인으로 안내하게 한다', () => {
    expect(helpActionHref(appPaths.profile, false)).toBe(appPaths.profile)
    expect(helpActionHref(appPaths.combinationReviews, false)).toBe(appPaths.combinationReviews)
  })
})
