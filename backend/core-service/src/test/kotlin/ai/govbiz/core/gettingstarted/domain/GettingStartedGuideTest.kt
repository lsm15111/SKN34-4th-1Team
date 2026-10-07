package ai.govbiz.core.gettingstarted.domain

import ai.govbiz.core.account.domain.AccountType
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepId.COMPANY
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepId.DAILY_REPORT
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepId.DEADLINE_REMINDER
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepId.SAVE_PROGRAM
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepId.SIGN_UP
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepId.START_PREPARATION
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepStatus.DONE
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepStatus.LOCKED
import ai.govbiz.core.gettingstarted.domain.GettingStartedStepStatus.TODO
import java.time.LocalDateTime
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class GettingStartedGuideTest {
    private val signedUpAt = LocalDateTime.of(2026, 10, 1, 9, 0)
    private val now = LocalDateTime.of(2026, 10, 8, 12, 0)
    private val business = GettingStartedMember(AccountType.BUSINESS, admin = false, signedUpAt = signedUpAt)
    private val individual = business.copy(accountType = AccountType.INDIVIDUAL)
    private val nothing = GettingStartedFacts(
        companyRegistered = false, programSaved = false, deadlineReminderEnabled = false, dailyReportReady = false,
        preparationStarted = false, closedAt = null, completedAt = null,
    )
    private val everything = nothing.copy(
        companyRegistered = true, programSaved = true, deadlineReminderEnabled = true, dailyReportReady = true, preparationStarted = true,
    )

    @Test
    fun businessMembersSeeSignUpPlusFiveStepsInOrderWithSignUpAlwaysDone() {
        val guide = GettingStartedGuide.of(business, nothing, enabled = true, now = now)

        assertEquals(
            listOf(SIGN_UP to DONE, COMPANY to TODO, SAVE_PROGRAM to TODO, DEADLINE_REMINDER to TODO, DAILY_REPORT to LOCKED, START_PREPARATION to TODO),
            guide.steps.map { it.id to it.status },
        )
        assertFalse(guide.complete)
        // 회원 유형을 아직 고르지 않은 계정도 기업 회원과 같은 단계입니다.
        assertEquals(guide.steps, GettingStartedGuide.of(business.copy(accountType = null), nothing, true, now).steps)
    }

    @Test
    fun individualMembersSeeSignUpPlusThreeStepsWithoutCompanyOrDailyReport() {
        val guide = GettingStartedGuide.of(individual, everything, enabled = true, now = now)

        assertEquals(listOf(SIGN_UP, SAVE_PROGRAM, DEADLINE_REMINDER, START_PREPARATION), guide.steps.map { it.id })
        assertTrue(guide.complete)
    }

    @Test
    fun eachStepIsDoneOnlyByItsOwnFact() {
        val cases = mapOf(
            COMPANY to nothing.copy(companyRegistered = true),
            SAVE_PROGRAM to nothing.copy(programSaved = true),
            DEADLINE_REMINDER to nothing.copy(deadlineReminderEnabled = true),
            START_PREPARATION to nothing.copy(preparationStarted = true),
        )
        for ((step, facts) in cases) {
            val done = GettingStartedGuide.steps(AccountType.BUSINESS, facts).filter { it.status == DONE }.map { it.id }
            assertEquals(listOf(SIGN_UP, step), done, "$step")
        }
    }

    @Test
    fun dailyReportIsLockedWithoutACompanyTodoWithOneAndDoneOnceAReportIsReady() {
        fun status(facts: GettingStartedFacts) =
            GettingStartedGuide.steps(AccountType.BUSINESS, facts).single { it.id == DAILY_REPORT }.status

        assertEquals(LOCKED, status(nothing))
        assertEquals(TODO, status(nothing.copy(companyRegistered = true)))
        assertEquals(DONE, status(nothing.copy(companyRegistered = true, dailyReportReady = true)))
        // 기업을 지운 뒤에도 이미 받은 리포트가 있으면 끝낸 단계입니다.
        assertEquals(DONE, status(nothing.copy(dailyReportReady = true)))
    }

    @Test
    fun visibleOnlyWhenEnabledForNonAdminsWhoHaveNotClosedIt() {
        assertTrue(GettingStartedGuide.of(business, nothing, enabled = true, now = now).visible)

        val disabled = GettingStartedGuide.of(business, nothing, enabled = false, now = now)
        assertFalse(disabled.visible)
        assertFalse(disabled.closed)
        // 단계는 꺼져 있어도 그대로 계산합니다.
        assertEquals(6, disabled.steps.size)

        val admin = GettingStartedGuide.of(business.copy(admin = true), nothing.copy(closedAt = now), enabled = true, now = now)
        assertFalse(admin.visible)
        assertFalse(admin.closed, "관리자에게는 다시 보기도 두지 않습니다")

        val closed = GettingStartedGuide.of(business, nothing.copy(closedAt = now.minusHours(1)), enabled = true, now = now)
        assertFalse(closed.visible)
        assertTrue(closed.closed)
    }

    @Test
    fun offeredOnlyDuringTheFirstThirtyDaysAfterSignUp() {
        val lastMoment = signedUpAt.plusDays(30).minusNanos(1_000)
        assertTrue(GettingStartedGuide.of(business, nothing, true, lastMoment).visible)

        val expired = GettingStartedGuide.of(business, nothing, true, signedUpAt.plusDays(30))
        assertFalse(expired.visible)
        // 기간이 지나 다시 열어도 보이지 않으므로 닫은 계정에도 다시 보기를 두지 않습니다.
        val expiredClosed = GettingStartedGuide.of(business, nothing.copy(closedAt = signedUpAt.plusDays(2)), true, signedUpAt.plusDays(31))
        assertFalse(expiredClosed.visible)
        assertFalse(expiredClosed.closed)
    }

    @Test
    fun staysForTwentyFourHoursAfterFirstCompletionAndDoesNotComeBackWhenAStepRegresses() {
        val completedAt = now.minusHours(2)
        val justCompleted = GettingStartedGuide.of(business, everything.copy(completedAt = completedAt), true, now)
        assertTrue(justCompleted.complete)
        assertTrue(justCompleted.visible)
        assertEquals(completedAt, justCompleted.completedAt)

        assertTrue(GettingStartedGuide.of(business, everything.copy(completedAt = completedAt), true, completedAt.plusHours(24).minusNanos(1_000)).visible)
        assertFalse(GettingStartedGuide.of(business, everything.copy(completedAt = completedAt), true, completedAt.plusHours(24)).visible)

        // 완료 뒤 마감 알림을 꺼도 완료 시각이 남아 있어 24시간이 지나면 다시 나타나지 않습니다.
        val regressed = GettingStartedGuide.of(business, everything.copy(deadlineReminderEnabled = false, completedAt = completedAt), true, now.plusDays(2))
        assertFalse(regressed.complete)
        assertFalse(regressed.visible)
        assertFalse(regressed.closed)

        // 아직 완료 시각을 남기기 전이면(처음 모두 마친 순간) 보입니다.
        assertTrue(GettingStartedGuide.of(business, everything, true, now).visible)
    }
}
