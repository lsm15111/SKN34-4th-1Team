package ai.govbiz.core.planusage.service

import ai.govbiz.core.account.domain.Account
import ai.govbiz.core.account.domain.AccountRole
import ai.govbiz.core.planusage.domain.PlanCode
import ai.govbiz.core.planusage.domain.PlanUsageFeature
import ai.govbiz.core.planusage.domain.PlanUsageJob
import ai.govbiz.core.planusage.domain.PlanUsagePeriod
import ai.govbiz.core.planusage.domain.PlanUsageWindow
import ai.govbiz.core.planusage.repository.GuestPlanUsageRepository
import ai.govbiz.core.planusage.repository.PlanUsageRepository
import ai.govbiz.core.planusage.service.exception.PlanQuotaExceededException
import java.time.Clock
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito

class PlanUsageServiceTest {
    private val seoul = ZoneId.of("Asia/Seoul")
    // 서울 2026-10-08 21:00 — 하루 한도는 3시간 뒤, 월 한도는 11월 1일에 다시 채워집니다.
    private val clock = Clock.fixed(Instant.parse("2026-10-08T12:00:00Z"), seoul)
    private val repository = Mockito.mock(PlanUsageRepository::class.java)
    private val guests = Mockito.mock(GuestPlanUsageRepository::class.java)
    private val service = PlanUsageService(repository, guests, clock)
    private val member = Account(7, "member@example.test", AccountRole.USER, null, null, LocalDateTime.of(2026, 9, 1, 9, 0))
    private val today = PlanUsageWindow.current(PlanUsagePeriod.DAY, ZonedDateTime.now(clock))
    private val thisMonth = PlanUsageWindow.current(PlanUsagePeriod.MONTH, ZonedDateTime.now(clock))

    @Test
    fun keepsTheUseWhenTheActionSucceedsAndGivesItBackWhenItFails() {
        Mockito.doReturn(PlanCode.FREE).`when`(repository).findPlan(7)
        Mockito.doReturn(true).`when`(repository).reserve(7, PlanUsageFeature.AI_SEARCH, "2026-10-08", 10)

        assertEquals("ranked", service.consume(member, "192.0.2.1", PlanUsageFeature.AI_SEARCH) { "ranked" })
        Mockito.verify(repository, Mockito.never()).release(7, PlanUsageFeature.AI_SEARCH, "2026-10-08")

        val failure = IllegalStateException("model timeout")
        assertEquals(failure, assertThrows(IllegalStateException::class.java) {
            service.consume(member, "192.0.2.1", PlanUsageFeature.AI_SEARCH) { throw failure }
        })
        Mockito.verify(repository).release(7, PlanUsageFeature.AI_SEARCH, "2026-10-08")
    }

    @Test
    fun rejectsAtTheDailyLimitWithTheResetTimeAndNeverRunsTheAction() {
        Mockito.doReturn(PlanCode.PLUS).`when`(repository).findPlan(7)
        Mockito.doReturn(false).`when`(repository).reserve(7, PlanUsageFeature.EVIDENCE_QUESTION, "2026-10-08", 50)
        var called = false

        val error = assertThrows(PlanQuotaExceededException::class.java) {
            service.consume(member, "192.0.2.1", PlanUsageFeature.EVIDENCE_QUESTION) { called = true }
        }

        assertFalse(called)
        assertEquals(PlanUsageFeature.EVIDENCE_QUESTION, error.feature)
        assertEquals(PlanCode.PLUS, error.plan)
        assertEquals(50, error.limit)
        assertEquals(50, error.used)
        assertEquals(ZonedDateTime.of(2026, 10, 9, 0, 0, 0, 0, seoul), error.resetsAt)
        assertEquals(3 * 60 * 60L, error.retryAfterSeconds)
    }

    @Test
    fun guestsOnlyGetTheAiSearchTrialPerAddress() {
        Mockito.doReturn(false).`when`(guests).reserve("192.0.2.9", today, 3)

        val error = assertThrows(PlanQuotaExceededException::class.java) {
            service.consume(null, "192.0.2.9", PlanUsageFeature.AI_SEARCH) { "never" }
        }
        assertNull(error.plan)
        assertEquals(3, error.limit)
        // 원문 질문 같은 다른 AI 기능은 컨트롤러가 로그인부터 요구하므로 여기 오면 잘못 연결된 것입니다.
        assertThrows(IllegalArgumentException::class.java) {
            service.consume(null, "192.0.2.9", PlanUsageFeature.EVIDENCE_QUESTION) { "never" }
        }
        Mockito.verifyNoInteractions(repository)
    }

    @Test
    fun monthlyCapacityBlocksOnlyANewItemThatGoesOverTheLimit() {
        Mockito.doReturn(PlanCode.FREE).`when`(repository).findPlan(7)
        Mockito.doReturn(mapOf((PlanUsageFeature.COMBINATION_REVIEW to "2026-10") to 1))
            .`when`(repository).findCounts(7, listOf("2026-10"))
        val run = PlanUsageJob.ReviewRun(31)
        Mockito.doReturn(1).`when`(repository).countJobs(7, PlanUsageFeature.COMBINATION_REVIEW, thisMonth, run, null)
        Mockito.doReturn(2).`when`(repository).countJobs(7, PlanUsageFeature.COMBINATION_REVIEW, thisMonth, null, null)

        // 지운 검토의 1회 + 진행·완료 1회에 새 실행을 더하면 3회로 FREE 2회를 넘습니다.
        val error = assertThrows(PlanQuotaExceededException::class.java) { service.requireMonthlyCapacity(7, run) }
        assertEquals(2, error.used)
        assertEquals(ZonedDateTime.of(2026, 11, 1, 0, 0, 0, 0, seoul), error.resetsAt)
    }

    @Test
    fun repeatingTheSameProgramDoesNotUseAnotherDraft() {
        Mockito.doReturn(PlanCode.FREE).`when`(repository).findPlan(7)
        Mockito.doReturn(emptyMap<Pair<PlanUsageFeature, String>, Int>()).`when`(repository).findCounts(7, listOf("2026-10"))
        val generation = PlanUsageJob.DocumentGeneration(12)
        Mockito.doReturn(1).`when`(repository).countJobs(7, PlanUsageFeature.APPLICATION_DRAFT, thisMonth, generation, null)
        Mockito.doReturn(1).`when`(repository).countJobs(7, PlanUsageFeature.APPLICATION_DRAFT, thisMonth, null, null)

        service.requireMonthlyCapacity(7, generation)

        val newProgram = PlanUsageJob.DraftProgram("BIZINFO", "PBLN_NEW")
        Mockito.doReturn(2).`when`(repository).countJobs(7, PlanUsageFeature.APPLICATION_DRAFT, thisMonth, null, newProgram)
        assertThrows(PlanQuotaExceededException::class.java) { service.requireMonthlyCapacity(7, newProgram) }
    }

    @Test
    fun deletingKeepsTheUsageThatTheDeletedWorkAlreadySpentThisMonth() {
        Mockito.doReturn(3, 1).`when`(repository).countJobs(7, PlanUsageFeature.COMBINATION_REVIEW, thisMonth, null, null)

        assertEquals(true, service.keepMonthlyUsage(7, PlanUsageFeature.COMBINATION_REVIEW) { true })

        Mockito.verify(repository).addCount(7, PlanUsageFeature.COMBINATION_REVIEW, "2026-10", 2)
    }

    @Test
    fun reportsGuestTrialAndMemberUsageWithMonthlyJobsAndKeptUsage() {
        Mockito.doReturn(2).`when`(guests).used("192.0.2.9", today)
        val guest = service.usage(null, "192.0.2.9")
        assertNull(guest.plan)
        assertEquals(listOf(PlanUsageFeature.AI_SEARCH to 2), guest.items.map { it.feature to it.used })
        assertEquals(3, guest.items.single().limit)

        Mockito.doReturn(PlanCode.FREE).`when`(repository).findPlan(7)
        Mockito.doReturn(
            mapOf((PlanUsageFeature.AI_SEARCH to "2026-10-08") to 4, (PlanUsageFeature.COMBINATION_REVIEW to "2026-10") to 1),
        ).`when`(repository).findCounts(7, listOf("2026-10-08", "2026-10-08", "2026-10", "2026-10"))
        Mockito.doReturn(1).`when`(repository).countJobs(7, PlanUsageFeature.APPLICATION_DRAFT, thisMonth, null, null)
        Mockito.doReturn(1).`when`(repository).countJobs(7, PlanUsageFeature.COMBINATION_REVIEW, thisMonth, null, null)

        val usage = service.usage(member, "192.0.2.1")

        assertEquals(PlanCode.FREE, usage.plan)
        assertEquals(
            listOf(
                PlanUsageFeature.AI_SEARCH to 4,
                PlanUsageFeature.EVIDENCE_QUESTION to 0,
                PlanUsageFeature.APPLICATION_DRAFT to 1,
                PlanUsageFeature.COMBINATION_REVIEW to 2,
            ),
            usage.items.map { it.feature to it.used },
        )
    }
}
