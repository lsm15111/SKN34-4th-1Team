package ai.govbiz.core.aiusage.client

import ai.govbiz.core.aiusage.client.dto.OpenAiCostsPagePayload
import ai.govbiz.core.aiusage.client.exception.OpenAiCostsClientException
import ai.govbiz.core.aiusage.client.exception.OpenAiCostsClientException.Reason
import ai.govbiz.core.aiusage.client.mapper.OpenAiCostsMapper
import ai.govbiz.core.aiusage.config.AiCostProperties
import ai.govbiz.core.aiusage.domain.OpenAiCostLine
import java.time.LocalDate
import java.time.ZoneOffset
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestClientResponseException

/**
 * OpenAI 조직 Costs API에서 하루(UTC) 단위 실제 비용을 프로젝트·항목별로 모두 가져옵니다. 관리자 키로만 부를 수 있고,
 * 다음 쪽 커서를 따라 끝까지 읽은 뒤에만 돌려줍니다. 한 쪽이라도 실패하면 아무것도 돌려주지 않습니다.
 */
@Component
class OpenAiCostsClient(
    @param:Qualifier("openAiCostsRestClient") private val client: RestClient,
    private val properties: AiCostProperties,
) {
    fun fetch(from: LocalDate, toExclusive: LocalDate): List<OpenAiCostLine> {
        val lines = mutableListOf<OpenAiCostLine>()
        var cursor: String? = null
        repeat(MAX_PAGES) {
            val page = call(from, toExclusive, cursor)
            lines += OpenAiCostsMapper.toLines(page, from, toExclusive)
            cursor = page.nextPage?.takeIf { it.isNotBlank() } ?: return lines
        }
        throw OpenAiCostsClientException(Reason.INVALID_RESPONSE)
    }

    private fun call(from: LocalDate, toExclusive: LocalDate, cursor: String?): OpenAiCostsPagePayload = try {
        client.get()
            .uri { builder ->
                builder.path("/v1/organization/costs")
                    .queryParam("start_time", from.atStartOfDay().toEpochSecond(ZoneOffset.UTC))
                    .queryParam("end_time", toExclusive.atStartOfDay().toEpochSecond(ZoneOffset.UTC))
                    .queryParam("bucket_width", "1d")
                    .queryParam("group_by", "project_id")
                    .queryParam("group_by", "line_item")
                    .queryParam("limit", PAGE_LIMIT)
                properties.openaiProjectId.takeIf { it.isNotBlank() }?.let { builder.queryParam("project_ids", it) }
                cursor?.let { builder.queryParam("page", it) }
                builder.build()
            }
            .header(HttpHeaders.AUTHORIZATION, "Bearer ${properties.openaiAdminKey}")
            .retrieve()
            .body(OpenAiCostsPagePayload::class.java)
            ?: throw OpenAiCostsClientException(Reason.INVALID_RESPONSE)
    } catch (error: OpenAiCostsClientException) {
        throw error
    } catch (error: RestClientResponseException) {
        val status = error.statusCode.value()
        val reason = if (status == HttpStatus.UNAUTHORIZED.value() || status == HttpStatus.FORBIDDEN.value()) Reason.REJECTED else Reason.UNAVAILABLE
        throw OpenAiCostsClientException(reason)
    } catch (error: RestClientException) {
        val reason = if (error.cause is java.io.IOException) Reason.UNAVAILABLE else Reason.INVALID_RESPONSE
        throw OpenAiCostsClientException(reason)
    }

    private companion object {
        const val PAGE_LIMIT = 180
        const val MAX_PAGES = 20
    }
}
