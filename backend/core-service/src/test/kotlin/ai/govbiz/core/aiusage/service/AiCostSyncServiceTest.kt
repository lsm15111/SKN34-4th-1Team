package ai.govbiz.core.aiusage.service

import ai.govbiz.core.aiusage.client.OpenAiCostsClient
import ai.govbiz.core.aiusage.client.exception.OpenAiCostsClientException
import ai.govbiz.core.aiusage.config.AiCostProperties
import ai.govbiz.core.aiusage.domain.OpenAiCostLine
import ai.govbiz.core.aiusage.repository.AiUsageRepository
import ai.govbiz.core.aiusage.service.exception.AiCostSyncException
import ai.govbiz.core.planusage.PlanUsageTestHelper
import java.math.BigDecimal
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.Mockito

class AiCostSyncServiceTest {
    // 서울 2026-10-11 08:30 = UTC 2026-10-10 23:30. OpenAI 하루는 UTC라 오늘은 10월 10일입니다.
    private val clock = Clock.fixed(Instant.parse("2026-10-10T23:30:00Z"), ZoneId.of("Asia/Seoul"))
    private val client = Mockito.mock(OpenAiCostsClient::class.java)
    private val repository = Mockito.mock(AiUsageRepository::class.java)

    private fun service(key: String = "admin-key") =
        AiCostSyncService(client, repository, AiCostProperties(openaiAdminKey = key, syncDays = 3), PlanUsageTestHelper.noTransactions(), clock)

    @Test
    fun withoutAnAdminKeyNothingIsCalled() {
        assertEquals(AiCostSyncException.Reason.ADMIN_KEY_MISSING, assertThrows(AiCostSyncException::class.java) { service(" ").sync() }.reason)
        Mockito.verifyNoInteractions(client, repository)
    }

    @Test
    fun replacesTheFetchedUtcDaysAndMergesRepeatedLines() {
        val day = LocalDate.of(2026, 10, 9)
        Mockito.doReturn(
            listOf(
                OpenAiCostLine(day, "proj", "gpt-5.6-luna, input", BigDecimal("0.10")),
                OpenAiCostLine(day, "proj", "gpt-5.6-luna, input", BigDecimal("0.05")),
                OpenAiCostLine(day.plusDays(1), "proj", "gpt-5.6-luna, output", BigDecimal("0.20")),
            ),
        ).`when`(client).fetch(LocalDate.of(2026, 10, 8), LocalDate.of(2026, 10, 11))

        val result = service().sync()

        assertEquals(2, result.lines)
        assertEquals(BigDecimal("0.35"), result.amountUsd)
        Mockito.verify(repository).replaceActualCosts(
            LocalDate.of(2026, 10, 8),
            LocalDate.of(2026, 10, 10),
            listOf(
                OpenAiCostLine(day, "proj", "gpt-5.6-luna, input", BigDecimal("0.15")),
                OpenAiCostLine(day.plusDays(1), "proj", "gpt-5.6-luna, output", BigDecimal("0.20")),
            ),
            LocalDateTime.of(2026, 10, 11, 8, 30),
        )
    }

    @Test
    fun aRejectedKeyKeepsTheStoredCosts() {
        Mockito.doThrow(OpenAiCostsClientException(OpenAiCostsClientException.Reason.REJECTED)).`when`(client)
            .fetch(LocalDate.of(2026, 10, 8), LocalDate.of(2026, 10, 11))

        assertEquals(AiCostSyncException.Reason.ADMIN_KEY_REJECTED, assertThrows(AiCostSyncException::class.java) { service().sync() }.reason)
        Mockito.verifyNoInteractions(repository)
    }
}
