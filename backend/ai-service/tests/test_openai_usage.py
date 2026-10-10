import json

import httpx
import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from openai import AsyncOpenAI

from app.openai_usage import USAGE_HEADER, OpenAIUsageMiddleware, record_openai_usage, usage_of

RESPONSE = {
    "id": "resp_1", "object": "response", "created_at": 1, "status": "completed", "model": "gpt-5.6-luna-2026-07-30",
    "service_tier": "priority", "output": [], "parallel_tool_calls": False, "tool_choice": "auto", "tools": [],
    "usage": {
        "input_tokens": 1200, "input_tokens_details": {"cached_tokens": 1000},
        "output_tokens": 80, "output_tokens_details": {"reasoning_tokens": 30}, "total_tokens": 1280,
    },
}
EMBEDDING = {
    "object": "list", "model": "text-embedding-3-small",
    "data": [{"object": "embedding", "index": 0, "embedding": [0.1, 0.2]}],
    "usage": {"prompt_tokens": 42, "total_tokens": 42},
}


def openai_client() -> AsyncOpenAI:
    """실제 SDK가 가짜 OpenAI 서버를 부르게 한다. 응답 훅은 운영과 같은 함수다."""
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=EMBEDDING if request.url.path.endswith("/embeddings") else RESPONSE)
    http_client = httpx.AsyncClient(transport=httpx.MockTransport(handle), event_hooks={"response": [record_openai_usage]})
    return AsyncOpenAI(api_key="test-key", base_url="http://openai.test/v1", http_client=http_client, max_retries=0)


def app_with(client: AsyncOpenAI) -> FastAPI:
    app = FastAPI()
    app.add_middleware(OpenAIUsageMiddleware)

    @app.post("/answer")
    async def answer(request: Request) -> dict[str, int]:
        calls = (await request.json())["calls"]
        for _ in range(calls):
            response = await client.responses.create(model="gpt-5.6-luna", input="질문")
            assert response.usage.input_tokens == 1200  # 훅이 본문을 먼저 읽어도 SDK가 그대로 쓴다.
        embedding = await client.embeddings.create(model="text-embedding-3-small", input="문장")
        assert embedding.data[0].embedding == [0.1, 0.2]
        return {"calls": calls}

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "UP"}

    return app


def test_each_request_reports_the_openai_usage_it_spent_by_model_and_tier() -> None:
    with TestClient(app_with(openai_client())) as http:
        response = http.post("/answer", json={"calls": 2})
        health = http.get("/health")

    assert response.status_code == 200
    assert json.loads(response.headers[USAGE_HEADER]) == [
        {"model": "gpt-5.6-luna-2026-07-30", "serviceTier": "priority", "calls": 2,
         "inputTokens": 2400, "cachedInputTokens": 2000, "outputTokens": 160},
        {"model": "text-embedding-3-small", "serviceTier": "default", "calls": 1,
         "inputTokens": 42, "cachedInputTokens": 0, "outputTokens": 0},
    ]
    # OpenAI를 부르지 않은 요청은 헤더가 없다.
    assert USAGE_HEADER not in health.headers


def test_requests_do_not_share_usage() -> None:
    with TestClient(app_with(openai_client())) as http:
        first = json.loads(http.post("/answer", json={"calls": 1}).headers[USAGE_HEADER])
        second = json.loads(http.post("/answer", json={"calls": 3}).headers[USAGE_HEADER])
    assert [entry["calls"] for entry in first] == [1, 1]
    assert [entry["calls"] for entry in second] == [3, 1]


@pytest.mark.anyio
async def test_calls_outside_a_request_are_not_collected() -> None:
    client = openai_client()
    try:
        response = await client.responses.create(model="gpt-5.6-luna", input="질문")
    finally:
        await client.close()
    assert response.usage.output_tokens == 80


@pytest.mark.parametrize("body", [
    {"model": "gpt-5.6-luna"},
    {"usage": {"input_tokens": 1}},
    {"model": "gpt-5.6-luna", "usage": {"input_tokens": -1, "output_tokens": 1}},
    {"model": "gpt-5.6-luna", "usage": {"input_tokens": "10", "output_tokens": 1}},
    {"model": "gpt-5.6-luna", "usage": {"input_tokens": True, "output_tokens": 1}},
    [],
])
def test_malformed_usage_is_unknown_rather_than_zero(body: object) -> None:
    assert usage_of(body) is None


def test_chat_completions_usage_is_read_too() -> None:
    assert usage_of({
        "model": "gpt-5-nano", "usage": {"prompt_tokens": 50, "completion_tokens": 7, "prompt_tokens_details": {"cached_tokens": 60}},
    }) == {"model": "gpt-5-nano", "serviceTier": "default", "inputTokens": 50, "cachedInputTokens": 50, "outputTokens": 7}
