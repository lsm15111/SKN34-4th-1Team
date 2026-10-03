package ai.govbiz.catalog.supportprogram.service.sync

import java.time.Duration
import java.time.Instant
import org.springframework.scheduling.Trigger
import org.springframework.scheduling.TriggerContext

/**
 * 제공처 수집의 다음 실행 시각을 직전 실행 결과로 정합니다.
 *
 * 성공했거나 더 최근 실행 때문에 공개를 건너뛴 뒤에는 기존처럼 완료 시점부터 [fixedDelay]를 기다립니다.
 * 실패 뒤에는 [retryDelay]부터 연속 실패마다 두 배로 늘린 간격으로 다시 시도하되 [fixedDelay]를 넘기지 않습니다.
 * 실패 처리와 기존 공개 데이터 보존은 SyncService가 담당하고, 이 Trigger는 다음 실행 시각만 바꿉니다.
 */
class SupportProgramCatalogSyncTrigger(
    private val initialDelay: Duration,
    private val fixedDelay: Duration,
    private val retryDelay: Duration,
) : Trigger {

    /** 같은 제공처 작업은 겹쳐 실행되지 않으며, 실행 스레드와 예약 계산 사이의 가시성만 보장합니다. */
    @Volatile
    private var consecutiveFailures = 0

    fun recordSuccess() {
        consecutiveFailures = 0
    }

    /** 실패를 기록하고 다음 재시도까지 기다릴 간격을 반환합니다. */
    fun recordFailure(): Duration {
        consecutiveFailures += 1
        return nextDelay()
    }

    override fun nextExecution(triggerContext: TriggerContext): Instant {
        val lastCompletion = triggerContext.lastCompletion()
            ?: return triggerContext.clock.instant().plus(initialDelay)
        return lastCompletion.plus(nextDelay())
    }

    private fun nextDelay(): Duration {
        if (consecutiveFailures == 0) return fixedDelay
        var delay = minOf(retryDelay, fixedDelay)
        repeat(consecutiveFailures - 1) {
            if (delay > fixedDelay.dividedBy(2)) return fixedDelay
            delay = delay.multipliedBy(2)
        }
        return delay
    }
}
