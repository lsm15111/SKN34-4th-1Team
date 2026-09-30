"""Convert a generated native document (HWP·HWPX·DOCX·XLSX) to PDF for the browser preview.

The conversion runs LibreOffice headless with the pinned H2Orestart extension in a fresh, throw-away profile.
It never edits the file and never calls a model; the output is only used to show the draft on screen.
"""
import asyncio
import json
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.application_preparation.document_contract import CONTRACT, DocumentError

logger = logging.getLogger(__name__)

RENDER_OUTPUT_LIMIT = 32 * 1024 * 1024


class RenderDocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contractVersion: Literal["application-document-mcp-v1"] = CONTRACT
    sourceBase64: str = Field(min_length=1, max_length=44_739_244)
    sourceSha256: str = Field(pattern="^[a-f0-9]{64}$")
    format: Literal["hwp", "hwpx", "docx", "xlsx"]


def render_command() -> list[str] | None:
    """`DOCUMENT_RENDER_COMMAND` (default `soffice`) plus optional JSON-list `DOCUMENT_RENDER_ARGS`, or None when absent."""
    executable = shutil.which(os.getenv("DOCUMENT_RENDER_COMMAND", "soffice"))
    if executable is None:
        return None
    return [executable, *json.loads(os.getenv("DOCUMENT_RENDER_ARGS", "[]"))]


# One conversion at a time by default: LibreOffice needs a few hundred MB per process.
_semaphore = asyncio.Semaphore(max(1, int(os.getenv("DOCUMENT_RENDER_CONCURRENCY", "1"))))


async def render_pdf(source: bytes, fmt: str) -> bytes:
    command = render_command()
    if command is None:
        raise DocumentError("RENDER_UNAVAILABLE", reason="COMMAND_MISSING")
    timeout = float(os.getenv("DOCUMENT_RENDER_TIMEOUT_SECONDS", "120"))
    async with _semaphore:
        with tempfile.TemporaryDirectory(prefix="govbiz-render-") as directory:
            root = Path(directory).resolve()
            profile = root / "profile"
            profile.mkdir()
            input_path = root / f"source.{fmt}"
            input_path.write_bytes(source)
            args = [*command, "--headless", "--norestore", "--nologo", "--nodefault", "--nolockcheck",
                    f"-env:UserInstallation={profile.as_uri()}", "--convert-to", "pdf", "--outdir", str(root), str(input_path)]
            env = {**os.environ, "HOME": str(root)}
            process = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE, env=env)
            try:
                _, stderr = await asyncio.wait_for(process.communicate(), timeout)
            except TimeoutError:
                process.kill()
                await process.wait()
                logger.warning("application_document_render_timeout format=%s timeout=%s", fmt, timeout)
                raise DocumentError("RENDER_TIMEOUT", reason=f"{int(timeout)}s") from None
            output = root / "source.pdf"
            if process.returncode != 0 or not output.exists():
                logger.warning("application_document_render_failed format=%s exit=%s stderr=%s", fmt, process.returncode,
                               stderr.decode("utf-8", "replace")[:300])
                raise DocumentError("RENDER_FAILED", reason=f"exit-{process.returncode}")
            data = output.read_bytes()
            if not data.startswith(b"%PDF") or len(data) > RENDER_OUTPUT_LIMIT:
                raise DocumentError("RENDER_FAILED", reason="OUTPUT_INVALID")
            return data
