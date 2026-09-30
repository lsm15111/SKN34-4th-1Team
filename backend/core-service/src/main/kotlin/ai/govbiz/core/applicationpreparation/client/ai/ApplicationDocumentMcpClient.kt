package ai.govbiz.core.applicationpreparation.client.ai

import ai.govbiz.core.applicationpreparation.client.ai.dto.*
import ai.govbiz.core.applicationpreparation.client.ai.exception.ApplicationDocumentMcpException
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import tools.jackson.databind.ObjectMapper

@Component
class ApplicationDocumentMcpClient(
    @param:Qualifier("aiApplicationFormDiscoveryRestClient") private val client: RestClient,
    @param:Value("\${DOCUMENT_INTERNAL_TOKEN:}") private val token: String,
    private val json: ObjectMapper,
) {
    fun configuration(): AiDocumentConfigurationPayload = call {
        client.get().uri("/internal/v1/application-preparations/document/configuration").retrieve()
            .body(AiDocumentConfigurationPayload::class.java)!!.also {
                require(it.contractVersion == "application-document-mcp-v1" && Regex("[a-f0-9]{64}").matches(it.pipelineVersion))
            }
    }

    fun generate(request: AiDocumentGenerationRequest): AiDocumentGenerationPayload = call {
        post("/internal/v1/application-preparations/document/generate", request).body(AiDocumentGenerationPayload::class.java)!!
    }

    fun map(request: AiDocumentMappingRequest): AiDocumentMappingPayload = call {
        post("/internal/v1/application-preparations/document/map", request).body(AiDocumentMappingPayload::class.java)!!
    }

    /** 미리보기용 PDF 변환. 파일을 바꾸지 않으므로 실패는 결과 불명이 아니라 그대로 미리보기 실패다. */
    fun render(request: AiDocumentRenderRequest): AiDocumentRenderPayload = try {
        post("/internal/v1/application-preparations/document/render", request).body(AiDocumentRenderPayload::class.java)!!
    } catch (error: ApplicationDocumentMcpException) { throw error }
    catch (error: Exception) {
        throw ApplicationDocumentMcpException("APPLICATION_DOCUMENT_RENDER_FAILED", "미리보기를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.", error)
    }

    private fun post(path: String, request: Any): RestClient.ResponseSpec {
        if (token.length < 32) throw ApplicationDocumentMcpException("APPLICATION_DOCUMENT_MCP_NOT_READY", "문서 편집 실행 환경이 준비되지 않았습니다.")
        return client.post().uri(path).header("Authorization", "Bearer $token").contentType(MediaType.APPLICATION_JSON).body(request).retrieve()
            .onStatus({ it.value() != 200 }, { _, response ->
                val code = runCatching { json.readTree(response.body.readNBytes(8192)).path("detail").path("code").asString() }.getOrNull()
                val allowed = setOf("INPUT_REQUIRED", "UNSUPPORTED", "MAPPING_FAILED", "FORM_REANALYSIS_REQUIRED", "UNMAPPED_INPUT", "SOURCE_CHANGED", "MCP_NOT_READY", "MCP_FAILED", "PLAN_FAILED", "PLAN_TIMEOUT", "RUN_CONFLICT", "VALIDATION_FAILED", "OVERFLOW", "OUTCOME_UNKNOWN", "LIMIT_EXCEEDED", "RENDER_UNAVAILABLE", "RENDER_FAILED", "RENDER_TIMEOUT").map { "APPLICATION_DOCUMENT_$it" }
                throw ApplicationDocumentMcpException(code?.takeIf { it in allowed } ?: "APPLICATION_DOCUMENT_MCP_FAILED", "문서 편집을 완료하지 못했습니다. 오류 상태를 확인해 주세요.")
            })
    }

    private fun <T> call(block: () -> T): T = try { block() }
    catch (error: ApplicationDocumentMcpException) { throw error }
    catch (error: Exception) {
        throw ApplicationDocumentMcpException("APPLICATION_DOCUMENT_OUTCOME_UNKNOWN", "문서 작업 결과를 확인하지 못했습니다. 관리자 확인 후 다시 시도해 주세요.", error)
    }
}
