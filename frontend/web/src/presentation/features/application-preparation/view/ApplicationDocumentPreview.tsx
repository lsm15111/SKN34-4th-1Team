import { useEffect, useRef, useState } from 'react'
import { appContainer } from '../../../../app/appContainer'
import type { ApplicationDocument } from '../../../../domain/entities/ApplicationPreparation'
import { loadPdfPreview, type PdfPreview, type PreviewPage } from './pdfPreview'
import { previewConvertedHint, previewIsConverted } from './documentPreviewSupport'
import { applicationPreparationStyles as s } from './ApplicationPreparation.styles'

/**
 * 생성된 문서를 PDF로 화면에 그리고 답변 값이 들어간 자리를 노란 박스로 표시한다.
 * PDF는 기존 다운로드 API로, 한글·워드·엑셀은 서버 변환 API로 한 번만 받고, 그리는 일은 브라우저가 한다.
 */
export function ApplicationDocumentPreview({ id, file, values, label }: { id: number; file: ApplicationDocument; values: string[]; label: string }) {
  const useCase = appContainer.resolve('applicationPreparationUseCase')
  const [preview, setPreview] = useState<PdfPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** 그리지 못한 쪽 번호. 한 줄로만 알리고 쪽마다 문구를 띄우지 않는다. */
  const [failedPages, setFailedPages] = useState<number[]>([])

  useEffect(() => {
    const controller = new AbortController()
    setPreview(null); setError(null); setFailedPages([])
    void (async () => {
      try {
        const blob = previewIsConverted(file)
          ? await useCase.documentPreview(id, file.id, controller.signal)
          : await useCase.downloadDocument(id, file.id, controller.signal)
        if (controller.signal.aborted) return
        const loaded = await loadPdfPreview(blob, values)
        if (!controller.signal.aborted) setPreview(loaded)
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : '미리보기를 열지 못했습니다.')
      }
    })()
    return () => controller.abort()
    // values는 답변 목록에서 계산한 새 배열이라 내용이 같아도 참조가 바뀐다. 파일이 바뀔 때만 다시 연다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, file.id, useCase])

  return <section className={s.notice} role="region" aria-label={label}>
    {error && <p role="alert">{error}</p>}
    {!error && !preview && <p role="status">{previewIsConverted(file) ? 'PDF로 변환해 미리보기를 준비하고 있어요… 10~20초 걸릴 수 있어요.' : '미리보기를 준비하고 있어요…'}</p>}
    {preview && <>
      {previewIsConverted(file) && <p className={s.muted}>{previewConvertedHint}</p>}
      <p><strong>{preview.pageCount}쪽</strong> · 답변 {preview.found.length}개의 자리를 표시했어요{preview.missing.length > 0 ? ` · ${preview.missing.length}개는 문서 글자에서 찾지 못했어요` : ''}</p>
      {preview.missing.length > 0 && <p className={s.muted}>찾지 못한 값: {preview.missing.join(', ')}. 내려받은 파일에서 직접 확인해 주세요.</p>}
      {failedPages.length > 0 && <p role="alert">{failedPages.map((index) => `${index + 1}쪽`).join(', ')}을 그리지 못했어요. 내려받은 파일로 확인해 주세요.</p>}
      <div className="flex max-h-[70vh] flex-col items-center gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-3" aria-label="문서 쪽 목록">
        {preview.pages.map((page) => <PreviewCanvas key={page.index} page={page} total={preview.pageCount}
          onFailed={() => setFailedPages((current) => current.includes(page.index) ? current : [...current, page.index])} />)}
      </div>
    </>}
  </section>
}

/** 한 쪽. 캔버스는 영역 너비에 맞춰 줄이고, 강조 박스는 쪽 크기 대비 비율로 놓아 함께 줄어든다. */
function PreviewCanvas({ page, total, onFailed }: { page: PreviewPage; total: number; onFailed: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    if (canvas.current) page.render(canvas.current).catch(() => { if (!cancelled) onFailed() })
    return () => { cancelled = true }
    // onFailed는 부모 상태 갱신 함수라 참조가 바뀌어도 다시 그릴 이유가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])
  const percent = (value: number, base: number) => `${(value / base) * 100}%`
  return <figure className="m-0 w-full max-w-[880px]" aria-label={`${page.index + 1}쪽`}>
    <div className="relative border border-slate-200 bg-white shadow-sm" style={{ aspectRatio: `${page.width} / ${page.height}` }}>
      <canvas ref={canvas} className="block h-full w-full" />
      {page.highlights.map((box, index) => <div key={index} aria-hidden="true" className="pointer-events-none absolute rounded-sm bg-yellow-300/45 outline outline-1 outline-yellow-500"
        style={{ left: percent(box.x, page.width), top: percent(box.y, page.height), width: percent(box.width, page.width), height: percent(box.height, page.height) }} />)}
    </div>
    <figcaption className={`${s.muted} mt-1 text-center`}>{page.index + 1} / {total}쪽</figcaption>
  </figure>
}
