import json
import logging
import time

from langchain_core.prompts import ChatPromptTemplate

from ...models.gemini import flash_lite
from ..state import RetraceState, TextAgentOutput

logger = logging.getLogger(__name__)


EMPTY_TEXT_OUTPUT = TextAgentOutput(
    key_topics=[],
    key_claims=[],
    entities=[],
    user_thinking="",
    raw_summary="",
)


def _is_text_capture(capture) -> bool:
    effective_type = capture.effective_type or ("text" if capture.type == "audio" else capture.type)
    return effective_type == "text"


def _serialize_text_captures(captures) -> str:
    serialized: list[str] = []
    for capture in captures:
        label = "USER VOICE NOTE" if capture.type == "audio" else "TEXT CAPTURE"
        serialized.append(
            "\n".join(
                [
                    f"[{label}]",
                    f"id: {capture.id}",
                    f"created_at: {capture.created_at}",
                    capture.content,
                ]
            )
        )
    return "\n\n---\n\n".join(serialized)


def text_agent(state: RetraceState) -> dict:
    started_at = time.time()
    captures = [capture for capture in state.captures if _is_text_capture(capture)]

    if not captures:
        return {"text_output": EMPTY_TEXT_OUTPUT}

    try:
        prompt = ChatPromptTemplate.from_template(
            """You are the text extraction specialist for Retrace.

Extract concise structured notes from the checkpoint's text captures.

Instructions:
- Extract main topics, key claims, and entities.
- Treat [USER VOICE NOTE] entries as the user's own thinking and reasoning.
- Put the user's own thinking in user_thinking.
- If there are no voice notes, user_thinking should be an empty string.
- Keep every field concise because this feeds a later synthesis step.

Captures:
{captures}
"""
        )
        chain = prompt | flash_lite.with_structured_output(TextAgentOutput)
        output = chain.invoke({"captures": _serialize_text_captures(captures)})
        if not isinstance(output, TextAgentOutput):
            output = TextAgentOutput.model_validate(output)

        duration_ms = round((time.time() - started_at) * 1000, 2)
        logger.info(
            json.dumps(
                {
                    "node": "text_agent",
                    "checkpoint_id": state.checkpoint_id,
                    "capture_count": len(captures),
                    "duration_ms": duration_ms,
                }
            )
        )
        return {"text_output": output}
    except Exception as error:
        duration_ms = round((time.time() - started_at) * 1000, 2)
        message = f"text_agent failed: {error}"
        logger.exception(
            json.dumps(
                {
                    "node": "text_agent",
                    "checkpoint_id": state.checkpoint_id,
                    "capture_count": len(captures),
                    "duration_ms": duration_ms,
                    "error": str(error),
                }
            )
        )
        return {"text_output": EMPTY_TEXT_OUTPUT, "errors": [message]}
