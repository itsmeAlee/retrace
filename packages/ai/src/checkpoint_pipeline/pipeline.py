from __future__ import annotations

import asyncio
import base64
import json
import logging
import mimetypes
import os
from concurrent.futures import ThreadPoolExecutor
from contextvars import ContextVar, copy_context
from io import BytesIO
from pathlib import Path
from typing import Any, TypedDict
from urllib.parse import parse_qs, urlparse

import requests
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import END, START, StateGraph
from pypdf import PdfReader
from youtube_transcript_api import YouTubeTranscriptApi

from src.checkpoint_pipeline.mermaid_templates import template_for
from src.models.checkpoint_context import CheckpointContext, DiagramOutput, SourceReference
from src.models.gemini import FLASH_MODEL, flash, flash_vision
from src.utils.mermaid_validator import clean_mermaid, validate_mermaid

logger = logging.getLogger(__name__)
pipeline_event_logger: ContextVar[Any | None] = ContextVar("pipeline_event_logger", default=None)

MAX_EXTERNAL_SECONDS = 5
LONG_CONTENT_THRESHOLD = 15000
CHUNK_SIZE = 5000
CHUNK_OVERLAP = 500


class ProcessedCapture(TypedDict):
    segment: str
    source: SourceReference


class CheckpointPipelineState(TypedDict):
    checkpoint_row_id: str
    checkpoint_name: str
    session_name: str
    note_content: str
    captures: list[dict[str, Any]]
    processed_content: str
    processed_sources: list[SourceReference]
    context: CheckpointContext | None
    error: str | None
    map_reduce_used: bool
    appwrite_endpoint: str
    appwrite_project_id: str
    appwrite_api_key: str
    appwrite_bucket_id: str


def get_capture_value(capture: dict[str, Any], snake_key: str, camel_key: str | None = None) -> Any:
    return capture.get(snake_key) if capture.get(snake_key) is not None else capture.get(camel_key or snake_key)


def source_name(capture: dict[str, Any]) -> str:
    title = capture.get("source_title") or capture.get("sourceTitle") or capture.get("file_name") or capture.get("fileName")
    if title:
        return str(title)
    url = capture.get("source_url") or capture.get("sourceUrl") or capture.get("content")
    if url:
        try:
            return urlparse(str(url)).netloc or str(url)
        except Exception:
            return str(url)
    return "Untitled source"


def domain_from_url(source_url: str | None) -> str | None:
    if not source_url:
        return None
    try:
        return urlparse(source_url).netloc.replace("www.", "") or None
    except Exception:
        return None


def source_reference(capture: dict[str, Any]) -> SourceReference:
    capture_type = str(get_capture_value(capture, "type") or "text").lower()
    content = str(get_capture_value(capture, "content") or "")
    source_url = str(get_capture_value(capture, "source_url", "sourceUrl") or content or "")
    file_id = get_capture_value(capture, "file_id", "fileId")
    source_type = capture_type
    if capture_type == "video":
        source_type = "youtube"
    if source_type not in {"url", "youtube", "image", "pdf", "file", "text", "audio"}:
        source_type = "text"
    return SourceReference(
        title=source_name(capture),
        source_type=source_type,  # type: ignore[arg-type]
        url=source_url if source_type in {"url", "youtube"} else None,
        file_id=str(file_id) if source_type in {"image", "pdf", "file"} and file_id else None,
        domain=domain_from_url(source_url) if source_type in {"url", "youtube"} else None,
    )


def truncate_text(text: str, max_chars: int) -> str:
    clean = " ".join(text.split()) if max_chars < 2500 else text.strip()
    return clean[:max_chars]


def emit_pipeline_log(payload: dict[str, Any]) -> None:
    event_logger = pipeline_event_logger.get()
    if callable(event_logger):
        event_logger(payload)
        return
    logger.info("%s", json.dumps(payload, default=str))


def preview(text: str, max_chars: int = 220) -> str:
    return " ".join(text.split())[:max_chars]


def fetch_jina_reader(source_url: str) -> str:
    response = requests.get(f"https://r.jina.ai/{source_url}", timeout=MAX_EXTERNAL_SECONDS)
    response.raise_for_status()
    return response.text


class TimeoutSession(requests.Session):
    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        kwargs.setdefault("timeout", MAX_EXTERNAL_SECONDS)
        return super().request(method, url, **kwargs)


def parse_timestamp_to_seconds(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return int(text)
    parts = text.split(":")
    try:
        if len(parts) == 3:
            hours, minutes, seconds = [int(float(part)) for part in parts]
            return hours * 3600 + minutes * 60 + seconds
        if len(parts) == 2:
            minutes, seconds = [int(float(part)) for part in parts]
            return minutes * 60 + seconds
    except ValueError:
        return None
    return None


def extract_youtube_id(source_url: str) -> str | None:
    try:
        parsed = urlparse(source_url)
    except Exception:
        return None
    host = parsed.netloc.replace("www.", "")
    if host in {"youtube.com", "m.youtube.com", "music.youtube.com"}:
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
        if parsed.path.startswith("/shorts/") or parsed.path.startswith("/embed/"):
            return parsed.path.strip("/").split("/")[1]
    if host == "youtu.be":
        return parsed.path.strip("/").split("/")[0] or None
    return None


def fetch_youtube_transcript(source_url: str, timestamp: Any = None) -> str:
    video_id = extract_youtube_id(source_url)
    if not video_id:
        return "Transcript unavailable."
    transcript = YouTubeTranscriptApi(http_client=TimeoutSession()).fetch(video_id)
    rows = transcript.to_raw_data()
    target = parse_timestamp_to_seconds(timestamp)
    if target is not None:
        selected = [row for row in rows if target - 120 <= float(row.get("start", 0)) <= target + 120]
    else:
        selected = [row for row in rows if float(row.get("start", 0)) <= 300]
    if not selected:
        selected = rows[:40]
    return " ".join(str(row.get("text", "")) for row in selected)


def download_appwrite_file(endpoint: str, project_id: str, api_key: str, bucket_id: str, file_id: str) -> bytes:
    url = f"{endpoint.rstrip('/')}/storage/buckets/{bucket_id}/files/{file_id}/download"
    response = requests.get(
        url,
        headers={"X-Appwrite-Project": project_id, "X-Appwrite-Key": api_key},
        timeout=MAX_EXTERNAL_SECONDS,
    )
    response.raise_for_status()
    return response.content


def describe_image_with_gemini(image_bytes: bytes, mime_type: str | None) -> str:
    mime = mime_type or "image/jpeg"
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": "Describe this image briefly in 2-3 sentences. Focus on what is relevant to research.",
            },
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}},
        ]
    )
    response = flash_vision.invoke([message])
    return str(getattr(response, "content", response))


def extract_pdf_text(file_bytes: bytes, max_pages: int = 20) -> str:
    reader = PdfReader(BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages[:max_pages]).strip()


def extract_docx_text(file_bytes: bytes) -> str:
    try:
        import docx2txt

        temp_path = Path(os.getenv("TMP", "/tmp")) / "retrace_checkpoint_docx_extract.docx"
        temp_path.write_bytes(file_bytes)
        try:
            return docx2txt.process(str(temp_path)) or ""
        finally:
            temp_path.unlink(missing_ok=True)
    except Exception:
        return ""


def process_capture(capture: dict[str, Any], state: CheckpointPipelineState) -> ProcessedCapture | None:
    capture_type = str(get_capture_value(capture, "type") or "text").lower()
    content = str(get_capture_value(capture, "content") or "")
    title = source_name(capture)
    capture_id = str(get_capture_value(capture, "id") or "unknown")
    source = source_reference(capture)

    if capture_type == "text":
        return {"segment": f"[Text capture - {title}]\n{content}", "source": source} if content.strip() else None

    if capture_type == "audio":
        return {"segment": f"[Voice transcript - {title}]\n{content}", "source": source} if content.strip() else None

    if capture_type == "url":
        source_url = str(get_capture_value(capture, "source_url", "sourceUrl") or content)
        try:
            fetched = truncate_text(fetch_jina_reader(source_url), 1200)
        except Exception as exc:
            emit_pipeline_log({"step": "capture_skipped", "capture_id": capture_id, "capture_type": capture_type, "source": source_url, "reason": f"URL fetch failed: {exc}"})
            return None
        return {"segment": f"[Web source - {title}]\nURL: {source_url}\n{fetched}", "source": source}

    if capture_type in {"video", "youtube"}:
        source_url = str(get_capture_value(capture, "source_url", "sourceUrl") or content)
        try:
            transcript = truncate_text(fetch_youtube_transcript(source_url, get_capture_value(capture, "timestamp")), 1200)
        except Exception as exc:
            emit_pipeline_log({"step": "capture_partial", "capture_id": capture_id, "capture_type": capture_type, "source": source_url, "reason": f"YouTube transcript unavailable: {exc}"})
            transcript = f"Transcript unavailable. Use the video title/context only: {title}."
        return {"segment": f"[YouTube source - {title}]\nURL: {source_url}\n{transcript}", "source": source_reference({**capture, "type": "video"})}

    file_id = get_capture_value(capture, "file_id", "fileId")
    file_name = str(get_capture_value(capture, "file_name", "fileName") or title)
    mime_type = get_capture_value(capture, "file_mime_type", "fileMimeType")
    if capture_type == "image":
        if not file_id:
            emit_pipeline_log({"step": "capture_skipped", "capture_id": capture_id, "capture_type": capture_type, "source": file_name, "reason": "Image file ID missing."})
            return None
        try:
            image_bytes = download_appwrite_file(state["appwrite_endpoint"], state["appwrite_project_id"], state["appwrite_api_key"], state["appwrite_bucket_id"], str(file_id))
            description = describe_image_with_gemini(image_bytes, str(mime_type or "image/jpeg"))
        except Exception as exc:
            emit_pipeline_log({"step": "capture_skipped", "capture_id": capture_id, "capture_type": capture_type, "source": file_name, "reason": f"Image download/description failed: {exc}"})
            return None
        return {"segment": f"[Image source - {file_name}]\nFile ID: {file_id}\n{description}", "source": source}

    if capture_type in {"file", "pdf"}:
        if not file_id:
            emit_pipeline_log({"step": "capture_skipped", "capture_id": capture_id, "capture_type": capture_type, "source": file_name, "reason": "Document file ID missing."})
            return None
        try:
            file_bytes = download_appwrite_file(state["appwrite_endpoint"], state["appwrite_project_id"], state["appwrite_api_key"], state["appwrite_bucket_id"], str(file_id))
            guessed_mime = str(mime_type or mimetypes.guess_type(file_name)[0] or "")
            if "pdf" in guessed_mime or file_name.lower().endswith(".pdf") or capture_type == "pdf":
                extracted = extract_pdf_text(file_bytes)
            elif "word" in guessed_mime or file_name.lower().endswith(".docx"):
                extracted = extract_docx_text(file_bytes)
            else:
                extracted = file_bytes.decode("utf-8", errors="ignore")
                extracted = truncate_text(extracted or "No extractable text found.", 1600)
        except Exception as exc:
            emit_pipeline_log({"step": "capture_skipped", "capture_id": capture_id, "capture_type": capture_type, "source": file_name, "reason": f"Document download/extraction failed: {exc}"})
            return None
        return {"segment": f"[Document source - {file_name}]\nFile ID: {file_id}\n{extracted}", "source": source_reference({**capture, "type": "pdf" if capture_type == "pdf" else "file"})}

    return {"segment": f"[{capture_type} capture - {title}]\n{content}", "source": source} if content.strip() else None


async def process_capture_with_timeout(capture: dict[str, Any], state: CheckpointPipelineState) -> ProcessedCapture | None:
    capture_id = str(get_capture_value(capture, "id") or "unknown")
    capture_type = str(get_capture_value(capture, "type") or "unknown")
    try:
        processed = await asyncio.wait_for(asyncio.to_thread(process_capture, capture, state), timeout=MAX_EXTERNAL_SECONDS + 10)
        emit_pipeline_log({
            "step": "capture_processed",
            "capture_id": capture_id,
            "capture_type": capture_type,
            "source": source_name(capture),
            "included": bool(processed),
            "extracted_chars": len(processed["segment"]) if processed else 0,
            "preview": preview(processed["segment"] if processed else ""),
        })
        return processed
    except Exception as exc:
        emit_pipeline_log({"step": "capture_skipped", "capture_id": capture_id, "capture_type": capture_type, "reason": f"Unexpected processor error: {exc}"})
        return None


async def process_capture_group(name: str, captures: list[dict[str, Any]], state: CheckpointPipelineState) -> list[ProcessedCapture]:
    emit_pipeline_log({"step": "capture_group_start", "group": name, "count": len(captures)})
    results = await asyncio.gather(*(process_capture_with_timeout(capture, state) for capture in captures), return_exceptions=False)
    processed = [item for item in results if item]
    emit_pipeline_log({"step": "capture_group_complete", "group": name, "included_count": len(processed)})
    return processed


async def process_all_captures(state: CheckpointPipelineState) -> list[ProcessedCapture]:
    captures = state.get("captures", [])
    groups = {
        "text_group": [capture for capture in captures if str(get_capture_value(capture, "type") or "text").lower() in {"text", "audio"}],
        "url_group": [capture for capture in captures if str(get_capture_value(capture, "type") or "").lower() == "url"],
        "youtube_group": [capture for capture in captures if str(get_capture_value(capture, "type") or "").lower() in {"video", "youtube"}],
        "file_group": [capture for capture in captures if str(get_capture_value(capture, "type") or "").lower() in {"image", "pdf", "file"}],
    }
    results = await asyncio.gather(*(process_capture_group(name, items, state) for name, items in groups.items()))
    return [item for group in results for item in group]


def run_async(coro: Any) -> Any:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    context = copy_context()
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(lambda: context.run(asyncio.run, coro))
        return future.result()


def content_processor(state: CheckpointPipelineState) -> dict[str, Any]:
    parts: list[str] = []
    sources: list[SourceReference] = []
    note_content = state.get("note_content", "").strip()
    if note_content:
        parts.append(f"[Checkpoint notes]\n{note_content}")

    processed = run_async(process_all_captures(state))
    for item in processed:
        parts.append(item["segment"])
        sources.append(item["source"])

    processed_content = "\n\n---\n\n".join(parts) if parts else "No content captured."
    emit_pipeline_log({"step": "content_assembled", "checkpoint_id": state["checkpoint_row_id"], "content_length": len(processed_content), "section_count": len(parts), "sources_count": len(sources)})
    return {"processed_content": processed_content, "processed_sources": sources}


def split_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    if len(text) <= chunk_size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = max(0, end - overlap)
    return chunks


async def map_chunks(chunks: list[str]) -> list[str]:
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", "Condense this research checkpoint chunk into detailed notes for a later synthesis. Preserve concepts, relationships, source mentions, and concrete details."),
            ("human", "Chunk:\n{chunk}"),
        ]
    )
    chain = prompt | flash | StrOutputParser()
    return await asyncio.gather(*(asyncio.to_thread(chain.invoke, {"chunk": chunk}) for chunk in chunks))


def context_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "You are an intelligent research assistant generating a detailed context card for a research checkpoint. "
                "The user captured various materials during focused study. Your job is to explain the concepts they encountered, "
                "not just list what they captured. Write as if explaining to someone returning to this topic after a few days. "
                "Cover the core ideas, how they connect, what matters, and what the user should take away. Be thorough but not repetitive. "
                "Aim for depth over brevity. Write in second person. No bullet points in the main context field. Plain connected prose only.",
            ),
            (
                "human",
                "Checkpoint name: {checkpoint_name}\nSession name: {session_name}\nCapture count: {capture_count}\n\n"
                "Sources that were successfully processed as JSON:\n{sources_json}\n\n"
                "Processed content:\n{processed_content}\n\n"
                "Generate a CheckpointContext. The context field must be 4-8 paragraphs of connected prose. "
                "The key_points field must contain 5-8 complete insight sentences. "
                "Decide which diagrams should be generated using diagram_decisions, but leave diagrams empty.",
            ),
        ]
    )


def paragraph_count(text: str) -> int:
    return len([part for part in text.split("\n\n") if part.strip()])


def ensure_context_depth(result: CheckpointContext, processed_content: str) -> CheckpointContext:
    if paragraph_count(result.context) >= 4:
        return result
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Expand the checkpoint context into 4-8 paragraphs of second-person connected prose. "
                "Do not use bullet points. Preserve the actual concepts and sources.",
            ),
            (
                "human",
                "Current context:\n{context}\n\nKey points:\n{key_points}\n\nCaptured material:\n{processed_content}\n\nReturn only the expanded context prose.",
            ),
        ]
    )
    chain = prompt | flash | StrOutputParser()
    expanded = chain.invoke(
        {
            "context": result.context,
            "key_points": "\n".join(result.key_points),
            "processed_content": truncate_text(processed_content, 6000),
        }
    )
    cleaned = str(expanded).strip()
    if paragraph_count(cleaned) >= 4:
        result.context = cleaned
    return result


def context_generator(state: CheckpointPipelineState) -> dict[str, Any]:
    try:
        sources_json = json.dumps([source.model_dump() for source in state.get("processed_sources", [])], ensure_ascii=False)
        processed_content = state["processed_content"]
        map_reduce_used = len(processed_content) > LONG_CONTENT_THRESHOLD
        if map_reduce_used:
            chunks = split_text(processed_content)
            emit_pipeline_log({"step": "map_reduce_start", "checkpoint_id": state["checkpoint_row_id"], "chunk_count": len(chunks), "content_length": len(processed_content)})
            chunk_notes = run_async(map_chunks(chunks))
            processed_content = "\n\n--- chunk context ---\n\n".join(chunk_notes)
            emit_pipeline_log({"step": "map_reduce_reduce_start", "checkpoint_id": state["checkpoint_row_id"], "reduced_content_length": len(processed_content)})

        emit_pipeline_log({"step": "gemini_call_start", "checkpoint_id": state["checkpoint_row_id"], "model": FLASH_MODEL, "assembled_content_length": len(processed_content), "map_reduce_used": map_reduce_used})
        chain = context_prompt() | flash.with_structured_output(CheckpointContext)
        result = chain.invoke(
            {
                "checkpoint_name": state["checkpoint_name"],
                "session_name": state["session_name"],
                "processed_content": processed_content,
                "capture_count": len(state.get("captures", [])),
                "sources_json": sources_json,
            }
        )
        result.capture_count = len(state.get("captures", []))
        result.sources_used = state.get("processed_sources", [])
        result = ensure_context_depth(result, processed_content)
        emit_pipeline_log({
            "step": "gemini_structured_output_succeeded",
            "checkpoint_id": state["checkpoint_row_id"],
            "title": result.title,
            "context_len": len(result.context),
            "key_points_count": len(result.key_points),
            "sources_count": len(result.sources_used),
            "diagram_decision_count": sum(len(decision.diagram_concepts) for decision in result.diagram_decisions if decision.should_generate),
            "capture_count": result.capture_count,
            "map_reduce_used": map_reduce_used,
        })
        return {"context": result, "error": None, "map_reduce_used": map_reduce_used}
    except Exception as exc:
        logger.exception("Checkpoint context generation failed")
        emit_pipeline_log({"step": "gemini_structured_output_failed", "checkpoint_id": state["checkpoint_row_id"], "error": str(exc)})
        return {"context": None, "error": str(exc)}


def desired_diagrams(context: CheckpointContext) -> list[tuple[str, str]]:
    diagrams: list[tuple[str, str]] = []
    for decision in context.diagram_decisions:
        if not decision.should_generate:
            continue
        for concept, mermaid_type in zip(decision.diagram_concepts, decision.diagram_types):
            diagrams.append((concept, mermaid_type))
    return diagrams[:2]


async def generate_one_diagram(concept: str, mermaid_type: str, context: CheckpointContext) -> DiagramOutput | None:
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "Generate ONLY valid Mermaid syntax. No markdown fences, no prose. "
                "Use the requested Mermaid type and follow the provided template closely.",
            ),
            (
                "human",
                "Concept to diagram: {concept}\nMermaid type: {mermaid_type}\nSyntax template:\n{template}\n\n"
                "Checkpoint title: {title}\nKey points:\n{key_points}\n\n"
                "Return Mermaid code only. Keep labels short and valid.",
            ),
        ]
    )
    chain = prompt | flash | StrOutputParser()
    previous = ""
    for attempt in range(2):
        try:
            raw = await asyncio.to_thread(
                chain.invoke,
                {
                    "concept": concept,
                    "mermaid_type": mermaid_type,
                    "template": template_for(mermaid_type),
                    "title": context.title,
                    "key_points": "\n".join(context.key_points),
                    "previous": previous,
                },
            )
            cleaned = clean_mermaid(raw)
            valid, message = validate_mermaid(cleaned)
            if valid:
                return DiagramOutput(
                    diagram_type=concept,
                    mermaid_type=mermaid_type,  # type: ignore[arg-type]
                    mermaid_code=cleaned,
                    explanation=f"This diagram shows {concept} in relation to the checkpoint's main ideas.",
                )
            previous = f"Previous output failed validation: {message}\n{raw}"
        except Exception as exc:
            previous = str(exc)
    emit_pipeline_log({"step": "diagram_skipped", "concept": concept, "mermaid_type": mermaid_type, "reason": previous})
    return None


async def generate_diagrams(context: CheckpointContext) -> list[DiagramOutput]:
    jobs = desired_diagrams(context)
    if not jobs:
        return []
    results = await asyncio.gather(*(generate_one_diagram(concept, mermaid_type, context) for concept, mermaid_type in jobs))
    return [diagram for diagram in results if diagram]


def route_after_context(state: CheckpointPipelineState) -> str:
    context = state.get("context")
    return "diagram_generator" if context and desired_diagrams(context) else END


def diagram_generator(state: CheckpointPipelineState) -> dict[str, Any]:
    context = state.get("context")
    if not context:
        return {}
    diagrams = run_async(generate_diagrams(context))
    context.diagrams = diagrams
    emit_pipeline_log({"step": "diagrams_generated", "checkpoint_id": state["checkpoint_row_id"], "diagram_count": len(diagrams), "diagram_types": [diagram.mermaid_type for diagram in diagrams]})
    return {"context": context}


graph = StateGraph(CheckpointPipelineState)
graph.add_node("content_processor", content_processor)
graph.add_node("context_generator", context_generator)
graph.add_node("diagram_generator", diagram_generator)
graph.add_edge(START, "content_processor")
graph.add_edge("content_processor", "context_generator")
graph.add_conditional_edges("context_generator", route_after_context, {"diagram_generator": "diagram_generator", END: END})
graph.add_edge("diagram_generator", END)
checkpoint_graph = graph.compile()


def run_checkpoint_pipeline(
    checkpoint_id: str,
    checkpoint_name: str,
    session_name: str,
    note_content: str,
    captures: list[dict[str, Any]],
    appwrite_endpoint: str,
    appwrite_project_id: str,
    appwrite_api_key: str,
    appwrite_bucket_id: str,
    event_logger: Any | None = None,
) -> CheckpointContext | None:
    token = pipeline_event_logger.set(event_logger)
    try:
        result = checkpoint_graph.invoke(
            {
                "checkpoint_row_id": checkpoint_id,
                "checkpoint_name": checkpoint_name,
                "session_name": session_name,
                "note_content": note_content,
                "captures": captures,
                "processed_content": "",
                "processed_sources": [],
                "context": None,
                "error": None,
                "map_reduce_used": False,
                "appwrite_endpoint": appwrite_endpoint,
                "appwrite_project_id": appwrite_project_id,
                "appwrite_api_key": appwrite_api_key,
                "appwrite_bucket_id": appwrite_bucket_id,
            }
        )
        context = result.get("context")
        if context:
            return context
        error_message = result.get("error") or "Checkpoint pipeline completed without context."
        emit_pipeline_log({"step": "pipeline_failed", "checkpoint_id": checkpoint_id, "error": error_message})
        raise RuntimeError(str(error_message))
    except Exception as exc:
        emit_pipeline_log({"step": "pipeline_exception", "checkpoint_id": checkpoint_id, "error": str(exc)})
        logger.exception("Checkpoint pipeline failed")
        raise
    finally:
        pipeline_event_logger.reset(token)
