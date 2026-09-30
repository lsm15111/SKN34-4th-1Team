import { useEffect, useRef, useState } from 'react'
import { appContainer } from '../../../../app/appContainer'
import type { ApplicationDocument } from '../../../../domain/entities/ApplicationPreparation'
import { loadPdfPreview, type PdfPreview, type PreviewPage } from './pdfPreview'
import { applicationPreparationStyles as s } from './ApplicationPreparation.styles'

/**
 * 생성된 PDF를 화면에 그리고 답변 값이 들어간 자리를 노란 박스로 표시한다.
 * 파일은 기존 다운로드 API로 한 번만 받고, 그리는 일은 브라우저가 한다.
 */
export function ApplicationDocumentPreview({ id, file, values, label }: { id: number; file: ApplicationDocument; values: string[]; label: string }) {
  const useCase = appContainer.resolve('applicationPreparationUseCase')
  const [preview, setPreview] = useState<PdfPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setPreview(null); setError(null)
    void (async () => {
      try {
        const blob = await useCase.downloadDocument(id, file.id, controller.signal)
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
    {!error && !preview && <p role="status">미리보기를 준비하고 있어요…</p>}
    {preview && <>
      <p><strong>{preview.pageCount}쪽</strong> · 답변 {preview.found.length}개의 자리를 표시했어요{values.length > preview.found.length ? ` · ${values.length - preview.found.length}개는 문서 글자에서 찾지 못했어요` : ''}</p>
      {preview.missing.length > 0 && <p className={s.muted}>찾지 못한 값: {preview.missing.join(', ')}. 내려받은 파일에서 직접 확인해 주세요.</p>}
      <div className="flex flex-col gap-3 overflow-x-auto">
        {preview.pages.map((page) => <PreviewCanvas key={page.index} page={page} />)}
      </div>
    </>}
  </section>
}

function PreviewCanvas({ page }: { page: PreviewPage }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    if (canvas.current) page.render(canvas.current).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [page])
  return <div className="relative self-start border border-slate-200 bg-white" style={{ width: page.width, height: page.height }} aria-label={`${page.index + 1}쪽`}>
    <canvas ref={canvas} className="block" />
    {failed && <p role="alert" className="absolute inset-x-0 top-0 m-2">{page.index + 1}쪽을 그리지 못했습니다.</p>}
    {page.highlights.map((box, index) => <div key={index} aria-hidden="true" className="pointer-events-none absolute rounded-sm bg-yellow-300/45 outline outline-1 outline-yellow-500"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }} />)}
  </div>
}
