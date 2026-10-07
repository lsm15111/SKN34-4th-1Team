package ai.govbiz.core.planusage.domain

import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.jupiter.api.Assertions.assertEquals
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
    fun planLimitsMatchThePublishedPlanTable() {
        assertEquals(listOf(10, 10, 1, 2), PlanUsageFeature.entries.map(PlanCode.FREE::limitOf))
        assertEquals(listOf(40, 50, 5, 20), PlanUsageFeature.entries.map(PlanCode.PLUS::limitOf))
        assertEquals(listOf(150, 200, 30, 100), PlanUsageFeature.entries.map(PlanCode.PREMIUM::limitOf))
        assertEquals(3, PlanCode.GUEST_AI_SEARCH_PER_DAY)
        assertEquals(PlanUsagePeriod.DAY, PlanUsageFeature.AI_SEARCH.period)
        assertEquals(PlanUsagePeriod.MONTH, PlanUsageFeature.APPLICATION_DRAFT.period)
    }
}
