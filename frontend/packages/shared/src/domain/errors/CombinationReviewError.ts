export class CombinationReviewError extends Error {
  readonly status: number
  readonly code: string
  readonly runId: number | null
  readonly retryAfter: string | null
  /** 계정의 동시 처리 한도(`RUN_CAPACITY_EXCEEDED`)에 걸렸을 때 요금제가 허용하는 진행 중 실행 수입니다. 공유 실행 슬롯 부족이면 null입니다. */
  readonly limit: number | null
  constructor(status: number, code: string, runId: number | null = null, retryAfter: string | null = null, limit: number | null = null) {
    super(code)
    this.name = 'CombinationReviewError'
    this.status = status; this.code = code; this.runId = runId; this.retryAfter = retryAfter; this.limit = limit
  }
}

/** 계정의 진행 중인 검토가 요금제의 동시 처리 한도에 닿아 새 분석을 받지 않았으면 그 안내이고, 아니면 null입니다. */
export function reviewCapacityMessage(error: CombinationReviewError): string | null {
  return error.code === 'RUN_CAPACITY_EXCEEDED' && error.limit !== null
    ? `진행 중인 중복 검토가 이미 ${error.limit}건이에요. 끝난 뒤 다시 시도해 주세요.`
    : null
}
