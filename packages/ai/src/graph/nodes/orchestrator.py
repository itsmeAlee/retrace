import json
import logging
import time

from ..state import RetraceState

logger = logging.getLogger(__name__)


def is_youtube_url(url: str | None) -> bool:
    if not url:
        return False
    return "youtube.com" in url or "youtu.be" in url


def _source_url_for_capture(capture) -> str | None:
    return capture.source_url or capture.content


def _routes_from_counts(counts: dict[str, int]) -> list[str]:
    routes: list[str] = []
    if counts.get("text", 0) > 0:
        routes.append("text_agent")
    if counts.get("url", 0) > 0:
        routes.append("url_agent")
    if counts.get("youtube", 0) > 0:
        routes.append("video_agent")
    if counts.get("file", 0) > 0 or counts.get("image", 0) > 0:
        routes.append("file_agent")
    return routes or ["synthesis"]


def orchestrator(state: RetraceState) -> dict:
    started_at = time.time()
    counts: dict[str, int] = {}
    captures = []

    for capture in state.captures:
        effective_type = capture.effective_type or capture.type
        if capture.type == "audio":
            effective_type = "text"
        elif capture.type in ("url", "video"):
            effective_type = "youtube" if is_youtube_url(_source_url_for_capture(capture)) else "url"

        capture = capture.model_copy(update={"effective_type": effective_type})
        captures.append(capture)
        counts[effective_type] = counts.get(effective_type, 0) + 1

    routes = _routes_from_counts(counts)
    total_captures = len(state.captures)
    duration_ms = round((time.time() - started_at) * 1000, 2)

    logger.info(
        json.dumps(
            {
                "node": "orchestrator",
                "checkpoint_id": state.checkpoint_id,
                "total_captures": total_captures,
                "counts": counts,
                "routing_to": routes,
                "duration_ms": duration_ms,
            }
        )
    )

    return {
        "has_text": counts.get("text", 0) > 0,
        "has_urls": counts.get("url", 0) > 0,
        "has_youtube": counts.get("youtube", 0) > 0,
        "has_images": counts.get("image", 0) > 0,
        "has_files": counts.get("file", 0) > 0,
        "capture_count_by_type": counts,
        "total_captures": total_captures,
        "captures": captures,
    }
