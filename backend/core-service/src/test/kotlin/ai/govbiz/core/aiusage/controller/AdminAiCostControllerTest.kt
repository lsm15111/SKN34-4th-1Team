package ai.govbiz.core.aiusage.controller

import ai.govbiz.core._common.exception.ApiExceptionHandler
import ai.govbiz.core.account.domain.AccountRole
import ai.govbiz.core.account.helper.AccountTestHelper
import ai.govbiz.core.account.helper.SessionCookieHelper
import ai.govbiz.core.account.service.AccountSessionService
import ai.govbiz.core.admin.domain.AdminActor
import ai.govbiz.core.admin.web.AdminPrincipalArgumentResolver
import ai.govbiz.core.aiusage.domain.AiCostSummary
import ai.govbiz.core.aiusage.domain.AiCostDay
import ai.govbiz.core.aiusage.domain.AiUsageAccount
import ai.govbiz.core.aiusage.domain.AiUsageGroup
import ai.govbiz.core.aiusage.domain.AiUsageTotals
import ai.govbiz.core.aiusage.service.AiCostSyncService
import ai.govbiz.core.aiusage.service.AiUsageService
import ai.govbiz.core.aiusage.service.exception.AiCostSyncException
import ai.govbiz.core.aiusage.service.exception.AiModelPriceConflictException
import jakarta.servlet.http.Cookie
import java.math.BigDecimal
import java.time.LocalDate
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.any
import org.mockito.Mockito.doReturn
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.verifyNoInteractions
import org.mockito.junit.jupiter.MockitoExtension
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

@ExtendWith(MockitoExtension::class)
class AdminAiCostControllerTest {
    @Mock private lateinit var sessions: AccountSessionService
    @Mock private lateinit var usage: AiUsageService
    @Mock private lateinit var costs: AiCostSyncService
    private lateinit var mvc: MockMvc
    private val admin = AccountTestHelper.account(id = 1, email = "admin@govbiz.local", role = AccountRole.ADMIN)
    private val actor = AdminActor(1, "198.51.100.7", "Mozilla/5.0")

    @BeforeEach
    fun setUp() {
        mvc = MockMvcBuilders.standaloneSetup(AdminAiCostController(usage, costs))
            .setCustomArgumentResolvers(AdminPrincipalArgumentResolver { sessions })
            .setControllerAdvice(ApiExceptionHandler()).build()
        doReturn(admin).`when`(sessions).requireAccount(SESSION)
    }

    @Test
    fun summaryShowsEstimatedAndActualCostsAsExactUsdStrings() {
        val from = LocalDate.of(2026, 10, 1)
        val totals = AiUsageTotals(12, 50_000, 30_000, 4_000, BigDecimal("0.0123456789"), 2)
        doReturn(
            AiCostSummary(
                from, from, totals, BigDecimal("0.02"), true, null, BigDecimal("1380"),
                listOf(AiUsageGroup("AI_SEARCH", null, totals), AiUsageGroup(null, null, AiUsageTotals.EMPTY)),
                listOf(AiUsageGroup("gpt-5.6-sol-2026-07-30", "priority", totals)),
                listOf(AiCostDay(from, BigDecimal("0.0123456789"), 12, null)),
                listOf(AiUsageAccount(7, "member@company.co.kr", "PLUS", totals)),
            ),
        ).`when`(usage).summary(actor, from, from)

        mvc.perform(asAdmin(get("$PATH?from=2026-10-01&to=2026-10-01")))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
            .andExpect(jsonPath("$.totals.estimatedUsd").value("0.012346"))
            .andExpect(jsonPath("$.totals.unpricedCalls").value(2))
            .andExpect(jsonPath("$.actualUsd").value("0.020000"))
            .andExpect(jsonPath("$.krwPerUsd").value("1380"))
            .andExpect(jsonPath("$.byFeature[1].key").doesNotExist())
            .andExpect(jsonPath("$.byModel[0].serviceTier").value("priority"))
            .andExpect(jsonPath("$.days[0].actualUsd").doesNotExist())
            .andExpect(jsonPath("$.topAccounts[0].email").value("member@company.co.kr"))
    }

    @Test
    fun syncFailuresAndPriceConflictsHaveTheirOwnCodes() {
        doThrow(AiCostSyncException(AiCostSyncException.Reason.ADMIN_KEY_MISSING)).`when`(costs).sync()
        mvc.perform(asAdmin(post("$PATH/sync")))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("OPENAI_ADMIN_KEY_MISSING"))

        doThrow(AiModelPriceConflictException()).`when`(usage).addPrice(org.mockito.Mockito.eq(actor) ?: actor, any() ?: price())
        mvc.perform(asAdmin(post("$PATH/prices")).contentType(MediaType.APPLICATION_JSON).content(PRICE))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("AI_MODEL_PRICE_CONFLICT"))
    }

    @Test
    fun badPricesAndPeriodsAreRejectedBeforeTheService() {
        mvc.perform(asAdmin(post("$PATH/prices")).contentType(MediaType.APPLICATION_JSON).content(PRICE.replace(":0.2,", ":-1,")))
            .andExpect(status().isBadRequest())
        mvc.perform(asAdmin(post("$PATH/prices")).contentType(MediaType.APPLICATION_JSON).content(PRICE.replace("\"default\"", "\"scale\"")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("AI_COST_REQUEST_INVALID"))
        verifyNoInteractions(usage)
    }

    private fun price() = ai.govbiz.core.aiusage.domain.NewAiModelPrice(
        "gpt-5.6-luna", "default", BigDecimal("0.2"), null, BigDecimal("1.2"), LocalDate.of(2026, 11, 1), null,
    )

    private fun asAdmin(request: MockHttpServletRequestBuilder): MockHttpServletRequestBuilder =
        request.cookie(Cookie(SessionCookieHelper.COOKIE_NAME, SESSION))
            .header(HttpHeaders.USER_AGENT, requireNotNull(actor.userAgent))
            .with { it.remoteAddr = actor.clientIp; it }

    private companion object {
        const val PATH = "/api/v1/admin/ai-costs"
        const val SESSION = "admin-session"
        const val PRICE = """{"modelPrefix":"gpt-5.6-luna","serviceTier":"default","inputUsdPerMillion":0.2,"outputUsdPerMillion":1.2,"effectiveFrom":"2026-11-01"}"""
    }
}
