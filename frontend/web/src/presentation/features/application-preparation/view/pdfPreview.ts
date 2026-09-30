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
  // 여러 문항이 같은 값을 가질 수 있으니 값 단위로 한 번만 찾고 센다.
  const wanted = [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]
  const found = new Set<string>()
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number)
    const viewport = page.getViewport({ scale })
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is PreviewTextItem & typeof item => 'str' in item)
    const highlights = findValueHighlights(items, wanted, viewport)
    highlights.found.forEach((value) => found.add(value))
    // React가 개발 중 효과를 두 번 실행해도 같은 캔버스에 두 렌더링이 겹치지 않도록 앞선 작업을 취소한다.
    let task: ReturnType<typeof page.render> | null = null
    pages.push({
      index: number - 1, width: viewport.width, height: viewport.height, highlights: highlights.boxes,
      render: async (canvas) => {
        if (task) {
          task.cancel()
          await task.promise.catch(() => undefined)
        }
        canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height)
        const current = page.render({ canvas, viewport })
        task = current
        try {
          await current.promise
        } catch (error) {
          if (error instanceof pdfjs.RenderingCancelledException) return
          throw error
        } finally {
          if (task === current) task = null
        }
      },
    })
  }
  return { pageCount: document.numPages, pages, found: [...found], missing: wanted.filter((value) => !found.has(value)) }
}
