import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { findValueHighlights, type PreviewBox, type PreviewTextItem } from './pdfHighlights'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PreviewPage = {
  index: number
  width: number
  height: number
  highlights: PreviewBox[]
  /** 캔버스에 페이지를 그린다. 같은 페이지를 다시 그려도 된다. */
  render: (canvas: HTMLCanvasElement) => Promise<void>
}

export type PdfPreview = { pageCount: number; pages: PreviewPage[]; found: string[]; missing: string[] }

/**
 * 생성된 PDF를 브라우저에서 그리고 답변 값이 인쇄된 자리를 표시한다. 서버를 다시 부르지 않는다.
 * 값은 페이지마다 찾고, 어느 페이지에서도 못 찾은 값만 [missing]에 남긴다.
 */
export async function loadPdfPreview(blob: Blob, values: string[], scale = 1.4): Promise<PdfPreview> {
  const data = new Uint8Array(await blob.arrayBuffer())
  const document = await pdfjs.getDocument({ data }).promise
  const pages: PreviewPage[] = []
  const found = new Set<string>()
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number)
    const viewport = page.getViewport({ scale })
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is PreviewTextItem & typeof item => 'str' in item)
    const highlights = findValueHighlights(items, values, viewport)
    highlights.found.forEach((value) => found.add(value))
    pages.push({
      index: number - 1, width: viewport.width, height: viewport.height, highlights: highlights.boxes,
      render: async (canvas) => {
        canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
        await page.render({ canvas, viewport }).promise
      },
    })
  }
  return { pageCount: document.numPages, pages, found: [...found], missing: values.filter((value) => !found.has(value)) }
}
