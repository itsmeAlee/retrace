import json
import logging
import time
from urllib.parse import parse_qs, urlparse

from langchain_core.prompts import ChatPromptTemplate

from ...models.gemini import flash
from ..state import RetraceState, YoutubeAgentOutput, YoutubeSource

logger = logging.getLogger(__name__)

MAX_TRANSCRIPT_WORDS = 2000
SEGMENT_WINDOW_SECONDS = 120
DEFAULT_TRANSCRIPT_SECONDS = 300


def _is_youtube_capture(capture) -> bool:
    return (capture.effective_type or capture.type) == "youtube"


def _capture_url(capture) -> str:
    return capture.source_url or capture.content


def extract_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if "youtu.be" in host:
        return parsed.path.strip("/") or None
    if "youtube.com" in host:
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
        if parsed.path.startswith("/shorts/") or parsed.path.startswith("/embed/"):
            parts = [part for part in parsed.path.split("/") if part]
            return parts[1] if len(parts) > 1 else None
    return None


def parse_timestamp_to_seconds(timestamp: str | None) -> int | None:
    if not timestamp:
        return None
    try:
        parts = [int(part) for part in timestamp.split(":")]
    except ValueError:
        return None
    if len(parts) == 1:
        return parts[0]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return None


def _snippet_value(snippet, key: str, default=None):
    if isinstance(snippet, dict):
        return snippet.get(key, default)
    return getattr(snippet, key, default)


def fetch_transcript_entries(video_id: str) -> list[dict]:
    from youtube_transcript_api import YouTubeTranscriptApi

    try:
        transcript = YouTubeTranscriptApi().fetch(video_id, languages=["en"])
    except TypeError:
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])

    entries = []
    for snippet in transcript:
        entries.append(
            {
                "text": _snippet_value(snippet, "text", ""),
                "start": float(_snippet_value(snippet, "start", 0)),
                "duration": float(_snippet_value(snippet, "duration", 0)),
            }
        )
    return entries


def select_transcript_segment(entries: list[dict], timestamp: str | None) -> str:
    captured_at = parse_timestamp_to_seconds(timestamp)
    if captured_at is None:
        selected = [entry for entry in entries if entry["start"] <= DEFAULT_TRANSCRIPT_SECONDS]
    else:
        start = max(captured_at - SEGMENT_WINDOW_SECONDS, 0)
        end = captured_at + SEGMENT_WINDOW_SECONDS
        selected = [entry for entry in entries if start <= entry["start"] <= end]
    text = " ".join(entry["text"] for entry in selected)
    words = text.split()
    return " ".join(words[:MAX_TRANSCRIPT_WORDS])


def _fallback_source(capture, note: str) -> YoutubeSource:
    url = _capture_url(capture)
    return YoutubeSource(
        url=url,
        title=capture.source_title or url,
        captured_at_timestamp=capture.timestamp,
        segment_summary=note,
        key_points=[],
        relevance="",
    )


def analyze_youtube_capture(capture) -> YoutubeSource:
    url = _capture_url(capture)
    video_id = extract_video_id(url)
    if not video_id:
        return _fallback_source(capture, "Could not identify the YouTube video ID.")

    try:
        entries = fetch_transcript_entries(video_id)
        segment = select_transcript_segment(entries, capture.timestamp)
    except Exception:
        return _fallback_source(capture, "Transcript unavailable.")

    if not segment:
        return _fallback_source(capture, "Transcript unavailable.")

    prompt = ChatPromptTemplate.from_template(
        """You are the YouTube source extraction specialist for Retrace.

Analyze the transcript segment for this YouTube capture.

URL: {url}
Title: {title}
Captured timestamp: {timestamp}

Transcript segment:
{segment}
"""
    )
    chain = prompt | flash.with_structured_output(YoutubeSource)
    output = chain.invoke(
        {
            "url": url,
            "title": capture.source_title or url,
            "timestamp": capture.timestamp or "No specific timestamp captured",
            "segment": segment,
        }
    )
    return output if isinstance(output, YoutubeSource) else YoutubeSource.model_validate(output)


def video_agent(state: RetraceState) -> dict:
    started_at = time.time()
    captures = [capture for capture in state.captures if _is_youtube_capture(capture)]
    videos: list[YoutubeSource] = []
    errors: list[str] = []

    for capture in captures:
        try:
            videos.append(analyze_youtube_capture(capture))
        except Exception as error:
            message = f"video_agent failed for {_capture_url(capture)}: {error}"
            errors.append(message)
            logger.exception(message)
            videos.append(_fallback_source(capture, "Transcript unavailable."))

    duration_ms = round((time.time() - started_at) * 1000, 2)
    logger.info(
        json.dumps(
            {
                "node": "video_agent",
                "checkpoint_id": state.checkpoint_id,
                "capture_count": len(captures),
                "duration_ms": duration_ms,
            }
        )
    )

    result: dict = {"youtube_output": YoutubeAgentOutput(videos=videos)}
    if errors:
        result["errors"] = errors
    return result
