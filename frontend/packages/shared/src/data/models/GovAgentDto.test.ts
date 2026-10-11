import { describe, expect, it } from 'vitest'
import { govAgentApplicationSchema, govAgentEvidenceSchema, govAgentReviewSchema, parseGovAgentResult } from './GovAgentDto'

const program = { sourceCode: 'BIZINFO', sourceProgramId: 'P001' }
const answer = { answer: '온라인 신청입니다.', answerStatus: 'ANSWERED', citations: [{ excerpt: '온라인 신청',
  sourceUrl: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=P001', sourceLabel: '기업마당 상세 본문', chunkOrder: 0 }] }

describe('Gov agent public contract', () => {
  it('keeps the selected identity and validated official citations', () => {
    expect(parseGovAgentResult({ outcome: 'EVIDENCE', program, evidence: answer }, program)).toMatchObject({ evidence: answer })
  })
  it('rejects another provider with the same original id', () => {
    expect(() => parseGovAgentResult({ outcome: 'EVIDENCE', program: { ...program, sourceCode: 'KSTARTUP' }, evidence: answer }, program)).toThrow()
  })
  it('rejects evidence without selection or citations', () => {
    expect(() => parseGovAgentResult({ outcome: 'EVIDENCE', program, evidence: answer }, null)).toThrow()
    expect(() => parseGovAgentResult({ outcome: 'EVIDENCE', program, evidence: { ...answer, citations: [] } }, program)).toThrow()
  })
  it('rejects nonofficial links from API and saved history', () => {
    const invalid = { ...answer, citations: [{ ...answer.citations[0], sourceUrl: 'https://example.com' }] }
    expect(() => parseGovAgentResult({ outcome: 'EVIDENCE', program, evidence: invalid }, program)).toThrow()
    expect(govAgentEvidenceSchema.safeParse({ program: { ...program, title: '공고' }, answer: invalid }).success).toBe(false)
  })
  it('rejects mixed operations or unknown actions', () => {
    expect(() => parseGovAgentResult({ outcome: 'DELETE', message: '완료' }, program)).toThrow()
    expect(() => parseGovAgentResult({ outcome: 'UNSUPPORTED', message: '미지원', evidence: answer }, program)).toThrow()
  })
  it('opens application preparation only for the selected composite identity', () => {
    const payload = { outcome: 'APPLICATION', program, message: '신청 양식을 골라 주세요.', evidence: null, interpretation: null }
    expect(parseGovAgentResult(payload, program)).toMatchObject(payload)
    expect(() => parseGovAgentResult(payload, null)).toThrow()
    expect(() => parseGovAgentResult(payload, { ...program, sourceCode: 'KSTARTUP' })).toThrow()
    expect(() => parseGovAgentResult(payload, { ...program, sourceProgramId: 'OTHER' })).toThrow()
    expect(() => parseGovAgentResult({ ...payload, evidence: answer }, program)).toThrow()
  })
  it('stores application context without granting execution fields from history', () => {
    const application = { program: { ...program, title: '공고' }, message: '신청 준비' }
    expect(govAgentApplicationSchema.parse({ ...application, approved: true, requestKey: 'injected' })).toEqual(application)
    expect(govAgentApplicationSchema.safeParse({ ...application, program: { ...application.program, sourceCode: '../' } }).success).toBe(false)
  })
  it('opens comparison with no selection or exactly the selected composite identity', () => {
    const payload = { outcome: 'COMBINATION_REVIEW', program: null, message: '비교할 공고 두 개를 선택하세요.' }
    expect(parseGovAgentResult(payload, null)).toEqual(payload)
    expect(parseGovAgentResult({ ...payload, program }, program)).toEqual({ ...payload, program })
    expect(() => parseGovAgentResult(payload, program)).toThrow()
    expect(() => parseGovAgentResult({ ...payload, program }, null)).toThrow()
    expect(() => parseGovAgentResult({ ...payload, program }, { ...program, sourceCode: 'KSTARTUP' })).toThrow()
    expect(() => parseGovAgentResult({ ...payload, program, evidence: answer }, program)).toThrow()
  })
  it('opens all partner recruitments without implying a selected-program filter', () => {
    const payload = { outcome: 'PARTNERS', program: null, message: '모집 조건을 확인하세요.' }
    expect(parseGovAgentResult(payload, null)).toEqual(payload)
    expect(parseGovAgentResult(payload, program)).toEqual(payload)
    expect(() => parseGovAgentResult({ ...payload, program }, program)).toThrow()
    expect(() => parseGovAgentResult({ ...payload, evidence: answer }, null)).toThrow()
  })
  it.each([null, '12', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid saved review id %s', (reviewId) => {
    expect(govAgentReviewSchema.safeParse({ program: null, message: '중복 검토', reviewId }).success).toBe(false)
  })
  it.each([null, '12', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])('rejects invalid saved preparation id %s', (preparationId) => {
    expect(govAgentApplicationSchema.safeParse({ program: { ...program, title: '공고' }, message: '신청 준비', preparationId }).success).toBe(false)
  })
})
