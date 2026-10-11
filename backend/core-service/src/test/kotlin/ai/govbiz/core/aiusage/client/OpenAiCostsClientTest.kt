package ai.govbiz.core.aiusage.client

import ai.govbiz.core.aiusage.client.exception.OpenAiCostsClientException
import ai.govbiz.core.aiusage.config.AiCostProperties
import ai.govbiz.core.aiusage.domain.OpenAiCostLine
import java.math.BigDecimal
import java.time.LocalDate
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import org.hamcrest.Matchers.containsString
import org.hamcrest.Matchers.startsWith

class OpenAiCostsClientTest {
    private val builder = RestClient.builder().baseUrl("https://api.openai.test")
    private val server = MockRestServiceServer.bindTo(builder).build()
    private val properties = AiCostProperties(openaiAdminKey = "admin-key", openaiProjectId = "proj_govbiz")
    private val client = OpenAiCostsClient(builder.build(), properties)
    private val from = LocalDate.of(2026, 10, 9)
    private val to = LocalDate.of(2026, 10, 11)

    @Test
    fun readsEveryPageGroupedByProjectAndLineItemForOurProject() {
        server.expect(requestTo(startsWith("https://api.openai.test/v1/organization/costs")))
            .andExpect(queryParam("start_time", "1791504000"))
            .andExpect(queryParam("end_time", "1791676800"))
            .andExpect(queryParam("bucket_width", "1d"))
            .andExpect(queryParam("group_by", "project_id", "line_item"))
            .andExpect(queryParam("project_ids", "proj_govbiz"))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer admin-key"))
            .andRespond(withSuccess(page(1791504000, "0.0123", "next-1"), MediaType.APPLICATION_JSON))
        server.expect(requestTo(containsString("page=next-1")))
            .andRespond(withSuccess(page(1791590400, "1.5", null), MediaType.APPLICATION_JSON))

        assertEquals(
            listOf(
                OpenAiCostLine(from, "proj_govbiz", "gpt-5.6-luna, input", BigDecimal("0.0123")),
                OpenAiCostLine(from.plusDays(1), "proj_govbiz", "gpt-5.6-luna, input", BigDecimal("1.5")),
            ),
            client.fetch(from, to),
        )
        server.verify()
    }

    @Test
    fun aProjectKeyIsRejectedAndOtherFailuresAreUnavailable() {
        server.expect(requestTo(startsWith("https://api.openai.test/v1/organization/costs"))).andRespond(withStatus(HttpStatus.FORBIDDEN))
        assertEquals(OpenAiCostsClientException.Reason.REJECTED, assertThrows(OpenAiCostsClientException::class.java) { client.fetch(from, to) }.reason)
        server.reset()
        server.expect(requestTo(startsWith("https://api.openai.test/v1/organization/costs"))).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE))
        assertEquals(OpenAiCostsClientException.Reason.UNAVAILABLE, assertThrows(OpenAiCostsClientException::class.java) { client.fetch(from, to) }.reason)
    }

    @Test
    fun anotherCurrencyOrADayOutsideTheRangeIsNotTrusted() {
        server.expect(requestTo(startsWith("https://api.openai.test/v1/organization/costs")))
            .andRespond(withSuccess(page(1791504000, "1", null, currency = "eur"), MediaType.APPLICATION_JSON))
        assertEquals(OpenAiCostsClientException.Reason.INVALID_RESPONSE, assertThrows(OpenAiCostsClientException::class.java) { client.fetch(from, to) }.reason)
        server.reset()
        server.expect(requestTo(startsWith("https://api.openai.test/v1/organization/costs")))
            .andRespond(withSuccess(page(1791676800, "1", null), MediaType.APPLICATION_JSON))
        assertEquals(OpenAiCostsClientException.Reason.INVALID_RESPONSE, assertThrows(OpenAiCostsClientException::class.java) { client.fetch(from, to) }.reason)
    }

    private fun page(start: Long, value: String, next: String?, currency: String = "usd") = """
        {"object":"page","data":[{"object":"bucket","start_time":$start,"end_time":${start + 86400},"results":[
          {"object":"organization.costs.result","amount":{"value":$value,"currency":"$currency"},"line_item":"gpt-5.6-luna, input","project_id":"proj_govbiz"}
        ]}],"has_more":${next != null},"next_page":${next?.let { "\"$it\"" } ?: "null"}}
    """.trimIndent()
}
