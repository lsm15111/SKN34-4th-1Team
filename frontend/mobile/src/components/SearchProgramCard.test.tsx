import { Linking } from 'react-native'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { SearchProgramCard } from './SearchProgramCard'
import { programDetail } from '../test/preparationFixtures'

const program = { ...programDetail, matchedReasons: [], recommendationScore: null, eligibilityReview: null }
test('unevaluated results do not fabricate scores or evidence and retain the compound detail identity', () => {
  const open = jest.fn()
  render(<SearchProgramCard program={program} onOpen={open} />)
  expect(screen.getByText('자격 미평가')).toBeTruthy()
  expect(screen.queryByText(/관련도 \d/)).toBeNull()
  fireEvent.press(screen.getByLabelText(`${program.title}, 상세 보기`))
  expect(open).toHaveBeenCalledWith({ sourceCode: program.sourceCode, sourceProgramId: program.id })
})
test('programs the server moved back for another region show the tag notice without changing the eligibility badge', () => {
  const otherRegion = { ...program, regions: ['경북', '전남'], regionTagMismatch: true }
  const { rerender } = render(<SearchProgramCard program={otherRegion} onOpen={jest.fn()} />)
  expect(screen.getByText('다른 지역 한정일 수 있음')).toBeTruthy()
  expect(screen.getByText('공고 지역(경북·전남)이 회사 소재지와 달라 뒤쪽에 두었어요. 지역 조건은 원문에서 확인해 주세요.')).toBeTruthy()
  expect(screen.getByText('자격 미평가')).toBeTruthy()

  rerender(<SearchProgramCard program={otherRegion} />)
  expect(screen.getByText('다른 지역 한정일 수 있음')).toBeTruthy()
  expect(screen.queryByText(/회사 소재지와 달라/)).toBeNull()

  rerender(<SearchProgramCard program={{ ...otherRegion, regionTagMismatch: false }} onOpen={jest.fn()} />)
  expect(screen.queryByText('다른 지역 한정일 수 있음')).toBeNull()
})
const kStartup = { sourceCode: 'KSTARTUP', id: '179197', sourceName: 'K-Startup', evidenceQuestionSupported: false,
  sourceUrl: 'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?pbancSn=179197' }
test('a program the server grouped from two sources names both and opens each official page', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  render(<SearchProgramCard program={{ ...program, alsoPostedBy: [kStartup] }} onOpen={jest.fn()} />)
  expect(screen.getByText('기업마당·K-Startup 함께 게시')).toBeTruthy()
  expect(screen.queryByLabelText('원문 보기')).toBeNull()
  fireEvent.press(screen.getByLabelText('기업마당 원문 보기'))
  fireEvent.press(screen.getByLabelText('K-Startup 원문 보기'))
  expect(open).toHaveBeenNthCalledWith(1, program.sourceUrl)
  expect(open).toHaveBeenNthCalledWith(2, kStartup.sourceUrl)
  open.mockRestore()
})
test('the question action is offered only for programs that accept official-source questions', () => {
  const ask = jest.fn()
  const supported = { ...program, evidenceQuestionSupported: true }
  const { rerender } = render(<SearchProgramCard program={supported} onOpen={jest.fn()} onAsk={ask} signedIn />)
  fireEvent.press(screen.getByLabelText(`${program.title}, 이 공고에 질문하기`))
  expect(ask).toHaveBeenLastCalledWith({ sourceCode: program.sourceCode, sourceProgramId: program.id })

  rerender(<SearchProgramCard program={supported} onOpen={jest.fn()} onAsk={ask} />)
  fireEvent.press(screen.getByLabelText(`${program.title}, 로그인하고 질문하기`))
  expect(ask).toHaveBeenCalledTimes(2)

  // K-Startup 칸이라도 함께 묶인 기업마당 게시물이 질문을 받으면 그 게시물로 묻습니다.
  const bizInfo = { ...kStartup, sourceCode: 'BIZINFO', id: 'PBLN_1', sourceName: '기업마당', evidenceQuestionSupported: true,
    sourceUrl: 'https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=PBLN_1' }
  rerender(<SearchProgramCard program={{ ...program, sourceCode: 'KSTARTUP', sourceName: 'K-Startup', evidenceQuestionSupported: false,
    alsoPostedBy: [bizInfo] }} onOpen={jest.fn()} onAsk={ask} signedIn />)
  fireEvent.press(screen.getByLabelText(`${program.title}, 이 공고에 질문하기`))
  expect(ask).toHaveBeenLastCalledWith({ sourceCode: 'BIZINFO', sourceProgramId: 'PBLN_1' })

  rerender(<SearchProgramCard program={{ ...program, evidenceQuestionSupported: false }} onOpen={jest.fn()} onAsk={ask} signedIn />)
  expect(screen.queryByLabelText(/질문하기/)).toBeNull()
  rerender(<SearchProgramCard program={supported} />)
  expect(screen.queryByLabelText(/질문하기/)).toBeNull()
})
test('official-link failures remain explicit', async () => {
  const link = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('unavailable'))
  render(<SearchProgramCard program={program} onOpen={jest.fn()} />)
  fireEvent.press(screen.getByLabelText('원문 보기'))
  await screen.findByText('공식 원문을 열지 못했습니다. 다시 시도해 주세요.')
  expect(link).toHaveBeenCalledWith(program.sourceUrl)
  link.mockRestore()
})
