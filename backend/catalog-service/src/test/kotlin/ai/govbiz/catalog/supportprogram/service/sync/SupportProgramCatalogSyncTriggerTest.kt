package ai.govbiz.catalog.supportprogram.service.sync

import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.scheduling.support.SimpleTriggerContext

class SupportProgramCatalogSyncTriggerTest {

    @Test
    fun startsAfterTheInitialDelay() {
        val trigger = trigger()

        assertEquals(
            COMPLETED_AT.plus(INITIAL_DELAY),
            trigger.nextExecution(SimpleTriggerContext(Clock.fixed(COMPLETED_AT, ZoneOffset.UTC))),
        )
    }

    @Test
    fun keepsTheNormalIntervalAfterASuccessfulSync() {
        val trigger = trigger()
        trigger.recordSuccess()

        assertEquals(COMPLETED_AT.plus(FIXED_DELAY), trigger.nextAfterCompletion())
    }

    @Test
    fun retriesSoonAfterAFailureAndDoublesTheDelayOnlyUpToTheNormalInterval() {
        val trigger = trigger()

        val delays = List(9) { trigger.recordFailure() }

        assertEquals(listOf<Long>(5, 10, 20, 40, 80, 160, 320, 360, 360).map(Duration::ofMinutes), delays)
        assertEquals(COMPLETED_AT.plus(FIXED_DELAY), trigger.nextAfterCompletion())
    }

    @Test
    fun aSuccessfulSyncResetsTheBackoff() {
        val trigger = trigger()
        repeat(3) { trigger.recordFailure() }
        assertEquals(COMPLETED_AT.plus(Duration.ofMinutes(20)), trigger.nextAfterCompletion())

        trigger.recordSuccess()
        assertEquals(COMPLETED_AT.plus(FIXED_DELAY), trigger.nextAfterCompletion())

        assertEquals(RETRY_DELAY, trigger.recordFailure())
        assertEquals(COMPLETED_AT.plus(RETRY_DELAY), trigger.nextAfterCompletion())
    }

    @Test
    fun aRetryNeverWaitsLongerThanAShorterNormalInterval() {
        // Compose 검증처럼 정상 간격이 짧으면 실패 뒤에도 그 간격으로 다시 시도합니다.
        val trigger = SupportProgramCatalogSyncTrigger(Duration.ZERO, Duration.ofSeconds(2), RETRY_DELAY)

        assertEquals(Duration.ofSeconds(2), trigger.recordFailure())
        assertEquals(Duration.ofSeconds(2), trigger.recordFailure())
        assertEquals(COMPLETED_AT.plusSeconds(2), trigger.nextAfterCompletion())
    }

    private fun trigger() = SupportProgramCatalogSyncTrigger(INITIAL_DELAY, FIXED_DELAY, RETRY_DELAY)

    private fun SupportProgramCatalogSyncTrigger.nextAfterCompletion() =
        nextExecution(SimpleTriggerContext(COMPLETED_AT.minusSeconds(30), COMPLETED_AT.minusSeconds(30), COMPLETED_AT))

    private companion object {
        val COMPLETED_AT: Instant = Instant.parse("2026-10-04T00:00:00Z")
        val INITIAL_DELAY: Duration = Duration.ofSeconds(15)
        val FIXED_DELAY: Duration = Duration.ofHours(6)
        val RETRY_DELAY: Duration = Duration.ofMinutes(5)
    }
}
