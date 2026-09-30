import { describe, expect, it } from 'vitest'
import { findValueHighlights, type PreviewTextItem } from './pdfHighlights'

const item = (str: string, x: number, y: number, width: number): PreviewTextItem => ({ str, transform: [12, 0, 0, 12, x, y], width, height: 12 })
/** pdf.js viewport 대역: 세로축을 뒤집고 2배로 키운다(페이지 높이 400). */
const viewport = { convertToViewportPoint: (x: number, y: number) => [x * 2, (400 - y) * 2] }

describe('findValueHighlights', () => {
  it('marks the text pieces that print an answer even across piece boundaries and spacing', () => {
    const items = [item('기업명', 10, 300, 30), item('새봄 &', 50, 300, 30), item('연구소', 85, 300, 30), item('담당자', 10, 280, 30)]
    const result = findValueHighlights(items, ['새봄 & 연구소', '홍길동'], viewport)
    expect(result.found).toEqual(['새봄 & 연구소'])
    expect(result.missing).toEqual(['홍길동'])
    expect(result.boxes).toEqual([
      { x: 100, y: 176, width: 60, height: 24 },
      { x: 170, y: 176, width: 60, height: 24 },
    ])
  })

  it('ignores empty values and marks every occurrence of a repeated value once per piece', () => {
    const items = [item('2026', 10, 300, 20), item('년', 30, 300, 10), item('2026', 10, 200, 20)]
    const result = findValueHighlights(items, ['2026', '   '], viewport)
    expect(result.found).toEqual(['2026'])
    expect(result.missing).toEqual([])
    expect(result.boxes.map((box) => box.y)).toEqual([176, 376])
  })
})
