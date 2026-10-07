package ai.govbiz.core.combinationreview.service.exception

enum class ReviewRunFailureCode {
    INPUT_PROGRAM_COUNT_UNSUPPORTED, SOURCE_UNSUPPORTED, SOURCE_NOT_FOUND, SOURCE_UNAVAILABLE, SOURCE_INVALID, SOURCE_TOO_LARGE,
    ANALYSIS_UNAVAILABLE, ANALYSIS_INVALID, RUN_FAILED, RUN_CAPACITY_EXCEEDED, RUN_RATE_LIMITED, RUN_QUEUE_UNAVAILABLE,
}
/** [limit]은 계정의 동시 처리 한도에 걸린 [ReviewRunFailureCode.RUN_CAPACITY_EXCEEDED]일 때 요금제의 동시 처리 건수입니다. */
class CombinationReviewRunException(
    val code: ReviewRunFailureCode,
    val runId: Long? = null,
    cause: Throwable? = null,
    val retryAfterSeconds: Int? = null,
    val limit: Int? = null,
) : RuntimeException(null, cause)
