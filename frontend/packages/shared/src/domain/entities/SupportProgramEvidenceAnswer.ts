/** 공고 원문에서 글자 그대로 옮긴 짧은 인용(200자 이내)과 원문 위치를 함께 보여 주는 답변 근거입니다. */
export type SupportProgramEvidenceCitation = {
  excerpt: string
  sourceUrl: string
  chunkOrder: number
}

export type SupportProgramEvidenceAnswerStatus = 'ANSWERED' | 'INSUFFICIENT_EVIDENCE'

/** 특정 공고 원문만 근거로 생성한 질문 답변입니다. */
export type SupportProgramEvidenceAnswer = {
  answer: string
  answerStatus: SupportProgramEvidenceAnswerStatus
  citations: SupportProgramEvidenceCitation[]
}
