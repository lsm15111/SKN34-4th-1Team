package ai.govbiz.core.planusage.repository

import ai.govbiz.core.planusage.domain.PlanCode
import ai.govbiz.core.planusage.domain.PlanUsageFeature
import ai.govbiz.core.planusage.domain.PlanUsageJob
import ai.govbiz.core.planusage.domain.PlanUsageWindow
import ai.govbiz.core.planusage.repository.exception.PlanUsageStoreException
import ai.govbiz.core.planusage.repository.mapper.PlanUsageMapper
import ai.govbiz.core.supportprogram.domain.SupportProgramStatus
import ai.govbiz.core.supportprogram.domain.SupportProgramStatusResolver
import java.time.Clock
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.dao.DataAccessException
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

/** 계정 요금제와 사용량을 MySQL에 저장하고 읽습니다. 저장소 오류는 한도를 확인할 수 없다는 예외로만 바꿉니다. */
@Repository
class PlanUsageRepository(
    private val mapper: PlanUsageMapper,
    @param:Qualifier("seoulClock") private val clock: Clock,
) {
    fun findPlan(accountId: Long): PlanCode = store {
        mapper.findPlanCode(accountId)?.let(PlanCode::valueOf) ?: PlanCode.FREE
    }

    /**
     * 한도 안일 때만 1을 더하고 더했는지 돌려줍니다. 먼저 그 기간의 행을 만들거나 잠그고 조건부 UPDATE 한 문장으로 더하므로,
     * 같은 계정의 요청이 동시에 와도 한도를 넘겨 더하지 않습니다.
     */
    @Transactional
    fun reserve(accountId: Long, feature: PlanUsageFeature, periodKey: String, limit: Int): Boolean = store {
        val now = now()
        mapper.ensureCounter(accountId, feature.name, periodKey, now)
        mapper.incrementWithin(accountId, feature.name, periodKey, limit, now) == 1
    }

    fun release(accountId: Long, feature: PlanUsageFeature, periodKey: String) {
        store { mapper.decrement(accountId, feature.name, periodKey, now()) }
    }

    /** 지운 신청 문서·중복 검토가 그 달에 이미 쓴 횟수를 더해 둡니다. */
    fun addCount(accountId: Long, feature: PlanUsageFeature, periodKey: String, amount: Int) {
        require(amount > 0) { "amount must be positive" }
        store { mapper.addCount(accountId, feature.name, periodKey, amount, now()) }
    }

    fun findCounts(accountId: Long, periodKeys: Collection<String>): Map<Pair<PlanUsageFeature, String>, Int> = store {
        mapper.findCounts(accountId, periodKeys.distinct()).associate {
            (PlanUsageFeature.valueOf(it.feature) to it.periodKey) to it.usedCount
        }
    }

    /**
     * 월 한도 기능의 작업 표에서 이번 기간에 실패하지 않은 작업(파트너 제안은 보낸 제안 전부)을 셉니다. [excluding]은 방금 만든 작업을 뺀 수를,
     * [including]은 아직 작업이 없는 공고를 더한 수를 셀 때 씁니다.
     */
    fun countJobs(
        accountId: Long,
        feature: PlanUsageFeature,
        window: PlanUsageWindow,
        excluding: PlanUsageJob? = null,
        including: PlanUsageJob.DraftProgram? = null,
    ): Int = store {
        val from = window.startsAt.toLocalDateTime()
        val to = window.resetsAt.toLocalDateTime()
        when (feature) {
            PlanUsageFeature.COMBINATION_REVIEW ->
                mapper.countChargeableReviewRuns(accountId, from, to, (excluding as? PlanUsageJob.ReviewRun)?.runId)
            PlanUsageFeature.APPLICATION_DRAFT -> mapper.countChargeableDraftPrograms(
                accountId, from, to,
                (excluding as? PlanUsageJob.FormDiscovery)?.jobId,
                (excluding as? PlanUsageJob.DocumentGeneration)?.jobId,
                including?.sourceCode, including?.sourceProgramId,
            )
            PlanUsageFeature.PARTNER_PROPOSAL ->
                mapper.countSentPartnerProposals(accountId, from, to, (excluding as? PlanUsageJob.PartnerProposal)?.proposalId)
            PlanUsageFeature.AI_SEARCH, PlanUsageFeature.EVIDENCE_QUESTION ->
                throw IllegalArgumentException("$feature is counted per request, not from jobs")
            PlanUsageFeature.SAVED_PROGRAM, PlanUsageFeature.PARTNER_RECRUITMENT ->
                throw IllegalArgumentException("$feature is counted as items held now, not per period")
        }
    }

    /**
     * 개수 한도 기능이 지금 가진 개수입니다. 관심 공고는 관심 공고함 목록에 보이는 공고 수, 파트너 모집글은 서울 날짜 [today] 기준으로
     * 모집 중인 글 수입니다. 모집글 상태는 저장하지 않으므로 모집글 화면과 같은 규칙(수동 마감·모집 마감일·공고 접수 마감)으로 셉니다.
     */
    fun countHeld(accountId: Long, feature: PlanUsageFeature, today: LocalDate): Int = store {
        when (feature) {
            PlanUsageFeature.SAVED_PROGRAM -> mapper.countSavedPrograms(accountId)
            PlanUsageFeature.PARTNER_RECRUITMENT -> mapper.findOpenRecruitmentPrograms(accountId, today).count { program ->
                SupportProgramStatusResolver.resolve(
                    program.applicationPeriodRaw, program.applicationStartDate, program.applicationEndDate, today,
                ) != SupportProgramStatus.CLOSED
            }
            else -> throw IllegalArgumentException("$feature is counted per period, not as items held now")
        }
    }

    private fun now(): LocalDateTime = LocalDateTime.now(clock).truncatedTo(ChronoUnit.MICROS)

    private fun <T> store(operation: () -> T): T = try {
        operation()
    } catch (error: DataAccessException) {
        throw PlanUsageStoreException(error)
    }
}
