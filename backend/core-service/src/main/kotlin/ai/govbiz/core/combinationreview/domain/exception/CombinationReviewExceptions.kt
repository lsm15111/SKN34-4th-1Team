package ai.govbiz.core.combinationreview.domain.exception

/** 검토 식별·입력 버전·실행 예약에 관한 업무 실패. HTTP와 영속성 구현에 의존하지 않는다. */
class CombinationReviewNotFoundException : RuntimeException()
class CombinationReviewRevisionConflictException : RuntimeException()
class CombinationReviewRunConflictException : RuntimeException()
class CombinationReviewDeleteConflictException : RuntimeException()
/** 계정의 대기·실행 중·결과 불명 실행이 요금제의 동시 처리 한도([limit]건)에 이미 닿았습니다. */
class CombinationReviewCapacityException(val limit: Int) : RuntimeException()
