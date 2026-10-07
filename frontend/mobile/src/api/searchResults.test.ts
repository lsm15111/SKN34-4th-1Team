import {
  SupportProgramApiError, SupportProgramInterpretationApiError, SupportProgramRequestApiError, SupportProgramSearchTimeoutApiError,
} from '@govbiz/shared/data/api/supportProgramApi'
import { SupportProgramSearchRestoreError } from '@govbiz/shared/domain/errors/SupportProgramSearchRestoreError'
import { ApiError } from './client'
import { restoreSearchResults, supportProgramFailureMessage } from './searchResults'
import { programDetail } from '../test/preparationFixtures'

const resultToken = '00000000-0000-4000-8000-000000000001'
const program = { ...programDetail, matchedReasons: [], recommendationScore: null, eligibilityReview: null }
const context = { query: '제조 지원', acceptingOnly: true, companyConditions: { region: null, industry: null, establishedOn: null, supportPurpose: null } }
const response = { query: context.query, programs: [program], totalCount: 1, resultToken: null, expiresAt: null, context }
const oldFetch = globalThis.fetch
const oldBase = process.env.EXPO_PUBLIC_API_BASE_URL
afterEach(() => { globalThis.fetch = oldFetch; if (oldBase === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL; else process.env.EXPO_PUBLIC_API_BASE_URL = oldBase })
test('the existing restore HTTP contract uses Bearer authentication, omits cookies and maps DTOs to domain results', async () => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com'
  globalThis.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
  const restored = await restoreSearchResults('verified', resultToken)
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(url).toBe('https://api.example.com/api/v1/support-programs/search/results')
  expect(options?.credentials).toBe('omit')
  expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer verified')
  expect(options?.body).toBe(JSON.stringify({ resultToken }))
  expect(restored.programs[0]).toEqual(expect.objectContaining({ id: program.id }))
  // 원문 질문 지원 여부는 검색 결과 계약에 들어 있지만 상세 전용 필드는 검색 결과로 옮기지 않습니다.
  expect(restored.programs[0]).toHaveProperty('evidenceQuestionSupported', true)
  expect(restored.programs[0]).not.toHaveProperty('applicationRoute')
  expect(fetch).toHaveBeenCalledTimes(1)
})
test.each([
  [new SupportProgramRequestApiError('SUPPORT_PROGRAM_RATE_LIMITED', 12), 'search', '짧은 시간에 요청이 많아 잠시 제한됐어요. 약 12초 후 다시 시도해 주세요.'],
  [new SupportProgramRequestApiError('SUPPORT_PROGRAM_BUSY', null), 'interpret', '지금 다른 요청을 처리하고 있어 새 요청을 시작할 수 없어요. 잠시 후 다시 시도해 주세요.'],
  [new SupportProgramInterpretationApiError('timeout'), 'interpret', '조건 해석 응답이 늦어 시간이 초과됐어요. 잠시 후 다시 보내 주세요.'],
  [new SupportProgramInterpretationApiError('unavailable'), 'interpret', '조건 해석 서비스를 잠시 이용할 수 없어요. 잠시 후 다시 보내 주세요.'],
  [new SupportProgramSearchTimeoutApiError(), 'search', '서버의 검색 시간이 초과됐어요. 같은 조건으로 다시 검색해 주세요.'],
  [new SupportProgramSearchRestoreError('expired'), 'search', new SupportProgramSearchRestoreError('expired').message],
  [new SupportProgramApiError('HTTP 502'), 'interpret', '메시지의 조건을 해석하지 못했어요. 다시 보내 주세요.'],
  [new SupportProgramApiError('HTTP 502'), 'search', '지원사업을 검색하지 못했어요. 잠시 후 다시 검색해 주세요.'],
  [new ApiError(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.'), 'search', '로그인이 만료되었습니다. 다시 로그인해 주세요.'],
  [new TypeError('Network request failed'), 'search', '연결하지 못했거나 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'],
] as const)('%s during %s shows the same failure kind as the web without server text', (error, action, message) => {
  expect(supportProgramFailureMessage(error, action)).toBe(message)
})
test.each([[401, 'unauthorized'], [410, 'expired'], [503, 'unavailable']])('HTTP %s remains an explicit %s restore failure', async (status, reason) => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.com'
  globalThis.fetch = jest.fn().mockResolvedValue(new Response(null, { status: Number(status) }))
  await expect(restoreSearchResults('verified', resultToken)).rejects.toMatchObject({ reason })
  expect(fetch).toHaveBeenCalledTimes(1)
})
