package ai.govbiz.core.planusage.repository.mapper

import java.time.LocalDate
import java.time.LocalDateTime
import org.apache.ibatis.annotations.Mapper
import org.apache.ibatis.annotations.Param

/** MyBatis가 사용량 한 행을 읽기 위한 DB 행 값입니다. */
data class PlanUsageCounterDbRow(
    var feature: String = "",
    var periodKey: String = "",
    var usedCount: Int = 0,
)

/** MyBatis가 모집 중일 수 있는 파트너 모집글이 묶인 공고의 신청 기간을 읽기 위한 DB 행 값입니다. */
data class PlanUsageRecruitmentProgramDbRow(
    var applicationPeriodRaw: String = "",
    var applicationStartDate: LocalDate? = null,
    var applicationEndDate: LocalDate? = null,
)

/**
 * 요금제(`account_plan`)와 사용량(`plan_usage_counter`) SQL, 월 한도 기능의 작업 표 집계와
 * 개수 한도 기능(관심 공고·파트너 모집글)의 현재 개수 집계를 실행하는 MyBatis Mapper입니다.
 */
@Mapper
interface PlanUsageMapper {
    fun findPlanCode(@Param("accountId") accountId: Long): String?

    /** 한도보다 적을 때만 1을 더합니다. 영향받은 행이 0이면 이미 한도입니다. */
    fun incrementWithin(
        @Param("accountId") accountId: Long,
        @Param("feature") feature: String,
        @Param("periodKey") periodKey: String,
        @Param("limit") limit: Int,
        @Param("now") now: LocalDateTime,
    ): Int

    /** 그 기간의 행이 없으면 0으로 만들고, 있으면 그대로 둔 채 행을 잠급니다. */
    fun ensureCounter(
        @Param("accountId") accountId: Long,
        @Param("feature") feature: String,
        @Param("periodKey") periodKey: String,
        @Param("now") now: LocalDateTime,
    ): Int

    fun decrement(
        @Param("accountId") accountId: Long,
        @Param("feature") feature: String,
        @Param("periodKey") periodKey: String,
        @Param("now") now: LocalDateTime,
    ): Int

    fun addCount(
        @Param("accountId") accountId: Long,
        @Param("feature") feature: String,
        @Param("periodKey") periodKey: String,
        @Param("amount") amount: Int,
        @Param("now") now: LocalDateTime,
    ): Int

    fun findCounts(
        @Param("accountId") accountId: Long,
        @Param("periodKeys") periodKeys: List<String>,
    ): List<PlanUsageCounterDbRow>

    fun countChargeableReviewRuns(
        @Param("accountId") accountId: Long,
        @Param("from") from: LocalDateTime,
        @Param("to") to: LocalDateTime,
        @Param("excludeRunId") excludeRunId: Long?,
    ): Int

    fun countChargeableDraftPrograms(
        @Param("accountId") accountId: Long,
        @Param("from") from: LocalDateTime,
        @Param("to") to: LocalDateTime,
        @Param("excludeDiscoveryJobId") excludeDiscoveryJobId: Long?,
        @Param("excludeGenerationJobId") excludeGenerationJobId: Long?,
        @Param("includeSourceCode") includeSourceCode: String?,
        @Param("includeSourceProgramId") includeSourceProgramId: String?,
    ): Int

    fun countSentPartnerProposals(
        @Param("accountId") accountId: Long,
        @Param("from") from: LocalDateTime,
        @Param("to") to: LocalDateTime,
        @Param("excludeProposalId") excludeProposalId: Long?,
    ): Int

    /** 지금 노출 중인 공고로 담긴 관심 공고 수입니다. 목록에서 빠진(비노출) 공고는 세지 않습니다. */
    fun countSavedPrograms(@Param("accountId") accountId: Long): Int

    /** 수동 마감하지 않았고 모집 마감일이 오늘 이후인 모집글이 묶인 공고의 신청 기간입니다. 공고 마감 여부는 Repository가 판단합니다. */
    fun findOpenRecruitmentPrograms(
        @Param("accountId") accountId: Long,
        @Param("today") today: LocalDate,
    ): List<PlanUsageRecruitmentProgramDbRow>
}
