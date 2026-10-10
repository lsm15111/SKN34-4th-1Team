import json
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from tests.langchain_stub import ResponsesChatStub, response_message

from app.gov_agent.agent import INSTRUCTIONS, GovAgentSupervisor
from app.gov_agent.models import GovAgentRequest
from app.gov_agent.router import get_supervisor, router


@pytest.mark.anyio
@pytest.mark.parametrize("action,message,has_selected_program", [
    ("SEARCH", "창업 지원사업 찾아줘", False),
    ("EVIDENCE", "이 공고 제출서류 뭐야?", True),
    ("APPLICATION", "이 공고 신청서 작성해 줘", True),
    ("APPLICATION", "신청서 양식 분석해 줘", False),
    ("UNSUPPORTED", "외부 기관에 신청서 제출해 줘", True),
])
async def test_one_bounded_decision_without_executing_tools(action, message, has_selected_program):
    model = ResponsesChatStub([[response_message(json.dumps({"action": action}))]])
    supervisor = GovAgentSupervisor(model=model.model, timeout_seconds=3)
    request = GovAgentRequest(message=message, hasSelectedProgram=has_selected_program)
    assert (await supervisor.decide(request)).action == action
    call = model.first_call
    assert call.body["store"] is False
    assert call.body["max_output_tokens"] == 1_200
    assert call.timeout == 3
    assert len(model.calls) == 1
    assert json.loads(call.input[0]["content"])["hasSelectedProgram"] is has_selected_program
    assert call.schema["properties"]["action"]["enum"] == ["SEARCH", "EVIDENCE", "APPLICATION", "UNSUPPORTED"]
    assert not call.body.get("tools")
    model.assert_complete()


@pytest.mark.anyio
@pytest.mark.parametrize("reasoning_effort", ["low", "minimal", "none"])
async def test_model_reasoning_survives_binding_with_bounded_output_and_timeout(reasoning_effort):
    model = ResponsesChatStub([[response_message('{"action":"SEARCH"}')]])
    model.model.reasoning = {"effort": reasoning_effort}
    supervisor = GovAgentSupervisor(model=model.model, timeout_seconds=25)
    assert (await supervisor.decide(GovAgentRequest(message="사업 검색", hasSelectedProgram=False))).action == "SEARCH"
    assert model.first_call.body["reasoning"] == {"effort": reasoning_effort}
    assert model.first_call.body["max_output_tokens"] == 1_200
    assert model.first_call.timeout == 20
    assert len(model.calls) == 1
    model.assert_complete()


@pytest.mark.anyio
@pytest.mark.parametrize("search_query,pending_question", [
    (None, None),
    ("창업 지원", "검색할 지역을 알려 주세요."),
])
async def test_current_application_request_preserves_optional_search_context_in_data(search_query, pending_question):
    # 스텁은 전달 경계만 검증한다. 실제 모델의 의도 분류 정확도를 측정하는 테스트가 아니다.
    model = ResponsesChatStub([[response_message('{"action":"APPLICATION"}')]])
    request = GovAgentRequest(
        message="신청서 작성을 준비하고 싶어요", hasSelectedProgram=False,
        searchQuery=search_query, pendingSearchQuestion=pending_question,
    )
    assert (await GovAgentSupervisor(model=model.model, timeout_seconds=3).decide(request)).action == "APPLICATION"
    assert json.loads(model.first_call.input[0]["content"]) == {
        "message": "신청서 작성을 준비하고 싶어요", "hasSelectedProgram": False,
        "searchQuery": search_query, "pendingSearchQuestion": pending_question,
    }
    assert model.first_call.system_instructions == INSTRUCTIONS
    assert len(model.calls) == 1
    model.assert_complete()


@pytest.mark.anyio
async def test_search_about_application_training_is_not_overridden_by_keyword_routing():
    model = ResponsesChatStub([[response_message('{"action":"SEARCH"}')]])
    request = GovAgentRequest(message="신청서 작성 교육을 지원하는 사업 찾아줘", hasSelectedProgram=True)
    assert (await GovAgentSupervisor(model=model.model, timeout_seconds=3).decide(request)).action == "SEARCH"
    assert len(model.calls) == 1
    model.assert_complete()


@pytest.mark.anyio
async def test_unknown_action_is_rejected_instead_of_falling_back_to_search():
    model = ResponsesChatStub([[response_message('{"action":"SHELL"}')]])
    with pytest.raises(ValueError):
        await GovAgentSupervisor(model=model.model, timeout_seconds=3).decide(
            GovAgentRequest(message="서버 초기화", hasSelectedProgram=False),
        )


@pytest.mark.parametrize("error,status", [(TimeoutError(), 504), (ValueError("private upstream text"), 503)])
def test_failure_is_explicit_without_exposing_upstream_text(error, status):
    app = FastAPI()
    app.include_router(router)
    supervisor = AsyncMock(spec=GovAgentSupervisor)
    supervisor.decide.side_effect = error
    app.dependency_overrides[get_supervisor] = lambda: supervisor
    with TestClient(app) as client:
        response = client.post("/internal/v1/gov-agent/decide", json={"message": "사업 검색", "hasSelectedProgram": False})
    assert response.status_code == status
    assert "private upstream text" not in response.text


def test_extra_authority_or_tool_fields_are_rejected():
    with pytest.raises(ValidationError):
        GovAgentRequest(message="사업 검색", hasSelectedProgram=False, role="ADMIN", toolUrl="http://invalid")
