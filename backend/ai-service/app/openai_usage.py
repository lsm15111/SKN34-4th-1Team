"""요청마다 OpenAI 호출의 모델·처리 등급·토큰을 모아 Core에 응답 헤더로 돌려준다.

공유 OpenAI HTTP 클라이언트의 응답 훅이 Responses·Chat Completions·Embeddings 응답 본문의 ``usage``를 읽어 지금 요청의 목록에
더하고, ASGI 미들웨어가 응답을 보내기 직전에 (모델, 처리 등급)별 합계를 ``X-GovBiz-OpenAI-Usage`` 헤더(JSON)로 붙인다.
스트리밍 호출은 없어 본문을 미리 읽어도 SDK가 같은 본문을 그대로 쓴다. 비용 계산과 저장은 Core가 맡는다.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable, MutableMapping
from contextvars import ContextVar
from typing import Any

import httpx
from openai import DefaultAsyncHttpxClient

USAGE_HEADER = "x-govbiz-openai-usage"
_USAGE_PATHS = ("/responses", "/chat/completions", "/embeddings")
_calls: ContextVar[list[dict[str, Any]] | None] = ContextVar("openai_usage_calls", default=None)
logger = logging.getLogger(__name__)

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]


def usage_http_client() -> httpx.AsyncClient:
    """OpenAI SDK 기본 설정에 사용량 수집 훅만 더한 HTTP 클라이언트."""
    return DefaultAsyncHttpxClient(event_hooks={"response": [record_openai_usage]})


async def record_openai_usage(response: httpx.Response) -> None:
    """성공한 OpenAI 응답의 사용량을 지금 요청 목록에 더한다. 요청 밖의 호출과 사용량이 없는 응답은 건너뛴다."""
    calls = _calls.get()
    if calls is None or response.status_code != 200 or not response.request.url.path.endswith(_USAGE_PATHS):
        return
    if not response.headers.get("content-type", "").startswith("application/json"):
        return
    await response.aread()
    try:
        call = usage_of(response.json())
    except ValueError:
        call = None
    if call is None:
        logger.warning("openai_usage_missing path=%s", response.request.url.path)
        return
    calls.append(call)


def usage_of(body: Any) -> dict[str, Any] | None:
    """응답 본문에서 모델·처리 등급·입력(캐시 포함)·캐시·출력(추론 포함) 토큰을 꺼낸다."""
    if not isinstance(body, dict) or not isinstance(body.get("usage"), dict) or not isinstance(body.get("model"), str):
        return None
    usage = body["usage"]
    if "input_tokens" in usage:  # Responses
        input_tokens, output_tokens = usage.get("input_tokens"), usage.get("output_tokens", 0)
        cached = (usage.get("input_tokens_details") or {}).get("cached_tokens", 0)
    else:  # Chat Completions, Embeddings
        input_tokens, output_tokens = usage.get("prompt_tokens"), usage.get("completion_tokens", 0)
        cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0)
    values = (input_tokens, cached or 0, output_tokens or 0)
    if not all(isinstance(value, int) and not isinstance(value, bool) and value >= 0 for value in values):
        return None
    tier = body.get("service_tier")
    return {
        "model": body["model"],
        "serviceTier": tier if isinstance(tier, str) and tier else "default",
        "inputTokens": values[0],
        "cachedInputTokens": min(values[1], values[0]),
        "outputTokens": values[2],
    }


def usage_header(calls: list[dict[str, Any]]) -> str:
    """(모델, 처리 등급)별 호출 수와 토큰 합계를 짧은 JSON 배열로 만든다."""
    totals: dict[tuple[str, str], dict[str, Any]] = {}
    for call in calls:
        key = (call["model"], call["serviceTier"])
        total = totals.setdefault(key, {
            "model": key[0], "serviceTier": key[1], "calls": 0, "inputTokens": 0, "cachedInputTokens": 0, "outputTokens": 0,
        })
        total["calls"] += 1
        for name in ("inputTokens", "cachedInputTokens", "outputTokens"):
            total[name] += call[name]
    return json.dumps(list(totals.values()), separators=(",", ":"), ensure_ascii=True)


class OpenAIUsageMiddleware:
    """HTTP 요청마다 사용량 목록을 열고, 응답 머리에 그 요청이 쓴 OpenAI 사용량 헤더를 붙인다."""

    def __init__(self, app: Callable[[Scope, Receive, Send], Awaitable[None]]) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        calls: list[dict[str, Any]] = []
        token = _calls.set(calls)

        async def send_with_usage(message: Message) -> None:
            if message["type"] == "http.response.start" and calls:
                headers = list(message.get("headers", []))
                headers.append((USAGE_HEADER.encode("ascii"), usage_header(calls).encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_usage)
        finally:
            _calls.reset(token)
