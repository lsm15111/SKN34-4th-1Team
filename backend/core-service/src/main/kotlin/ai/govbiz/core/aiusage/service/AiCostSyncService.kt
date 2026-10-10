package ai.govbiz.core.aiusage.service

import ai.govbiz.core.aiusage.client.OpenAiCostsClient
import ai.govbiz.core.aiusage.client.exception.OpenAiCostsClientException
import ai.govbiz.core.aiusage.config.AiCostProperties
import ai.govbiz.core.aiusage.domain.AiCostSyncResult
import ai.govbiz.core.aiusage.repository.AiUsageRepository
import ai.govbiz.core.aiusage.service.exception.AiCostSyncException
import java.math.BigDecimal
import java.time.Clock
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * OpenAI Costs API에서 최근 [AiCostProperties.syncDays]일(UTC, 오늘 포함)의 실제 비용을 가져옵니다. 모든 쪽을 다 읽고 확인한 뒤에만
 * 그 기간의 행을 한 transaction에서 바꾸고, 가져오지 못하면 기존 값을 그대로 둡니다. 외부 호출은 transaction 밖에서 끝냅니다.
 * OpenAI 쪽 집계는 몇 시간 늦게 반영될 수 있어 최근 날짜는 다음 동기화 때 다시 바뀝니다.
 */
@Service
class AiCostSyncService(
    private val client: OpenAiCostsClient,
    private val repository: AiUsageRepository,
    private val properties: AiCostProperties,
    transactionManager: PlatformTransactionManager,
    @param:Qualifier("seoulClock") private val clock: Clock,
) {
    private val transactions = TransactionTemplate(transactionManager)

    val configured: Boolean
        get() = properties.adminKeyConfigured

    fun sync(): AiCostSyncResult {
        if (!configured) throw AiCostSyncException(AiCostSyncException.Reason.ADMIN_KEY_MISSING)
        val today = LocalDate.now(clock.withZone(ZoneOffset.UTC))
        val from = today.minusDays(properties.syncDays - 1)
        val lines = try {
            client.fetch(from, today.plusDays(1))
        } catch (error: OpenAiCostsClientException) {
            throw AiCostSyncException(
                when (error.reason) {
                    OpenAiCostsClientException.Reason.REJECTED -> AiCostSyncException.Reason.ADMIN_KEY_REJECTED
                    OpenAiCostsClientException.Reason.UNAVAILABLE -> AiCostSyncException.Reason.UNAVAILABLE
                    OpenAiCostsClientException.Reason.INVALID_RESPONSE -> AiCostSyncException.Reason.INVALID_RESPONSE
                },
            )
        }
        val merged = lines.groupBy { Triple(it.date, it.projectId, it.lineItem) }
            .map { (_, same) -> same.first().copy(amountUsd = same.fold(BigDecimal.ZERO) { sum, line -> sum + line.amountUsd }) }
        transactions.executeWithoutResult { _ -> repository.replaceActualCosts(from, today, merged, LocalDateTime.now(clock)) }
        return AiCostSyncResult(from, today, merged.size, merged.fold(BigDecimal.ZERO) { sum, line -> sum + line.amountUsd })
    }
}
