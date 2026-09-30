/** PDF 텍스트 조각 하나. pdf.js `TextContent.items`의 필요한 부분만 쓴다. */
export type PreviewTextItem = { str: string; transform: number[]; width: number; height: number }

/** 화면(캔버스) 좌표계의 강조 박스. 왼쪽 위 원점, CSS 픽셀. */
export type PreviewBox = { x: number; y: number; width: number; height: number }

export type PreviewViewport = { convertToViewportPoint(x: number, y: number): number[] }

const compact = (text: string) => text.replace(/\s+/g, '')

/**
 * 답변 값이 인쇄된 텍스트 조각을 찾아 강조 박스로 바꾼다.
 * 페이지 텍스트를 공백 없이 이어 붙여 찾으므로 조각 경계나 띄어쓰기 차이에 걸친 값도 잡는다.
 * 문서 글꼴이 글자를 그림으로만 그린 경우처럼 텍스트가 없으면 찾지 못하며, 그 값은 [missing]으로 돌려준다.
 */
export function findValueHighlights(items: PreviewTextItem[], values: string[], viewport: PreviewViewport): { boxes: PreviewBox[]; found: string[]; missing: string[] } {
  const owners: number[] = []
  let text = ''
  items.forEach((item, index) => {
    const piece = compact(item.str)
    text += piece
    for (let i = 0; i < piece.length; i += 1) owners.push(index)
  })
  const hit = new Set<number>()
  const found: string[] = []
  const missing: string[] = []
  for (const value of values) {
    const needle = compact(value)
    if (needle.length === 0) continue
    let at = text.indexOf(needle)
    if (at < 0) { missing.push(value); continue }
    found.push(value)
    while (at >= 0) {
      for (let i = at; i < at + needle.length; i += 1) hit.add(owners[i])
      at = text.indexOf(needle, at + needle.length)
    }
  }
  const boxes = [...hit].sort((a, b) => a - b).map((index) => {
    const item = items[index]
    const [, , , , x, y] = item.transform
    const height = item.height || Math.abs(item.transform[3]) || 1
    const [x1, y1] = viewport.convertToViewportPoint(x, y)
    const [x2, y2] = viewport.convertToViewportPoint(x + item.width, y + height)
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
  })
  return { boxes, found, missing }
}
