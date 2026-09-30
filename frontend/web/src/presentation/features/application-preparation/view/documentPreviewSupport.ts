import type { ApplicationDocument } from '../../../../domain/entities/ApplicationPreparation'

/** PDF는 저장 파일 그대로, 한글·워드·엑셀은 서버가 변환한 PDF로 미리 본다. */
export const previewSupported = (file: Pick<ApplicationDocument, 'mediaType'>) => [
  'application/pdf', 'application/x-hwp', 'application/hwp+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].includes(file.mediaType)
export const previewIsConverted = (file: Pick<ApplicationDocument, 'mediaType'>) => file.mediaType !== 'application/pdf'
export const previewConvertedHint = '한글·워드·엑셀 파일은 PDF로 변환해 보여 드려요. 글꼴·표 간격이 실제 프로그램과 조금 다를 수 있으니 제출 전에는 내려받은 파일을 확인해 주세요.'
