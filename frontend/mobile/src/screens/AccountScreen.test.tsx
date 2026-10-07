import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { apiRequest } from '../api/client'
import { useAuth } from '../auth/session'
import { colors } from '../ui'
import { AccountScreen } from './AccountScreen'

jest.mock('../auth/session', () => ({ useAuth: jest.fn() }))
jest.mock('../auth/oauth', () => ({ supportsNativeOAuth: () => true }))
jest.mock('../api/client', () => ({ apiRequest: jest.fn(), ApiError: class extends Error {} }))
const signUp = jest.fn().mockResolvedValue(undefined)
const passToken = 'p'.repeat(43)

beforeEach(() => {
  signUp.mockClear()
  jest.mocked(apiRequest).mockReset()
  jest.mocked(useAuth).mockReturnValue({ status: 'signedOut', session: null, restoreError: null, signUp, signIn: jest.fn(), signOut: jest.fn(), refreshSession: jest.fn() } as unknown as ReturnType<typeof useAuth>)
})

async function verifyEmail() {
  jest.mocked(apiRequest).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ passToken, expiresAt: new Date(Date.now() + 3_600_000).toISOString() })
  const view = render(<AccountScreen onCompany={jest.fn()} />)
  fireEvent.press(view.getByText('이메일로 회원가입'))
  fireEvent.changeText(view.getByLabelText('이메일'), ' USER@example.com ')
  fireEvent.press(view.getByText('인증번호 받기'))
  await waitFor(() => expect(view.getByLabelText('인증번호')).toBeTruthy())
  fireEvent.changeText(view.getByLabelText('인증번호'), '123456')
  fireEvent.press(view.getByText('인증번호 확인'))
  await waitFor(() => expect(view.getByText('이메일 인증을 완료했습니다.')).toBeTruthy())
  return view
}

test('signup submits the verified email token with the normalized email and matching password', async () => {
  const view = await verifyEmail()
  fireEvent.changeText(view.getByLabelText('비밀번호'), 'password123')
  fireEvent.changeText(view.getByLabelText('비밀번호 확인'), 'password123')
  fireEvent.press(view.getByText('회원가입'))
  await waitFor(() => expect(signUp).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password123', emailPassToken: passToken }))
  expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/v1/auth/signup/email-code/verify', expect.objectContaining({ body: { email: 'user@example.com', code: '123456' } }))
})

test('changing the email discards its verification pass and blocks signup', async () => {
  const view = await verifyEmail()
  fireEvent.changeText(view.getByLabelText('이메일'), 'other@example.com')
  fireEvent.changeText(view.getByLabelText('비밀번호'), 'password123')
  fireEvent.changeText(view.getByLabelText('비밀번호 확인'), 'password123')
  fireEvent.press(view.getByText('회원가입'))
  expect(signUp).not.toHaveBeenCalled()
  expect(view.queryByText('이메일 인증을 완료했습니다.')).toBeNull()
  expect(view.getByText('인증번호 받기')).toBeTruthy()
})


const usage = { plan: 'FREE', items: [
  { feature: 'AI_SEARCH', period: 'DAY', limit: 10, used: 3, resetsAt: '2026-10-09T00:00:00+09:00' },
  { feature: 'EVIDENCE_QUESTION', period: 'DAY', limit: 10, used: 8, resetsAt: '2026-10-09T00:00:00+09:00' },
  // 진행 중인 작업 때문에 한도를 넘겨 세어져도 막대와 숫자는 한도에서 멈춥니다.
  { feature: 'APPLICATION_DRAFT', period: 'MONTH', limit: 1, used: 2, resetsAt: '2026-11-01T00:00:00+09:00' },
  { feature: 'COMBINATION_REVIEW', period: 'MONTH', limit: 2, used: 0, resetsAt: '2026-11-01T00:00:00+09:00' },
  // 관심 공고·모집 중인 모집글은 지금 가진 개수라 다시 채워지는 때 대신 다시 쓰는 방법을 적습니다.
  { feature: 'SAVED_PROGRAM', period: 'TOTAL', limit: 30, used: 12, resetsAt: null },
  { feature: 'PARTNER_RECRUITMENT', period: 'TOTAL', limit: 1, used: 1, resetsAt: null },
  { feature: 'PARTNER_PROPOSAL', period: 'MONTH', limit: 3, used: 2, resetsAt: '2026-11-01T00:00:00+09:00' },
] }
function signIn() {
  jest.mocked(useAuth).mockReturnValue({ status: 'signedIn', session: { accessToken: 'owner', account: { email: 'owner@example.com', company: null } },
    restoreError: null, signUp, signIn: jest.fn(), signOut: jest.fn(), refreshSession: jest.fn() } as unknown as ReturnType<typeof useAuth>)
}

test('a signed-in account shows its plan and every usage limit as progress without a purchase path', async () => {
  signIn()
  jest.mocked(apiRequest).mockResolvedValue(usage)
  const view = render(<AccountScreen onCompany={jest.fn()} onSettings={jest.fn()} />)
  await view.findByText('요금제와 이용량')
  expect(apiRequest).toHaveBeenCalledWith('/api/v1/plan-usage', expect.objectContaining({ accessToken: 'owner' }))
  expect(view.getByText('현재 요금제')).toBeTruthy()
  expect(view.getByText('무료')).toBeTruthy()
  for (const [label, count] of [['AI 대화 검색', '오늘 3/10회'], ['공고 원문 질문', '오늘 8/10회'],
    ['신청 문서 초안', '이번 달 1/1건'], ['중복 지원·수혜 검토', '이번 달 0/2회'], ['관심 공고', '12/30개'],
    ['모집 중인 모집글', '1/1개'], ['파트너 제안 보내기', '이번 달 2/3건']]) {
    expect(view.getByText(label)).toBeTruthy()
    expect(view.getByText(count)).toBeTruthy()
  }
  expect(view.getAllByRole('progressbar')).toHaveLength(7)
  expect(view.getByRole('progressbar', { name: 'AI 대화 검색 이용량' }).props.accessibilityValue).toEqual({ min: 0, max: 10, now: 3 })
  expect(view.getByRole('progressbar', { name: '신청 문서 초안 이용량' }).props.accessibilityValue).toEqual({ min: 0, max: 1, now: 1 })
  expect(view.getByRole('progressbar', { name: '관심 공고 이용량' }).props.accessibilityValue).toEqual({ min: 0, max: 30, now: 12 })
  expect(view.getAllByText('자정(서울 시간)에 다시 채워져요.')).toHaveLength(2)
  expect(view.getAllByText('11월 1일에 다시 채워져요.')).toHaveLength(3)
  expect(view.getByText('담은 공고를 빼면 그만큼 새로 담을 수 있어요.')).toBeTruthy()
  expect(view.getByText('모집글을 마감하거나 모집 기간이 끝나면 새로 쓸 수 있어요.')).toBeTruthy()
  expect(StyleSheet.flatten(view.getByText('1/1개').props.style).color).toBe(colors.warning)
  expect(StyleSheet.flatten(view.getByText('오늘 8/10회').props.style).color).toBe(colors.warning)
  expect(StyleSheet.flatten(view.getByText('오늘 3/10회').props.style).color).not.toBe(colors.warning)
  expect(view.getByText('결제는 아직 받지 않아요.')).toBeTruthy()
  // 앱에서는 이용 현황만 보여 주고 결제·요금제 변경으로 이어지는 안내나 링크를 두지 않습니다.
  expect(view.queryByText(/업그레이드|요금제 보기|요금제 변경|가격|구매|결제하기/)).toBeNull()
  expect(view.queryAllByRole('link')).toHaveLength(0)
  expect(view.getAllByRole('button').map(button => button.props.accessibilityLabel)).toEqual(['기업 프로필 등록', '알림 설정', '로그아웃'])
})

test('account usage that cannot be read offers a retry instead of a guessed count', async () => {
  signIn()
  jest.mocked(apiRequest).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(usage)
  const view = render(<AccountScreen onCompany={jest.fn()} />)
  await view.findByText('이용량을 불러오지 못했어요.')
  expect(view.queryByRole('progressbar')).toBeNull()
  await act(async () => { fireEvent.press(view.getByLabelText('이용량 다시 불러오기')) })
  await view.findByText('결제는 아직 받지 않아요.')
  expect(view.queryByText('이용량을 불러오지 못했어요.')).toBeNull()
  expect(apiRequest).toHaveBeenCalledTimes(2)
})

test('signup rejects a password with Korean characters before sending it', async () => {
  const view = await verifyEmail()
  const password = '비밀번호1234'
  fireEvent.changeText(view.getByLabelText('비밀번호'), password)
  fireEvent.changeText(view.getByLabelText('비밀번호 확인'), password)
  fireEvent.press(view.getByText('회원가입'))
  await waitFor(() => expect(view.getByText('비밀번호는 영문·숫자·특수문자만 쓸 수 있습니다.')).toBeTruthy())
  expect(signUp).not.toHaveBeenCalled()
})
