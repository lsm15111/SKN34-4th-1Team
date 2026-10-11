package ai.govbiz.core.aiusage.repository

import ai.govbiz.core._common.test.MySqlTestContainerConfig
import ai.govbiz.core.account.domain.NewAccount
import ai.govbiz.core.account.repository.AccountRepository
import ai.govbiz.core.admin.domain.AdminActor
import ai.govbiz.core.aiusage.domain.AiModelUsage
import ai.govbiz.core.aiusage.domain.AiUsageAttribution
import ai.govbiz.core.aiusage.domain.AiUsageFeature
import ai.govbiz.core.aiusage.domain.NewAiModelPrice
import ai.govbiz.core.aiusage.domain.OpenAiCostLine
import ai.govbiz.core.aiusage.service.AiUsageService
import ai.govbiz.core.aiusage.service.exception.AiModelPriceConflictException
import java.math.BigDecimal
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.UUID
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/** 실제 MySQL 8.4에서 AI 사용 기록·가격표·실제 비용의 저장과 기간 합계, 기능 transaction과 따로 남는 기록, 제약을 확인합니다. */
@SpringBootTest(properties = [
    "app.account.jwt-secret=test-jwt-secret-0123456789abcdef0123456789",
    "app.ai-service.base-url=http://127.0.0.1:1",
    "app.bizinfo.sync.enabled=false",
    "app.support-program-index.enabled=false",
    "app.application-document.jobs.enabled=false",
    "app.ai-cost.sync-enabled=false",
])
@Import(MySqlTestContainerConfig::class)
class AiUsageRepositoryIntegrationTest {
    @Autowired private lateinit var service: AiUsageService
    @Autowired private lateinit var repository: AiUsageRepository
    @Autowired private lateinit var accounts: AccountRepository
    @Autowired private lateinit var jdbc: JdbcTemplate
    @Autowired private lateinit var transactionManager: PlatformTransactionManager
    private val today = LocalDate.now(ZoneId.of("Asia/Seoul"))

    @Test
    fun recordsPricedAndUnpricedUsageAndSumsItByFeatureModelDayAndAccount() {
        val member = account()
        val actor = AdminActor(account(), "198.51.100.7", null)
        val before = repository.sumTotals(today, today)
        service.record(
            "support-program-rankings/rank",
            listOf(
                AiModelUsage("gpt-5.6-sol-2026-07-30", "priority", 1, 10_000, 4_000, 500),
                AiModelUsage("gpt-unknown-1", "default", 2, 100, 0, 10),
            ),
            AiUsageAttribution(member, AiUsageFeature.AI_SEARCH),
        )
        service.record("support-program-index/batch", listOf(AiModelUsage("text-embedding-3-small", "default", 3, 1_000_000, 0, 0)), null)

        // gpt-5.6-sol Fast: 6,000 × 8 + 4,000 × 0.8 + 500 × 40 = 48,000 + 3,200 + 20,000 micro-USD = 0.0712
        val mine = repository.sumTotals(today, today, member)
        assertEquals(3, mine.calls)
        assertEquals(0, BigDecimal("0.0712").compareTo(mine.estimatedUsd))
        assertEquals(2, mine.unpricedCalls)
        val all = repository.sumTotals(today, today)
        assertEquals(before.calls + 6, all.calls)
        assertEquals(0, (before.estimatedUsd + BigDecimal("0.0912")).compareTo(all.estimatedUsd))

        val summary = service.summary(actor.let { AdminActor.of(it.accountId, it.clientIp, it.userAgent) }, today, today)
        assertTrue(summary.byFeature.any { it.key == "AI_SEARCH" && it.totals.calls >= 3 })
        assertTrue(summary.byFeature.any { it.key == null && it.totals.calls >= 3 })
        assertTrue(summary.byModel.any { it.key == "gpt-5.6-sol-2026-07-30" && it.serviceTier == "priority" })
        assertTrue(summary.topAccounts.any { it.accountId == member && it.email.startsWith("ai-usage-") })
        assertEquals(today, summary.days.single().date)
        assertEquals(1, jdbc.queryForObject(
            "SELECT COUNT(*) FROM admin_access_log WHERE action = 'AI_COST_VIEW' AND actor_account_id = ?", Int::class.java, actor.accountId))
    }

    @Test
    fun usageStaysRecordedWhenTheCallingFeatureRollsBack() {
        val member = account()
        assertThrows(IllegalStateException::class.java) {
            TransactionTemplate(transactionManager).execute {
                service.record("combination-reviews/analyze", listOf(AiModelUsage("gpt-5.6-luna", "default", 1, 10, 0, 5)),
                    AiUsageAttribution(member, AiUsageFeature.COMBINATION_REVIEW))
                error("기능 실패")
            }
        }
        assertEquals(1, repository.sumTotals(today, today, member).calls)
    }

    @Test
    fun seededPricesCoverTheModelsWeUseAndNewPricesAreAddedNotEdited() {
        val prices = repository.findPrices()
        listOf("gpt-5.6-sol" to "priority", "gpt-5.6-luna" to "default", "gpt-6-luna" to "default", "gpt-5-nano" to "default",
            "text-embedding-3-small" to "default").forEach { (model, tier) ->
            assertTrue(prices.any { it.modelPrefix == model && it.serviceTier == tier }, "$model $tier")
        }
        val admin = account()
        val price = NewAiModelPrice("gpt-test-${UUID.randomUUID().toString().take(8)}", "flex", BigDecimal("0.1"), null, BigDecimal("0.5"), today, "테스트")
        service.addPrice(AdminActor.of(admin, "198.51.100.7", null), price)
        assertThrows(AiModelPriceConflictException::class.java) { service.addPrice(AdminActor.of(admin, "198.51.100.7", null), price) }
        assertNull(repository.findPrices().single { it.modelPrefix == price.modelPrefix }.cachedInputUsdPerMillion)
    }

    @Test
    fun actualCostsReplaceOnlyTheFetchedDays() {
        val base = LocalDate.of(2020, 1, 10)
        val fetchedAt = LocalDateTime.of(2026, 10, 10, 10, 10)
        repository.replaceActualCosts(base, base.plusDays(1), listOf(
            OpenAiCostLine(base, "proj", "gpt-5.6-luna, input", BigDecimal("0.5")),
            OpenAiCostLine(base.plusDays(1), "proj", "gpt-5.6-luna, 출력", BigDecimal("1.25")),
        ), fetchedAt)
        repository.replaceActualCosts(base.plusDays(1), base.plusDays(1), listOf(
            OpenAiCostLine(base.plusDays(1), "proj", "gpt-5.6-luna, 출력", BigDecimal("2")),
        ), fetchedAt)

        val days = repository.sumActualByDay(base, base.plusDays(1))
        assertEquals(0, BigDecimal("0.5").compareTo(days[base]))
        assertEquals(0, BigDecimal("2").compareTo(days[base.plusDays(1)]))
    }

    @Test
    fun theDatabaseRejectsUnknownFeaturesImpossibleTokensAndUnknownTiers() {
        listOf(
            "INSERT INTO ai_usage_record (occurred_at, usage_date, feature, operation, model, service_tier, call_count, input_tokens, cached_input_tokens, output_tokens) VALUES (NOW(6), CURDATE(), 'CHAT', 'op', 'm', 'default', 1, 1, 0, 0)",
            "INSERT INTO ai_usage_record (occurred_at, usage_date, operation, model, service_tier, call_count, input_tokens, cached_input_tokens, output_tokens) VALUES (NOW(6), CURDATE(), 'op', 'm', 'default', 1, 1, 2, 0)",
            "INSERT INTO ai_usage_record (occurred_at, usage_date, operation, model, service_tier, call_count, input_tokens, cached_input_tokens, output_tokens) VALUES (NOW(6), CURDATE(), 'op', 'm', 'default', 0, 1, 0, 0)",
            "INSERT INTO ai_model_price (model_prefix, service_tier, input_usd_per_million, output_usd_per_million, effective_from, created_at) VALUES ('gpt-x', 'scale', 1, 1, CURDATE(), NOW(6))",
            "INSERT INTO ai_model_price (model_prefix, service_tier, input_usd_per_million, output_usd_per_million, effective_from, created_at) VALUES ('gpt-x', 'default', -1, 1, CURDATE(), NOW(6))",
        ).forEach { sql -> assertThrows(DataAccessException::class.java) { jdbc.update(sql) } }
    }

    private fun account(): Long =
        accounts.createAccount(NewAccount("ai-usage-${UUID.randomUUID()}@example.test", "test-password-hash", LocalDateTime.of(2026, 10, 1, 0, 0))).id
}
