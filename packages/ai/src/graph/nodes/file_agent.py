import base64
import json
import logging
import os
import time
import zipfile
from io import BytesIO
from xml.etree import ElementTree

from langchain_core.documents.base import Blob
from langchain_core.messages import HumanMessage
from langchain_core.prompts import ChatPromptTemplate

from ...models.gemini import flash, flash_vision
from ..state import FileAgentOutput, FileSource, RetraceState

logger = logging.getLogger(__name__)

MAX_FILE_WORDS = 4000
MAX_PDF_PAGES = 20


def _is_file_capture(capture) -> bool:
    return (capture.effective_type or capture.type) in ("file", "image")


def _file_type(capture) -> str:
    mime = (capture.file_mime_type or "").lower()
    name = (capture.file_name or capture.content or "").lower()
    if mime == "application/pdf" or name.endswith(".pdf"):
        return "pdf"
    if mime.startswith("image/"):
        return "image"
    if name.endswith(".docx") or mime.endswith("wordprocessingml.document"):
        return "word"
    if mime.startswith("text/") or name.endswith(".txt") or name.endswith(".md"):
        return "text"
    return "other"


def _truncate_text(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])


def _unsupported_source(capture, summary: str = "File type not supported for AI analysis.") -> FileSource:
    return FileSource(
        file_name=capture.file_name or capture.content or "Untitled file",
        file_type=_file_type(capture),
        content_summary=summary,
        key_findings=[],
        image_description=None,
    )


def _appwrite_storage():
    from appwrite.client import Client
    from appwrite.services.storage import Storage

    endpoint = os.getenv("APPWRITE_ENDPOINT")
    project_id = os.getenv("APPWRITE_PROJECT_ID")
    api_key = os.getenv("APPWRITE_API_KEY")
    bucket_id = os.getenv("APPWRITE_BUCKET_ID") or os.getenv("NEXT_PUBLIC_APPWRITE_BUCKET_ID")

    missing = [
        name
        for name, value in {
            "APPWRITE_ENDPOINT": endpoint,
            "APPWRITE_PROJECT_ID": project_id,
            "APPWRITE_API_KEY": api_key,
            "APPWRITE_BUCKET_ID": bucket_id,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing Appwrite environment variables: {', '.join(missing)}")

    client = Client()
    client.set_endpoint(endpoint)
    client.set_project(project_id)
    client.set_key(api_key)
    return Storage(client), bucket_id


def download_file_bytes(file_id: str) -> bytes:
    storage, bucket_id = _appwrite_storage()
    return storage.get_file_download(bucket_id=bucket_id, file_id=file_id)


def _extract_pdf_text(file_bytes: bytes) -> str:
    from langchain_community.document_loaders.parsers.pdf import PyPDFParser

    parser = PyPDFParser()
    blob = Blob.from_data(file_bytes, mime_type="application/pdf")
    docs = list(parser.lazy_parse(blob))[:MAX_PDF_PAGES]
    return "\n\n".join(doc.page_content for doc in docs)


def _extract_docx_text(file_bytes: bytes) -> str:
    with zipfile.ZipFile(BytesIO(file_bytes)) as archive:
        xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", namespace):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace))
        if text.strip():
            paragraphs.append(text.strip())
    return "\n".join(paragraphs)


def _analyze_text_file(capture, extracted_text: str) -> FileSource:
    if not extracted_text.strip():
        return _unsupported_source(capture, "No readable text could be extracted from this file.")

    prompt = ChatPromptTemplate.from_template(
        """You are the file extraction specialist for Retrace.

Analyze this file's extracted text and return concise structured notes.

File name: {file_name}
File type: {file_type}

Extracted text:
{content}
"""
    )
    chain = prompt | flash.with_structured_output(FileSource)
    output = chain.invoke(
        {
            "file_name": capture.file_name or capture.content or "Untitled file",
            "file_type": _file_type(capture),
            "content": _truncate_text(extracted_text, MAX_FILE_WORDS),
        }
    )
    return output if isinstance(output, FileSource) else FileSource.model_validate(output)


def _analyze_image_file(capture, file_bytes: bytes) -> FileSource:
    mime_type = capture.file_mime_type or "image/png"
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    chain = flash_vision.with_structured_output(FileSource)
    output = chain.invoke(
        [
            HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": (
                            "You are the image extraction specialist for Retrace. "
                            "Describe what this image shows, whether it is a chart, diagram, photo, "
                            "screenshot, or text-heavy image, and what information it contains relevant "
                            "to research. Return file_type='image'."
                        ),
                    },
                    {
                        "type": "image",
                        "base64": encoded,
                        "mime_type": mime_type,
                    },
                ]
            )
        ]
    )
    return output if isinstance(output, FileSource) else FileSource.model_validate(output)


def analyze_file_capture(capture) -> FileSource | None:
    if not capture.file_id:
        return _unsupported_source(capture, "File ID missing; file could not be downloaded.")

    file_type = _file_type(capture)
    if file_type == "other":
        return _unsupported_source(capture)

    file_bytes = download_file_bytes(capture.file_id)
    if file_type == "image":
        return _analyze_image_file(capture, file_bytes)
    if file_type == "pdf":
        return _analyze_text_file(capture, _extract_pdf_text(file_bytes))
    if file_type == "word":
        return _analyze_text_file(capture, _extract_docx_text(file_bytes))
    if file_type == "text":
        return _analyze_text_file(capture, file_bytes.decode("utf-8", errors="replace"))
    return _unsupported_source(capture)


def file_agent(state: RetraceState) -> dict:
    started_at = time.time()
    captures = [capture for capture in state.captures if _is_file_capture(capture)]
    files: list[FileSource] = []
    errors: list[str] = []

    for capture in captures:
        try:
            source = analyze_file_capture(capture)
            if source is not None:
                files.append(source)
        except Exception as error:
            message = f"file_agent failed for {capture.file_id or capture.file_name or capture.id}: {error}"
            errors.append(message)
            logger.exception(message)

    duration_ms = round((time.time() - started_at) * 1000, 2)
    logger.info(
        json.dumps(
            {
                "node": "file_agent",
                "checkpoint_id": state.checkpoint_id,
                "capture_count": len(captures),
                "duration_ms": duration_ms,
            }
        )
    )

    result: dict = {"file_output": FileAgentOutput(files=files)}
    if errors:
        result["errors"] = errors
    return result
