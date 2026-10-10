package ai.govbiz.core.aiusage.domain

import java.math.BigDecimal
import java.time.LocalDate
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class AiModelPriceTest {
    private val start = LocalDate.of(2026, 10, 1)
    private val luna = price(1, "gpt-5.6-luna", "default", "0.2", "0.02", "1.2")
    private val lunaFast = price(2, "gpt-5.6-luna", "priority", "0.4", "0.04", "2.4")
    private val embedding = price(3, "text-embedding-3-small", "default", "0.02", null, "0")

    @Test
    fun costsSplitCachedFromUncachedInputAndAddOutputPerMillionTokens() {
        // (1,200 - 1,000) × 0.2 + 1,000 × 0.02 + 80 × 1.2 = 40 + 20 + 96 = 156 micro-USD
        val usage = AiModelUsage("gpt-5.6-luna-2026-07-30", "default", 2, 1_200, 1_000, 80)
        assertEquals(BigDecimal("0.0001560000"), luna.costUsd(usage))
        // 캐시 가격이 없으면 입력 가격을 씁니다.
        assertEquals(BigDecimal("0.0000008400"), embedding.costUsd(AiModelUsage("text-embedding-3-small", "default", 1, 42, 0, 0)))
    }

    @Test
    fun aPriceCoversItsSnapshotsAndTierButNotLookAlikeModels() {
        val prices = listOf(luna, lunaFast, embedding)
        assertEquals(luna, AiModelPrice.find(prices, "gpt-5.6-luna", "default", start))
        assertEquals(lunaFast, AiModelPrice.find(prices, "gpt-5.6-luna-2026-07-30", "priority", start))
        assertNull(AiModelPrice.find(prices, "gpt-5.6-lunar", "default", start))
        assertNull(AiModelPrice.find(prices, "gpt-5.6-luna", "flex", start))
        // 시작일 전에는 쓰지 않습니다.
        assertNull(AiModelPrice.find(prices, "gpt-5.6-luna", "default", start.minusDays(1)))
    }

    @Test
    fun theLongestPrefixThenTheLatestStartWins() {
        val family = price(4, "gpt-6", "default", "9", null, "9")
        val newer = price(5, "gpt-6-luna", "default", "0.15", "0.015", "0.6", start.plusDays(10))
        val prices = listOf(family, price(6, "gpt-6-luna", "default", "0.1", "0.01", "0.5"), newer)
        assertEquals(6L, AiModelPrice.find(prices, "gpt-6-luna-2026-09-03", "default", start.plusDays(9))?.id)
        assertEquals(5L, AiModelPrice.find(prices, "gpt-6-luna-2026-09-03", "default", start.plusDays(10))?.id)
        assertEquals(4L, AiModelPrice.find(prices, "gpt-6-sol", "default", start)?.id)
    }

    @Test
    fun usageAndNewPricesRejectImpossibleValues() {
        assertThrows(IllegalArgumentException::class.java) { AiModelUsage("gpt-5-nano", "default", 1, 10, 11, 0) }
        assertThrows(IllegalArgumentException::class.java) { AiModelUsage("gpt-5-nano", "default", 0, 10, 0, 0) }
        assertThrows(IllegalArgumentException::class.java) { AiModelUsage("gpt 5", "default", 1, 10, 0, 0) }
        assertThrows(IllegalArgumentException::class.java) {
            NewAiModelPrice("gpt-5-nano", "scale", BigDecimal.ONE, null, BigDecimal.ONE, start, null)
        }
        assertThrows(IllegalArgumentException::class.java) {
            NewAiModelPrice("GPT-5", "default", BigDecimal.ONE, null, BigDecimal.ONE, start, null)
        }
        assertThrows(IllegalArgumentException::class.java) {
            NewAiModelPrice("gpt-5-nano", "default", BigDecimal("-1"), null, BigDecimal.ONE, start, null)
        }
    }

    private fun price(id: Long, prefix: String, tier: String, input: String, cached: String?, output: String, from: LocalDate = start) =
        AiModelPrice(id, prefix, tier, BigDecimal(input), cached?.let(::BigDecimal), BigDecimal(output), from, null)
}
