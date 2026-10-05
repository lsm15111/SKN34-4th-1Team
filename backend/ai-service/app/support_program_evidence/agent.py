import asyncio
import logging
from time import perf_counter

from langchain_openai import ChatOpenAI
from openai import OpenAIError
from app.config import LangfuseSettings
from app.tracing import LLMTracing

from app.support_program_llm import (
    get_support_program_usage_details,
    invoke_support_program_model,
    validate_support_program_output,
)

from app.support_program_evidence.errors import SupportProgramEvidenceError
from app.support_program_evidence.models import (
    MAX_CITATION_QUOTE_LENGTH,
    SupportProgramEvidenceAnswerOutput,
    SupportProgramEvidenceAnswerRequest,
    SupportProgramEvidenceAnswerSelection,
    SupportProgramEvidenceAnswerStatus,
)
from app.support_program_evidence.prompt import (
    SUPPORT_PROGRAM_EVIDENCE_ANSWER_INSTRUCTIONS,
)


logger = logging.getLogger(__name__)

# 원문 청크는 줄을 빈 줄로 잇고 가운뎃점·따옴표를 여러 글자로 쓴다. 모델이 옮기며 바꾸기 쉬운 이 차이만 같다고 본다.
_QUOTE_EQUIVALENTS = str.maketrans({
    "ㆍ": "·", "ᆞ": "·", "・": "·", "˙": "·", "“": '"', "”": '"', "‘": "'", "’": "'", "∼": "~", "〜": "~",
})


def locate_quote(quote: str, text: str) -> str | None:
    """인용을 청크 text에서 찾아 원문 그대로의 구간을 돌려준다.

    공백과 같은 모양의 문장부호 차이만 허용하고 그 밖의 글자는 순서까지 모두 같아야 한다. 화면에는 모델이 쓴 문자열이
    아니라 찾은 원문 구간을 보이므로 인용은 항상 원문의 부분 문자열이다. 찾지 못하거나 원문 구간이 상한을 넘으면 None이다.
    """
    if quote in text:
        return quote
    positions = [index for index, char in enumerate(text) if not char.isspace()]
    compact_text = "".join(text[index] for index in positions).translate(_QUOTE_EQUIVALENTS)
    compact_quote = "".join(char for char in quote if not char.isspace()).translate(_QUOTE_EQUIVALENTS)
    start = compact_text.find(compact_quote) if compact_quote else -1
    if start < 0:
        return None
    original = text[positions[start]:positions[start + len(compact_quote) - 1] + 1]
    return original if len(original) <= MAX_CITATION_QUOTE_LENGTH else None


class SupportProgramEvidenceAnswerAgent:
    """한 번의 structured LLM 호출로 상세 공고 근거 답변을 생성한다."""

    def __init__(
        self,
        *,
        model: ChatOpenAI,
        model_timeout_seconds: float,
        run_timeout_seconds: float,
        tracing: LLMTracing | None = None,
    ) -> None:
        self._run_timeout_seconds = run_timeout_seconds
        self._model_timeout_seconds = model_timeout_seconds
        self._tracing = tracing or LLMTracing(LangfuseSettings())
        self._model_name = model.model_name
        self._model = model.bind(
            max_tokens=2_000, store=False,
            reasoning={"effort": "none"},
            timeout=model_timeout_seconds,
        )

    async def answer(
        self,
        request: SupportProgramEvidenceAnswerRequest,
    ) -> SupportProgramEvidenceAnswerOutput:
        started_at = perf_counter()
        model_finished_at = None
        usage = None
        unverified_quotes = None
        outcome = "failed"
        payload = {
            "question": request.question,
            "chunks": [
                {"index": index, **chunk.model_dump(by_alias=True, exclude={"id"})}
                for index, chunk in enumerate(request.chunks)
            ],
        }
        try:
            async with asyncio.timeout(self._run_timeout_seconds):
                with self._tracing.observation(
                    "evidence.model", as_type="generation", model=self._model_name,
                    metadata={"usage_reported": False},
                    model_parameters={"max_tokens": 2_000, "reasoning_effort": "none", "max_retries": 0},
                ) as generation:
                    result = await invoke_support_program_model(
                        self._model, instructions=SUPPORT_PROGRAM_EVIDENCE_ANSWER_INSTRUCTIONS, payload=payload,
                        output_type=SupportProgramEvidenceAnswerSelection, timeout_seconds=self._model_timeout_seconds,
                    )
                    self._tracing.update(generation, usage_details={
                        key: value for key, value in (
                            ("input", (result.usage_metadata or {}).get("input_tokens")),
                            ("output", (result.usage_metadata or {}).get("output_tokens")),
                        ) if value is not None
                    }, metadata={"usage_reported": result.usage_metadata is not None})
            model_finished_at = perf_counter()
            usage = result.usage_metadata
            with self._tracing.observation("evidence.validate_selection"):
                selection = validate_support_program_output(result, SupportProgramEvidenceAnswerSelection)
                if any(citation.chunk_index >= len(request.chunks) for citation in selection.citations):
                    raise SupportProgramEvidenceError()
                # 고른 청크 text에서 찾지 못한 인용은 그 인용만 버린다. 근거 답변에 남는 인용이 없으면 실패다.
                verified = []
                for citation in selection.citations:
                    chunk = request.chunks[citation.chunk_index]
                    located = locate_quote(citation.quote, chunk.text)
                    if located is not None:
                        verified.append((chunk.id, located))
                unverified_quotes = len(selection.citations) - len(verified)
                if selection.answer_status is SupportProgramEvidenceAnswerStatus.ANSWERED and not verified:
                    raise SupportProgramEvidenceError("EVIDENCE_QUOTE_MISMATCH")
                answer = SupportProgramEvidenceAnswerOutput(
                    answer=selection.answer,
                    answerStatus=selection.answer_status,
                    citationChunkIds=[chunk_id for chunk_id, _ in verified],
                    citationQuotes=[quote for _, quote in verified],
                )
            outcome = "completed"
            return answer
        except (OpenAIError, ValueError, TimeoutError) as error:
            raise SupportProgramEvidenceError() from error
        except asyncio.CancelledError:
            outcome = "cancelled"
            raise
        finally:
            finished_at = perf_counter()
            usage_reported = usage is not None
            cached_input_tokens, reasoning_tokens = get_support_program_usage_details(usage)
            logger.info(
                "support_program_evidence_answer_run outcome=%s model_ms=%d validation_ms=%d elapsed_ms=%d "
                "usage_reported=%s input_tokens=%s output_tokens=%s cached_input_tokens=%s reasoning_tokens=%s "
                "unverified_quotes=%s",
                outcome, round(((model_finished_at or finished_at) - started_at) * 1000),
                round((finished_at - model_finished_at) * 1000) if model_finished_at is not None else 0,
                round((finished_at - started_at) * 1000), usage_reported,
                usage.get("input_tokens") if usage_reported else None,
                usage.get("output_tokens") if usage_reported else None,
                cached_input_tokens,
                reasoning_tokens,
                unverified_quotes,
            )
