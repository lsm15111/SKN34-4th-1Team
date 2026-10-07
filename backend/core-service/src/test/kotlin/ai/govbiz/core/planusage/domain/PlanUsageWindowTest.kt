package ai.govbiz.core.planusage.domain

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class PlanUsageWindowTest {
    private val seoul = ZoneId.of("Asia/Seoul")

    @Test
    fun dailyWindowsUseTheSeoulDateAndResetAtTheNextSeoulMidnight() {
        // UTC로는 아직 10월 31일이지만 서울은 11월 1일입니다.
        val now = ZonedDateTime.of(2026, 11, 1, 0, 30, 0, 0, seoul)
        val window = PlanUsageWindow.current(PlanUsagePeriod.DAY, now)
        assertEquals("2026-11-01", window.key)
        assertEquals(ZonedDateTime.of(2026, 11, 1, 0, 0, 0, 0, seoul), window.startsAt)
        assertEquals(ZonedDateTime.of(2026, 11, 2, 0, 0, 0, 0, seoul), window.resetsAt)
    }

    @Test
    fun monthlyWindowsCoverTheWholeSeoulMonthIncludingTheYearBoundary() {
        val now = ZonedDateTime.of(2026, 12, 31, 23, 59, 59, 0, seoul)
        val window = PlanUsageWindow.current(PlanUsagePeriod.MONTH, now)
        assertEquals("2026-12", window.key)
        assertEquals(ZonedDateTime.of(2026, 12, 1, 0, 0, 0, 0, seoul), window.startsAt)
        assertEquals(ZonedDateTime.of(2027, 1, 1, 0, 0, 0, 0, seoul), window.resetsAt)
    }

    @Test
    fun heldItemLimitsHaveNoResetWindow() {
        // 관심 공고·모집 중인 모집글은 지금 가진 개수라 기간 키도 초기화 시각도 없습니다.
        assertThrows(IllegalArgumentException::class.java) {
            PlanUsageWindow.current(PlanUsagePeriod.TOTAL, ZonedDateTime.of(2026, 10, 8, 21, 0, 0, 0, seoul))
        }
    }

    @Test
    fun planLimitsMatchThePublishedPlanTable() {
        // AI 검색·원문 질문·신청 문서·중복 검토·관심 공고·모집 중인 모집글·보낸 제안 순서입니다.
        assertEquals(listOf(10, 10, 1, 2, 30, 1, 3), PlanUsageFeature.entries.map(PlanCode.FREE::limitOf))
        assertEquals(listOf(40, 50, 5, 20, 300, 5, 30), PlanUsageFeature.entries.map(PlanCode.PLUS::limitOf))
        assertEquals(listOf(150, 200, 30, 100, 1_000, 20, 100), PlanUsageFeature.entries.map(PlanCode.PREMIUM::limitOf))
        assertEquals(listOf(1, 3, 5), PlanCode.entries.map { it.concurrentJobs })
        assertEquals(3, PlanCode.GUEST_AI_SEARCH_PER_DAY)
        assertEquals(PlanUsagePeriod.DAY, PlanUsageFeature.AI_SEARCH.period)
        assertEquals(PlanUsagePeriod.MONTH, PlanUsageFeature.APPLICATION_DRAFT.period)
        assertEquals(PlanUsagePeriod.TOTAL, PlanUsageFeature.SAVED_PROGRAM.period)
        assertEquals(PlanUsagePeriod.TOTAL, PlanUsageFeature.PARTNER_RECRUITMENT.period)
        assertEquals(PlanUsagePeriod.MONTH, PlanUsageFeature.PARTNER_PROPOSAL.period)
    }
}
