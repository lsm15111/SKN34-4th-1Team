import { describe, expect, it } from 'vitest'
import type { GettingStartedGuide } from '@govbiz/shared/domain/entities/GettingStarted'

import { findHelpEntry } from '../help/helpContent'
import {
  type AssistantMessage,
  type AssistantQuickReply,
  assistantHelpTopics,
  findAssistantHelpTopic,
  freeTextAnswer,
  gettingStartedAnswer,
  gettingStartedQuickReply,
  helpAnswer,
  isAssistantHiddenOn,
  offeredHelpFeatures,
  offeredHelpTopics,
  quickRepliesFor,
  topicAnswer,
  withGettingStartedReplies,
} from './assistantConversation'
import { assistantMessages } from './assistantMessages'

describe('assistant launcher placement', () => {
  it('hides the launcher on chat screens whose composer it would cover and on standalone auth screens', () => {
    for (const path of ['/', '/app/chat', '/app/chat/', '/login', '/signup', '/app/welcome', '/examples/sample-item/hook']) {
      expect(isAssistantHiddenOn(path)).toBe(true)
    }
  })

  it('keeps the launcher on other screens, including ones with bottom bars that lift it instead', () => {
    for (const path of ['/pricing', '/partners', '/app/saved-programs', '/app/combination-reviews/new', '/app/application-preparations/12', '/app/support-programs/detail']) {
      expect(isAssistantHiddenOn(path)).toBe(false)
    }
  })
})

const member = { isAuthenticated: true, hasCompany: true, contactUrl: 'https://pf.kakao.com/_govbizTest/chat' }
const guest = { isAuthenticated: false, hasCompany: false, contactUrl: null }
const guide = (steps: GettingStartedGuide['steps']): GettingStartedGuide => ({ visible: true, closed: false, completedAt: null, steps })
const shownGuide = { visible: true, closed: false }
const closedGuide = { visible: false, closed: true }
/** 기능이 꺼졌거나 가입 30일·완료 24시간이 지났거나 관리자일 때 서버가 주는 상태입니다. */
const notOffered = { visible: false, closed: false }
const labels = (replies: AssistantQuickReply[]) => replies.map((reply) => reply.label)
const followUpsOf = (message: AssistantMessage) => (message.role === 'assistant' ? labels(message.followUps) : [])
const baseTopicLabels = ['지원사업 검색', '관심 공고·리포트', '중복 검토·신청 문서', '파트너·기업 등록']

describe('시작하기 빠른 답변', () => {
  it('시작하기가 제공되는 동안만 시작하기 도움말을 쓴다(보이거나 닫아 둔 동안)', () => {
    expect(offeredHelpFeatures(shownGuide)).toEqual(['getting-started'])
    expect(offeredHelpFeatures(closedGuide)).toEqual(['getting-started'])
    expect(offeredHelpFeatures(notOffered)).toEqual([])
    expect(offeredHelpFeatures(null)).toEqual([])
    // 늘 보이는 주제에는 계정·기업이 없고, 제공될 때만 끝에 붙습니다.
    expect(assistantHelpTopics.map((topic) => topic.label)).toEqual(baseTopicLabels)
    expect(offeredHelpTopics([]).map((topic) => topic.label)).toEqual(baseTopicLabels)
    expect(offeredHelpTopics(['getting-started']).map((topic) => topic.label)).toEqual([...baseTopicLabels, '계정·기업'])
  })

  it('시작하기가 보이면 회원 첫 화면에 계정·기업 주제와 바로 확인 맨 앞의 "다음에 뭘 하면 되나요?"를 한 번씩 둔다', () => {
    const replies = quickRepliesFor(member)
    const shown = withGettingStartedReplies(replies, shownGuide)

    expect(labels(shown)).toEqual([
      ...baseTopicLabels, '계정·기업', assistantMessages.quickGettingStarted,
      assistantMessages.quickSavedPrograms, assistantMessages.quickReceivedProposals, assistantMessages.quickContact,
    ])
    expect(shown[shown.findIndex((reply) => reply.kind === 'saved-programs') - 1]).toEqual(gettingStartedQuickReply)
    expect(withGettingStartedReplies(shown, shownGuide)).toEqual(shown)
  })

  it('닫아 둔 동안은 계정·기업 주제만 두고 "다음에 뭘 하면 되나요?"는 두지 않는다', () => {
    expect(labels(withGettingStartedReplies(quickRepliesFor(member), closedGuide))).toEqual([
      ...baseTopicLabels, '계정·기업', assistantMessages.quickSavedPrograms, assistantMessages.quickReceivedProposals, assistantMessages.quickContact,
    ])
  })

  it('제공되지 않으면(꺼짐·기간 지남·관리자·아직 못 읽음) 시작하기 주제·질문·알약을 모두 뺀다', () => {
    const replies = quickRepliesFor(member)
    const shown = withGettingStartedReplies(replies, shownGuide)
    for (const state of [notOffered, null]) {
      expect(withGettingStartedReplies(replies, state)).toBe(replies)
      // 전에 보이던 알약이 저장된 대화에 남아 있어도 보여 줄 때 뺍니다.
      expect(withGettingStartedReplies(shown, state)).toEqual(replies)
      const stale: AssistantQuickReply[] = [
        { id: 'help:getting-started', label: findHelpEntry('getting-started')!.question, kind: 'help', helpId: 'getting-started' },
        { id: 'help:daily-report', label: findHelpEntry('daily-report')!.question, kind: 'help', helpId: 'daily-report' },
        { id: 'other', label: assistantMessages.otherQuestion, kind: 'other' },
      ]
      expect(labels(withGettingStartedReplies(stale, state))).toEqual([findHelpEntry('daily-report')!.question, assistantMessages.otherQuestion])
    }
    expect(findAssistantHelpTopic('account', [])).toBeUndefined()
  })

  it('비로그인 첫 화면에는 계정·기업 주제를 두지 않는다', () => {
    const replies = quickRepliesFor(guest)
    expect(labels(withGettingStartedReplies(replies, null))).toEqual([...baseTopicLabels, assistantMessages.quickLoginBenefits])
    expect(labels(replies)).not.toContain('계정·기업')
  })

  it('주제 안 질문 목록과 관련 항목·AI 사용법 답의 인용도 제공되는 항목만 쓴다', () => {
    const account = findAssistantHelpTopic('account', ['getting-started'])!
    expect(followUpsOf(topicAnswer(account, ['getting-started']))).toEqual([findHelpEntry('getting-started')!.question, assistantMessages.otherQuestion])
    expect(followUpsOf(topicAnswer(account, []))).toEqual([assistantMessages.otherQuestion])

    // 다른 항목의 관련 링크가 시작하기 도움말을 가리켜도 제공될 때만 알약으로 둡니다.
    const pointing = { ...findHelpEntry('saved-programs-pipeline')!, related: ['getting-started', 'daily-report'] }
    expect(followUpsOf(helpAnswer(pointing, '/app/saved-programs', []))).toEqual([findHelpEntry('daily-report')!.question, assistantMessages.otherQuestion])
    expect(followUpsOf(helpAnswer(pointing, '/app/saved-programs', ['getting-started']))).toEqual([
      findHelpEntry('getting-started')!.question, findHelpEntry('daily-report')!.question, assistantMessages.otherQuestion,
    ])

    const cited = freeTextAnswer({
      intent: 'PRODUCT_HELP', answer: '사이드바를 보세요.', citations: ['getting-started'], clarificationQuestion: null, searchQuery: null,
      accountTopic: null, navigation: null, cards: [],
    }, { pathname: '/app/partners', search: '', session: member, returnTo: '/app/partners', offered: [] })
    expect(cited).toMatchObject({ source: assistantMessages.aiSource, card: null })
  })
})

describe('"다음에 뭘 하면 되나요?" 답', () => {
  it('다음 단계를 결론으로 말하고 이유와 그 화면을 여는 버튼 하나, 이용 현황 출처를 붙인다', () => {
    const answer = gettingStartedAnswer(guide([
      { id: 'SIGN_UP', status: 'DONE' },
      { id: 'COMPANY', status: 'DONE' },
      { id: 'SAVE_PROGRAM', status: 'TODO' },
      { id: 'DEADLINE_REMINDER', status: 'TODO' },
      { id: 'DAILY_REPORT', status: 'TODO' },
      { id: 'START_PREPARATION', status: 'TODO' },
    ]))
    expect(answer).toMatchObject({
      role: 'assistant',
      paragraphs: ['다음은 ‘관심 공고 담기’예요.', '담은 공고는 마감 알림과 신청 준비로 이어져요.'],
      card: { rows: [], buttons: [{ label: '검색 화면 보기', to: '/app/chat' }] },
      source: '내 이용 현황 기준 · 시작하기 2/6',
      tone: 'normal',
    })
  })

  it('지금 안 되는 것이 있으면 "아직 안 돼요" 한 줄을 더하고, 잠긴 단계는 건너뛴다', () => {
    const answer = gettingStartedAnswer(guide([
      { id: 'SIGN_UP', status: 'DONE' },
      { id: 'COMPANY', status: 'DONE' },
      { id: 'SAVE_PROGRAM', status: 'DONE' },
      { id: 'DEADLINE_REMINDER', status: 'TODO' },
      { id: 'DAILY_REPORT', status: 'LOCKED' },
      { id: 'START_PREPARATION', status: 'TODO' },
    ]))
    expect(answer).toMatchObject({
      paragraphs: [
        '다음은 ‘마감 알림 켜기’예요.', '관심 공고 마감 7·3·1일 전에 알려 드려요.', '아직 안 돼요: 이메일은 받을 주소를 먼저 확인해야 받아요.',
      ],
      card: { buttons: [{ label: '내 프로필 보기', to: '/app/profile' }] },
      source: '내 이용 현황 기준 · 시작하기 3/6',
    })
  })

  it('모두 마쳤으면 그렇다고 말하고 관심 공고함으로 안내한다', () => {
    const answer = gettingStartedAnswer(guide([
      { id: 'SIGN_UP', status: 'DONE' },
      { id: 'SAVE_PROGRAM', status: 'DONE' },
      { id: 'DEADLINE_REMINDER', status: 'DONE' },
      { id: 'START_PREPARATION', status: 'DONE' },
    ]))
    expect(answer).toMatchObject({
      paragraphs: [assistantMessages.gettingStartedAllDone, assistantMessages.gettingStartedAllDoneNext],
      card: { buttons: [{ label: assistantMessages.savedOpen, to: '/app/saved-programs' }] },
      source: '내 이용 현황 기준 · 시작하기 4/4',
    })
  })
})
