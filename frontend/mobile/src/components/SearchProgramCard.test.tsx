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
test('official-link failures remain explicit', async () => {
  const link = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('unavailable'))
  render(<SearchProgramCard program={program} onOpen={jest.fn()} />)
  fireEvent.press(screen.getByLabelText('원문 보기'))
  await screen.findByText('공식 원문을 열지 못했습니다. 다시 시도해 주세요.')
  expect(link).toHaveBeenCalledWith(program.sourceUrl)
  link.mockRestore()
})
