import json
import logging
import time

import requests
from langchain_core.prompts import ChatPromptTemplate

from ...models.gemini import flash
from ..state import RetraceState, UrlAgentOutput, UrlSource

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 5
REQUEST_DELAY_SECONDS = 1
MAX_CONTENT_WORDS = 3000


def _is_url_capture(capture) -> bool:
    return (capture.effective_type or capture.type) == "url"


def _capture_url(capture) -> str:
    return capture.source_url or capture.content


def _truncate_text(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words])


def _jina_reader_url(url: str) -> str:
    return f"https://r.jina.ai/{url}"


def fetch_with_jina(url: str) -> str:
    response = requests.get(_jina_reader_url(url), timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.text


def fetch_with_web_base_loader(url: str) -> str:
    from langchain_community.document_loaders import WebBaseLoader

    docs = WebBaseLoader(web_paths=(url,)).load()
    return "\n\n".join(doc.page_content for doc in docs)


def fetch_url_content(url: str) -> str:
    try:
        return fetch_with_jina(url)
    except Exception:
        return fetch_with_web_base_loader(url)


def _fallback_source(capture, note: str) -> UrlSource:
    url = _capture_url(capture)
    return UrlSource(
        url=url,
        title=capture.source_title or url,
        summary=note,
        main_argument="",
        source_type="other",
        key_facts=[],
    )


def analyze_url_capture(capture) -> UrlSource:
    url = _capture_url(capture)
    try:
        content = _truncate_text(fetch_url_content(url), MAX_CONTENT_WORDS)
    except Exception:
        content = ""

    if not content:
        return _fallback_source(capture, "Content could not be fetched.")

    prompt = ChatPromptTemplate.from_template(
        """You are the URL source extraction specialist for Retrace.

Summarize this fetched public web source for a research checkpoint.

URL: {url}
Title: {title}

Fetched content:
{content}
"""
    )
    chain = prompt | flash.with_structured_output(UrlSource)
    output = chain.invoke(
        {
            "url": url,
            "title": capture.source_title or url,
            "content": content,
        }
    )
    return output if isinstance(output, UrlSource) else UrlSource.model_validate(output)


def url_agent(state: RetraceState) -> dict:
    started_at = time.time()
    captures = [capture for capture in state.captures if _is_url_capture(capture)]
    sources: list[UrlSource] = []
    errors: list[str] = []

    for index, capture in enumerate(captures):
        try:
            sources.append(analyze_url_capture(capture))
        except Exception as error:
            message = f"url_agent failed for {_capture_url(capture)}: {error}"
            errors.append(message)
            logger.exception(message)
            sources.append(_fallback_source(capture, "Content could not be fetched."))

        if index < len(captures) - 1 and REQUEST_DELAY_SECONDS > 0:
            time.sleep(REQUEST_DELAY_SECONDS)

    duration_ms = round((time.time() - started_at) * 1000, 2)
    logger.info(
        json.dumps(
            {
                "node": "url_agent",
                "checkpoint_id": state.checkpoint_id,
                "capture_count": len(captures),
                "duration_ms": duration_ms,
            }
        )
    )

    result: dict = {"url_output": UrlAgentOutput(sources=sources)}
    if errors:
        result["errors"] = errors
    return result
