package ai.govbiz.core.aiusage.repository

import ai.govbiz.core.aiusage.domain.AiModelPrice
import ai.govbiz.core.aiusage.domain.AiModelUsage
import ai.govbiz.core.aiusage.domain.AiUsageAccount
import ai.govbiz.core.aiusage.domain.AiUsageAttribution
import ai.govbiz.core.aiusage.domain.AiUsageGroup
import ai.govbiz.core.aiusage.domain.AiUsageTotals
import ai.govbiz.core.aiusage.domain.NewAiModelPrice
import ai.govbiz.core.aiusage.domain.OpenAiCostLine
import ai.govbiz.core.aiusage.repository.mapper.AiCostDailyDbRow
import ai.govbiz.core.aiusage.repository.mapper.AiModelPriceDbRow
import ai.govbiz.core.aiusage.repository.mapper.AiUsageMapper
import ai.govbiz.core.aiusage.repository.mapper.AiUsageRecordDbRow
import ai.govbiz.core.aiusage.repository.mapper.AiUsageTotalsDbRow
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import org.springframework.stereotype.Repository

/** AI 사용 기록·가격표·실제 일별 비용을 MySQL에 남기고 기간별로 합칩니다. transaction은 부르는 Service가 정합니다. */
@Repository
class AiUsageRepository(private val mapper: AiUsageMapper) {

    fun insertUsage(
        occurredAt: LocalDateTime,
        attribution: AiUsageAttribution?,
        operation: String,
        usage: AiModelUsage,
        price: AiModelPrice?,
    ) {
        mapper.insertUsage(
            AiUsageRecordDbRow(
                occurredAt = occurredAt.truncatedTo(ChronoUnit.MICROS),
                usageDate = occurredAt.toLocalDate(),
                accountId = attribution?.accountId,
                feature = attribution?.feature?.name,
                operation = operation,
                model = usage.model,
                serviceTier = usage.serviceTier,
                callCount = usage.calls,
                inputTokens = usage.inputTokens,
                cachedInputTokens = usage.cachedInputTokens,
                outputTokens = usage.outputTokens,
                estimatedCostUsd = price?.costUsd(usage),
                priceId = price?.id,
            ),
        )
    }

    fun findPrices(): List<AiModelPrice> = mapper.findPrices().map { it.toDomain() }

    fun insertPrice(price: NewAiModelPrice, createdBy: Long, createdAt: LocalDateTime): AiModelPrice {
        val row = AiModelPriceDbRow(
            modelPrefix = price.modelPrefix,
            serviceTier = price.serviceTier,
            inputUsdPerMillion = price.inputUsdPerMillion,
            cachedInputUsdPerMillion = price.cachedInputUsdPerMillion,
            outputUsdPerMillion = price.outputUsdPerMillion,
            effectiveFrom = price.effectiveFrom,
            note = price.note,
            createdByAccountId = createdBy,
            createdAt = createdAt.truncatedTo(ChronoUnit.MICROS),
        )
        check(mapper.insertPrice(row) == 1 && row.id > 0) { "AI model price was not stored" }
        return row.toDomain()
    }

    fun sumTotals(from: LocalDate, to: LocalDate, accountId: Long? = null): AiUsageTotals = mapper.sumTotals(from, to, accountId).toTotals()

    fun sumByFeature(from: LocalDate, to: LocalDate): List<AiUsageGroup> =
        mapper.sumByFeature(from, to).map { AiUsageGroup(it.groupKey, null, it.toTotals()) }

    fun sumByModel(from: LocalDate, to: LocalDate): List<AiUsageGroup> =
        mapper.sumByModel(from, to).map { AiUsageGroup(it.groupKey, it.serviceTier, it.toTotals()) }

    /** 서울 날짜별 (추정 USD, 호출 수)입니다. */
    fun sumByDay(from: LocalDate, to: LocalDate): Map<LocalDate, Pair<BigDecimal, Long>> =
        mapper.sumByDay(from, to).associate { requireNotNull(it.day) to (it.estimatedUsd to it.calls) }

    fun sumTopAccounts(from: LocalDate, to: LocalDate, limit: Int): List<AiUsageAccount> =
        mapper.sumTopAccounts(from, to, limit).map { AiUsageAccount(requireNotNull(it.accountId), it.email.orEmpty(), it.planCode, it.toTotals()) }

    /** OpenAI 하루(UTC)별 실제 비용입니다. */
    fun sumActualByDay(from: LocalDate, to: LocalDate): Map<LocalDate, BigDecimal> =
        mapper.sumActualByDay(from, to).associate { requireNotNull(it.day) to it.estimatedUsd }

    fun findActualFetchedAt(): LocalDateTime? = mapper.findActualFetchedAt()

    /** 가져온 기간의 실제 비용을 새 값으로 바꿉니다. 부르는 Service의 transaction 하나에서 지우고 다시 넣습니다. */
    fun replaceActualCosts(from: LocalDate, to: LocalDate, lines: List<OpenAiCostLine>, fetchedAt: LocalDateTime) {
        mapper.deleteActualCosts(from, to)
        val at = fetchedAt.truncatedTo(ChronoUnit.MICROS)
        lines.forEach { line ->
            mapper.insertActualCost(AiCostDailyDbRow(line.date, line.projectId, line.lineItem, line.amountUsd, at))
        }
    }

    private fun AiModelPriceDbRow.toDomain() = AiModelPrice(
        id = id,
        modelPrefix = modelPrefix,
        serviceTier = serviceTier,
        inputUsdPerMillion = inputUsdPerMillion,
        cachedInputUsdPerMillion = cachedInputUsdPerMillion,
        outputUsdPerMillion = outputUsdPerMillion,
        effectiveFrom = requireNotNull(effectiveFrom),
        note = note,
    )

    private fun AiUsageTotalsDbRow.toTotals() =
        AiUsageTotals(calls, inputTokens, cachedInputTokens, outputTokens, estimatedUsd, unpricedCalls)
}
