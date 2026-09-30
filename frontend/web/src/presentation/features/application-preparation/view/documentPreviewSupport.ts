import type { ApplicationDocument } from '../../../../domain/entities/ApplicationPreparation'

/** 미리보기를 지원하는 형식. 한글·워드·엑셀은 PDF 변환 도구를 붙인 뒤 연다. */
export const previewSupported = (file: Pick<ApplicationDocument, 'mediaType'>) => file.mediaType === 'application/pdf'
export const previewUnsupportedHint = '한글·워드·엑셀 파일 미리보기는 PDF 변환 도구를 붙인 뒤 지원해요. 지금은 내려받아 확인해 주세요.'
