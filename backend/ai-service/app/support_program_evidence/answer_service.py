from pydantic import ValidationError
from uuid import uuid4

from app.support_program_evidence.agent import SupportProgramEvidenceAnswerAgent
from app.support_program_evidence.errors import SupportProgramEvidenceError
from app.config import LangfuseSettings
from app.tracing import LLMTracing
from app.support_program_evidence.models import (
    SupportProgramEvidenceAnswerRequest,
    SupportProgramEvidenceAnswerResponse,
)


class SupportProgramEvidenceAnswerService:
    """Agent 인용이 요청한 근거 청크 집합과 그 청크의 원문 문자열을 벗어나지 않도록 검증한다."""

    def __init__(self, agent: SupportProgramEvidenceAnswerAgent, tracing: LLMTracing | None = None) -> None:
        self._agent = agent
        self._tracing = tracing or LLMTracing(LangfuseSettings())

    async def answer(
        self,
        request: SupportProgramEvidenceAnswerRequest,
        *,
        trace_id: str | None = None,
        parent_span_id: str | None = None,
    ) -> SupportProgramEvidenceAnswerResponse:
        with self._tracing.observation(
            "evidence.answer", trace_id=trace_id or uuid4().hex, parent_span_id=parent_span_id,
        ) as observation:
            self._tracing.update(observation, metadata={
                "chunk_ids": [chunk.id for chunk in request.chunks], "chunk_count": len(request.chunks),
            })
            answer = await self._answer(request)
            self._tracing.update(observation, metadata={
                "outcome": "completed", "answer_status": answer.answer_status.value,
                "validation_passed": True, "citation_count": len(answer.citation_chunk_ids),
            })
            return answer

    async def _answer(self, request: SupportProgramEvidenceAnswerRequest) -> SupportProgramEvidenceAnswerResponse:
        output = await self._agent.answer(request)
        with self._tracing.observation("evidence.validate_response"):
            try:
                answer = SupportProgramEvidenceAnswerResponse.model_validate(
                    output.model_dump(by_alias=True)
                )
            except ValidationError as error:
                raise SupportProgramEvidenceError() from error
            chunk_texts = {chunk.id: chunk.text for chunk in request.chunks}
            if not set(answer.citation_chunk_ids).issubset(chunk_texts):
                raise SupportProgramEvidenceError()
            # Core에 보내는 인용문은 모두 인용한 청크 text의 부분 문자열이어야 한다.
            if answer.citation_quotes is None or any(
                quote not in chunk_texts[chunk_id]
                for chunk_id, quote in zip(answer.citation_chunk_ids, answer.citation_quotes, strict=True)
            ):
                raise SupportProgramEvidenceError("EVIDENCE_QUOTE_MISMATCH")
            return answer
