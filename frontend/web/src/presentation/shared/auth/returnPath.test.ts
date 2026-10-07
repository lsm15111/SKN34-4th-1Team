import { describe, expect, it } from 'vitest'

import { loginPathFor, readReturnPath, readWelcomeReturnPath, signupPathFor, welcomeStepPathFor } from './returnPath'

describe('인증 화면의 복귀 경로', () => {
  it('선택한 검색 토큰과 기존 쿼리를 로그인·가입 URL에 그대로 보존한다', () => {
    const target = '/app/chat?searchResult=ce5a0b64-5496-47e4-8bab-05392e7661c9&mode=filter'
    for (const link of [loginPathFor(target), signupPathFor(target)]) {
      expect(readReturnPath(link.slice(link.indexOf('?')))).toBe(target)
    }
  })

  it.each(['', '/'])('복귀 경로 %s가 기본 공개 화면이면 불필요한 next를 붙이지 않는다', (target) => {
    expect(loginPathFor(target)).toBe('/login')
    expect(signupPathFor(target)).toBe('/signup')
  })

  it.each(['https://outside.example', '//outside.example', '/\\outside.example', '/app/chat\n', 'app/chat'])(
    '외부 주소 또는 잘못된 경로 %s는 기본 작업 화면으로 돌린다', (target) => {
      expect(readReturnPath('?next=' + encodeURIComponent(target))).toBe('/app/chat')
      expect(readReturnPath('?next=' + encodeURIComponent(target), '')).toBe('')
      expect(readWelcomeReturnPath('?next=' + encodeURIComponent(target))).toBe('/app/chat')
    },
  )
})

describe('환영 단계의 복귀 경로', () => {
  it('가려던 공고 상세를 환영·기업 등록 단계 주소에 담고 마친 뒤 그대로 읽는다', () => {
    const target = '/app/support-programs/detail?sourceCode=BIZINFO&sourceProgramId=PBLN_1'
    const welcome = welcomeStepPathFor('/app/welcome', target)
    expect(welcome).toBe(`/app/welcome?next=${encodeURIComponent(target)}`)
    const company = welcomeStepPathFor('/app/welcome/company', readWelcomeReturnPath(welcome.slice(welcome.indexOf('?'))))
    expect(company).toBe(`/app/welcome/company?next=${encodeURIComponent(target)}`)
    expect(readWelcomeReturnPath(company.slice(company.indexOf('?')))).toBe(target)
  })

  it.each(['', '/app/chat', '/app/welcome', '/app/welcome/company', '/app/welcome?next=%2Fapp%2Fprofile'])(
    '기본 도착지나 환영 단계 자신(%s)은 담지 않고 마친 뒤 검색 화면으로 간다', (target) => {
      expect(welcomeStepPathFor('/app/welcome', target)).toBe('/app/welcome')
      expect(readWelcomeReturnPath(target === '' ? '' : '?next=' + encodeURIComponent(target))).toBe('/app/chat')
    },
  )
})