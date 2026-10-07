package ai.govbiz.core.gettingstarted.repository

import ai.govbiz.core.gettingstarted.domain.GettingStartedFacts
import ai.govbiz.core.gettingstarted.repository.mapper.GettingStartedDbRow
import ai.govbiz.core.gettingstarted.repository.mapper.GettingStartedMapper
import java.time.LocalDateTime
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

/**
 * 시작하기 완료 사실을 기존 기능 표에서 읽고 닫기·완료 시각을 저장합니다. 다른 기능의 Repository에 집계를 더하지 않고
 * 이 기능의 Mapper XML 한 곳에서 읽기 전용 SELECT 한 문장으로 읽습니다.
 */
@Repository
class GettingStartedRepository(private val mapper: GettingStartedMapper) {
    fun facts(accountId: Long): GettingStartedFacts = (mapper.findFacts(accountId) ?: GettingStartedDbRow()).let {
        GettingStartedFacts(
            companyRegistered = it.companyRegistered,
            programSaved = it.programSaved,
            deadlineReminderEnabled = it.deadlineReminderEnabled,
            dailyReportReady = it.dailyReportReady,
            preparationStarted = it.preparationStarted,
            closedAt = it.closedAt,
            completedAt = it.completedAt,
        )
    }

    /** 처음으로 모든 단계를 마친 시각을 남기고 저장된 시각을 돌려줍니다. 이미 남아 있으면 그 시각을 그대로 돌려줍니다. */
    @Transactional
    fun recordCompleted(accountId: Long, now: LocalDateTime): LocalDateTime {
        mapper.recordCompleted(accountId, now)
        return checkNotNull(mapper.findCompletedAt(accountId)) { "getting started completion was not stored" }
    }

    fun saveClosed(accountId: Long, closed: Boolean, now: LocalDateTime) {
        mapper.saveClosed(accountId, closed, now)
    }
}
