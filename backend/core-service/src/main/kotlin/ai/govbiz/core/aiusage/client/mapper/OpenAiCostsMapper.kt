package ai.govbiz.core.aiusage.client.mapper

import ai.govbiz.core.aiusage.client.dto.OpenAiCostsPagePayload
import ai.govbiz.core.aiusage.client.exception.OpenAiCostsClientException
import ai.govbiz.core.aiusage.domain.OpenAiCostLine
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/** Costs API 응답 한 쪽을 하루(UTC)·프로젝트·항목별 비용으로 바꿉니다. 요청 범위 밖이거나 USD가 아닌 값은 응답 전체를 믿지 않습니다. */
object OpenAiCostsMapper {
    fun toLines(page: OpenAiCostsPagePayload, from: LocalDate, toExclusive: LocalDate): List<OpenAiCostLine> =
        (page.data ?: invalid()).flatMap { bucket ->
            val date = Instant.ofEpochSecond(bucket.startTime ?: invalid()).atOffset(ZoneOffset.UTC).toLocalDate()
            if (date.isBefore(from) || !date.isBefore(toExclusive)) invalid()
            bucket.results.orEmpty().map { result ->
                val amount = result.amount ?: invalid()
                if (!amount.currency.equals("usd", ignoreCase = true)) invalid()
                OpenAiCostLine(
                    date = date,
                    projectId = result.projectId.orEmpty().take(100),
                    lineItem = result.lineItem.orEmpty().take(200),
                    amountUsd = amount.value ?: invalid(),
                )
            }
        }

    private fun invalid(): Nothing = throw OpenAiCostsClientException(OpenAiCostsClientException.Reason.INVALID_RESPONSE)
}
