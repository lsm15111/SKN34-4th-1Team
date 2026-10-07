package ai.govbiz.core.gettingstarted.service

import ai.govbiz.core.account.domain.Account
import ai.govbiz.core.account.domain.AccountRole
import ai.govbiz.core.account.domain.AccountType
import ai.govbiz.core.gettingstarted.config.GettingStartedProperties
import ai.govbiz.core.gettingstarted.domain.GettingStartedFacts
import ai.govbiz.core.gettingstarted.repository.GettingStartedRepository
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.mockito.Mockito

class GettingStartedServiceTest {
    // 서울 2026-10-08 21:00
    private val clock = Clock.fixed(Instant.parse("2026-10-08T12:00:00Z"), ZoneId.of("Asia/Seoul"))
    private val now = LocalDateTime.of(2026, 10, 8, 21, 0)
    private val repository = Mockito.mock(GettingStartedRepository::class.java)
    private val service = GettingStartedService(repository, GettingStartedProperties(enabled = true), clock)
    private val member = Account(
        7, "member@example.test", AccountRole.USER, null, null, LocalDateTime.of(2026, 10, 1, 9, 0),
        accountType = AccountType.INDIVIDUAL, onboardedAt = LocalDateTime.of(2026, 10, 1, 9, 5),
    )
    private val nothing = GettingStartedFacts(false, false, false, false, false, null, null)
    private val everything = nothing.copy(programSaved = true, deadlineReminderEnabled = true, preparationStarted = true)

    @Test
    fun recordsTheCompletionTimeOnceWhenEveryStepIsFirstSeenDone() {
        val stored = now.minusSeconds(3)
        Mockito.doReturn(everything).`when`(repository).facts(7)
        Mockito.doReturn(stored).`when`(repository).recordCompleted(7, now)

        val guide = service.guide(member)

        assertTrue(guide.complete)
        assertTrue(guide.visible)
        // 동시에 먼저 남긴 요청이 있으면 그 시각을 그대로 씁니다.
        assertEquals(stored, guide.completedAt)
        Mockito.verify(repository).recordCompleted(7, now)
    }

    @Test
    fun doesNotWriteWhenIncompleteOrAlreadyRecorded() {
        Mockito.doReturn(nothing).`when`(repository).facts(7)
        assertFalse(service.guide(member).complete)

        Mockito.doReturn(everything.copy(completedAt = now.minusDays(2))).`when`(repository).facts(7)
        val old = service.guide(member)
        assertTrue(old.complete)
        assertFalse(old.visible, "완료한 지 24시간이 지났습니다")

        Mockito.verify(repository, Mockito.never()).recordCompleted(7, now)
    }

    @Test
    fun closingAndReopeningSaveOnlyTheClosedStateAndReturnTheRecomputedGuide() {
        Mockito.doReturn(nothing.copy(closedAt = now)).`when`(repository).facts(7)
        val closed = service.setClosed(member, true)
        Mockito.verify(repository).saveClosed(7, true, now)
        assertTrue(closed.closed)
        assertFalse(closed.visible)

        Mockito.doReturn(nothing).`when`(repository).facts(7)
        val reopened = service.setClosed(member, false)
        Mockito.verify(repository).saveClosed(7, false, now)
        assertTrue(reopened.visible)
        assertFalse(reopened.closed)
    }

    @Test
    fun theSwitchHidesTheGuideWithoutChangingTheSteps() {
        val off = GettingStartedService(repository, GettingStartedProperties(enabled = false), clock)
        Mockito.doReturn(nothing).`when`(repository).facts(7)

        val guide = off.guide(member)
        assertFalse(guide.visible)
        assertFalse(guide.closed)
        assertEquals(4, guide.steps.size)
    }
}
