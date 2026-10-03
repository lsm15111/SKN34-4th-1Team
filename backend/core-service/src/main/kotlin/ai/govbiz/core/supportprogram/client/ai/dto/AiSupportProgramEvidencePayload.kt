package ai.govbiz.core.supportprogram.client.ai.dto

data class AiSupportProgramEvidenceIndexPayload(val indexedCount: Int?)

data class AiSupportProgramEvidenceSearchPayload(
    val question: String?,
    val matches: List<AiSupportProgramEvidenceMatchPayload?>?,
)

data class AiSupportProgramEvidenceMatchPayload(
    val id: String?,
    val contentHash: String?,
    val documentId: String?,
    val order: Int?,
    val score: Double?,
)

/** `citationQuotes[i]`는 `citationChunkIds[i]` 청크 원문에 그대로 들어 있는 짧은 인용입니다. */
data class AiSupportProgramEvidenceAnswerPayload(
    val answer: String?,
    val answerStatus: String?,
    val citationChunkIds: List<String?>?,
    val citationQuotes: List<String?>?,
)
