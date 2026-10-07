package ai.govbiz.core.planusage.domain

import java.time.YearMonth
import java.time.ZonedDateTime

/**
 * 한도를 세는 기간입니다. 하루는 서울 자정, 한 달은 서울 기준 매월 1일 0시에 다시 채워집니다.
 * [TOTAL]은 기간 없이 지금 가진 개수를 세며 다시 채워지지 않고, 빼거나 마감하면 그만큼 다시 쓸 수 있습니다.
 */
enum class PlanUsagePeriod {
    DAY,
    MONTH,
    TOTAL,
}

/**
 * 요금제 한도로 세는 기능입니다. 하루 한도는 요청마다 세고, 월 한도는 실패하지 않은 작업(진행 중 포함)으로 셉니다.
 * 신청 문서 초안은 공고 하나를 한 건으로 보아 같은 공고의 양식 분석과 문서 생성을 다시 해도 늘지 않습니다.
 * 관심 공고는 지금 담긴(노출 중인) 공고 수, 파트너 모집글은 지금 모집 중인 글 수, 파트너 제안은 이번 달 보낸 제안 수입니다.
 */
enum class PlanUsageFeature(val period: PlanUsagePeriod) {
    AI_SEARCH(PlanUsagePeriod.DAY),
    EVIDENCE_QUESTION(PlanUsagePeriod.DAY),
    APPLICATION_DRAFT(PlanUsagePeriod.MONTH),
    COMBINATION_REVIEW(PlanUsagePeriod.MONTH),
    SAVED_PROGRAM(PlanUsagePeriod.TOTAL),
    PARTNER_RECRUITMENT(PlanUsagePeriod.TOTAL),
    PARTNER_PROPOSAL(PlanUsagePeriod.MONTH),
}

/** 한 기능의 현재 집계 기간입니다. [key]는 사용량 행을 고르고, [startsAt]~[resetsAt]은 작업 표를 셀 범위입니다. */
data class PlanUsageWindow(val key: String, val startsAt: ZonedDateTime, val resetsAt: ZonedDateTime) {
    companion object {
        /** 개수 한도([PlanUsagePeriod.TOTAL])는 기간이 없어 만들지 않습니다. */
        fun current(period: PlanUsagePeriod, now: ZonedDateTime): PlanUsageWindow = when (period) {
            PlanUsagePeriod.DAY -> {
                val today = now.toLocalDate()
                PlanUsageWindow(today.toString(), today.atStartOfDay(now.zone), today.plusDays(1).atStartOfDay(now.zone))
            }
            PlanUsagePeriod.MONTH -> {
                val month = YearMonth.from(now)
                PlanUsageWindow(
                    month.toString(),
                    month.atDay(1).atStartOfDay(now.zone),
                    month.plusMonths(1).atDay(1).atStartOfDay(now.zone),
                )
            }
            PlanUsagePeriod.TOTAL -> throw IllegalArgumentException("TOTAL usage has no reset window")
        }
    }
}

/**
 * 월 한도에 들어가는 작업입니다. 방금 만든 작업(ReviewRun·FormDiscovery·DocumentGeneration·PartnerProposal)은 그 작업을 뺀 사용량과,
 * 작업 표를 쓰지 않는 이전 동기 문서 생성(DraftProgram)은 그 공고를 더한 사용량과 비교해 사용량이 늘어나는지 가립니다.
 */
sealed interface PlanUsageJob {
    val feature: PlanUsageFeature

    data class ReviewRun(val runId: Long) : PlanUsageJob {
        override val feature = PlanUsageFeature.COMBINATION_REVIEW
    }

    data class FormDiscovery(val jobId: Long) : PlanUsageJob {
        override val feature = PlanUsageFeature.APPLICATION_DRAFT
    }

    data class DocumentGeneration(val jobId: Long) : PlanUsageJob {
        override val feature = PlanUsageFeature.APPLICATION_DRAFT
    }

    data class DraftProgram(val sourceCode: String, val sourceProgramId: String) : PlanUsageJob {
        override val feature = PlanUsageFeature.APPLICATION_DRAFT
    }

    /** 방금 보낸 파트너 제안입니다. 철회·거절돼도 보낸 달의 사용량에 남습니다. */
    data class PartnerProposal(val proposalId: Long) : PlanUsageJob {
        override val feature = PlanUsageFeature.PARTNER_PROPOSAL
    }
}
