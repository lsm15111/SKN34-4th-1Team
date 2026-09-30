package ai.govbiz.core.applicationpreparation.client.ai.dto

/** 생성된 원본 형식 파일을 미리보기용 PDF로 바꾸는 요청. 답변·수정 계획은 싣지 않는다. */
data class AiDocumentRenderRequest(
    val contractVersion: String = "application-document-mcp-v1",
    val sourceBase64: String,
    val sourceSha256: String,
    val format: String,
)

data class AiDocumentRenderPayload(
    val contractVersion: String,
    val sourceSha256: String,
    val format: String,
    val outputBase64: String,
    val outputSha256: String,
)
