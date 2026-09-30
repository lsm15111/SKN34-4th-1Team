"""Preview rendering: LibreOffice is replaced by a small script so no office suite is needed here."""
import asyncio
import base64
import hashlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.application_preparation.document_contract import DocumentError
from app.application_preparation import document_render

FAKE_SOFFICE = '''
import pathlib, sys, time
args = sys.argv[1:]
mode = pathlib.Path(args[args.index("--outdir") + 1]).parent.name if "--outdir" in args else ""
source = pathlib.Path(args[-1])
if source.read_bytes().startswith(b"SLOW"):
    time.sleep(5)
if source.read_bytes().startswith(b"BROKEN"):
    sys.exit(3)
out = pathlib.Path(args[args.index("--outdir") + 1]) / "source.pdf"
profile = [a for a in args if a.startswith("-env:UserInstallation=")]
assert profile and profile[0].endswith("/profile"), profile
out.write_bytes(b"%PDF-1.4 fake " + source.suffix.encode())
'''


@pytest.fixture
def fake_soffice(tmp_path, monkeypatch):
    script = tmp_path / "fake_soffice.py"
    script.write_text(FAKE_SOFFICE, encoding="utf-8")
    monkeypatch.setenv("DOCUMENT_RENDER_COMMAND", sys.executable)
    monkeypatch.setenv("DOCUMENT_RENDER_ARGS", json.dumps([str(script)]))
    monkeypatch.setenv("DOCUMENT_RENDER_TIMEOUT_SECONDS", "2")
    return script


def test_renders_each_native_format_in_a_throwaway_profile(fake_soffice):
    for fmt in ("hwp", "hwpx", "docx", "xlsx"):
        output = asyncio.run(document_render.render_pdf(b"native-bytes", fmt))
        assert output == b"%PDF-1.4 fake ." + fmt.encode()


def test_names_missing_tool_failure_and_timeout(fake_soffice, monkeypatch):
    with pytest.raises(DocumentError) as failed:
        asyncio.run(document_render.render_pdf(b"BROKEN", "hwp"))
    assert (failed.value.code, failed.value.reason) == ("APPLICATION_DOCUMENT_RENDER_FAILED", "exit-3")
    with pytest.raises(DocumentError) as slow:
        asyncio.run(document_render.render_pdf(b"SLOW", "hwp"))
    assert slow.value.code == "APPLICATION_DOCUMENT_RENDER_TIMEOUT"
    monkeypatch.setenv("DOCUMENT_RENDER_COMMAND", "definitely-not-installed-soffice")
    with pytest.raises(DocumentError) as missing:
        asyncio.run(document_render.render_pdf(b"x", "hwp"))
    assert missing.value.code == "APPLICATION_DOCUMENT_RENDER_UNAVAILABLE"


def test_render_endpoint_checks_token_hash_and_returns_pdf(fake_soffice, monkeypatch):
    from app.application_preparation.router import router, get_service
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_service] = lambda: SimpleNamespace(agent=None)
    monkeypatch.setenv("DOCUMENT_INTERNAL_TOKEN", "t" * 32)
    source = b"generated hwpx draft"
    payload = {"sourceBase64": base64.b64encode(source).decode("ascii"), "sourceSha256": hashlib.sha256(source).hexdigest(), "format": "hwpx"}
    headers = {"Authorization": "Bearer " + "t" * 32}
    with TestClient(app) as client:
        assert client.post("/internal/v1/application-preparations/document/render", json=payload).status_code == 401
        wrong = client.post("/internal/v1/application-preparations/document/render", json={**payload, "sourceSha256": "0" * 64}, headers=headers)
        assert (wrong.status_code, wrong.json()["detail"]["code"]) == (422, "APPLICATION_DOCUMENT_VALIDATION_FAILED")
        pdf_input = client.post("/internal/v1/application-preparations/document/render", json={**payload, "format": "pdf"}, headers=headers)
        assert pdf_input.status_code == 422
        response = client.post("/internal/v1/application-preparations/document/render", json=payload, headers=headers)
        assert response.status_code == 200, response.text
        body = response.json()
        output = base64.b64decode(body["outputBase64"])
        assert output == b"%PDF-1.4 fake .hwpx"
        assert body == {"contractVersion": "application-document-mcp-v1", "sourceSha256": payload["sourceSha256"], "format": "pdf",
                        "outputBase64": body["outputBase64"], "outputSha256": hashlib.sha256(output).hexdigest()}
        broken = client.post("/internal/v1/application-preparations/document/render", headers=headers,
                             json={**payload, "sourceBase64": base64.b64encode(b"BROKEN").decode("ascii"), "sourceSha256": hashlib.sha256(b"BROKEN").hexdigest()})
        assert (broken.status_code, broken.json()["detail"]["code"]) == (503, "APPLICATION_DOCUMENT_RENDER_FAILED")


def test_image_installs_pinned_hangul_filters_for_preview():
    dockerfile = (Path(__file__).resolve().parents[2] / "Dockerfile").read_text(encoding="utf-8")
    runtime = dockerfile.split("FROM python:3.12-slim-bookworm AS runtime", 1)[1]
    assert "libreoffice-writer libreoffice-calc libreoffice-java-common default-jre-headless fonts-nanum" in runtime
    assert "H2Orestart/releases/download/v0.7.14/H2Orestart.oxt" in runtime
    assert "--checksum=sha256:cbea23bc37861361bbc534bc0675e5bc67b36f712072490f82a9bf410d7c04d8" in runtime
    assert "unopkg add --shared /opt/document-tools/H2Orestart.oxt" in runtime
    assert "DOCUMENT_RENDER_COMMAND=/usr/bin/soffice" in runtime
