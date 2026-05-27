import json
import logging
import time

from langchain_core.prompts import ChatPromptTemplate

from ...models.gemini import flash
from ..state import RetraceState, SynthesisOutput

logger = logging.getLogger(__name__)


EMPTY_SYNTHESIS_OUTPUT = SynthesisOutput(
    central_question="No content was captured in this checkpoint yet.",
    established=[],
    tensions=[],
    gaps=[],
    user_thinking="",
    key_sources=[],
    diagram_warranted=False,
    diagram_type=None,
    diagram_elements=None,
)

FAILED_SYNTHESIS_OUTPUT = SynthesisOutput(
    central_question="Synthesis failed.",
    established=[],
    tensions=[],
    gaps=[],
    user_thinking="",
    key_sources=[],
    diagram_warranted=False,
    diagram_type=None,
    diagram_elements=None,
)


def _join_list(values: list[str]) -> str:
    return ", ".join(values) if values else "None"


def build_synthesis_context(state: RetraceState) -> str:
    context_parts: list[str] = []

    if state.text_output is not None:
        context_parts.append(
            f"""=== TEXT AND NOTES ===
Topics: {_join_list(state.text_output.key_topics)}
Key claims: {_join_list(state.text_output.key_claims)}
Entities: {_join_list(state.text_output.entities)}
User's own thinking: {state.text_output.user_thinking or "None"}
Summary: {state.text_output.raw_summary or "None"}"""
        )

    if state.url_output is not None:
        for source in state.url_output.sources:
            context_parts.append(
                f"""=== WEB SOURCE: {source.title} ===
URL: {source.url}
Type: {source.source_type}
Summary: {source.summary}
Main argument: {source.main_argument}
Key facts: {_join_list(source.key_facts)}"""
            )

    if state.youtube_output is not None:
        for video in state.youtube_output.videos:
            context_parts.append(
                f"""=== YOUTUBE VIDEO: {video.title} ===
Captured at: {video.captured_at_timestamp or "No specific timestamp"}
What was discussed: {video.segment_summary}
Key points: {_join_list(video.key_points)}
Relevance: {video.relevance}"""
            )

    if state.file_output is not None:
        for file in state.file_output.files:
            image_desc_section = (
                f"Image description: {file.image_description}" if file.image_description else "Image description: None"
            )
            context_parts.append(
                f"""=== FILE: {file.file_name} ({file.file_type}) ===
Summary: {file.content_summary}
Key findings: {_join_list(file.key_findings)}
{image_desc_section}"""
            )

    if not context_parts:
        return "No content was captured in this checkpoint yet."

    return "\n\n".join(context_parts)


def synthesis(state: RetraceState) -> dict:
    started_at = time.time()
    context = build_synthesis_context(state)
    context_tokens = round(len(context) / 4)

    if (
        state.text_output is None
        and state.url_output is None
        and state.youtube_output is None
        and state.file_output is None
    ):
        logger.info(
            json.dumps(
                {
                    "node": "synthesis",
                    "checkpoint_id": state.checkpoint_id,
                    "context_tokens_estimate": context_tokens,
                    "duration_ms": round((time.time() - started_at) * 1000, 2),
                    "diagram_warranted": False,
                }
            )
        )
        return {
            "synthesis_output": EMPTY_SYNTHESIS_OUTPUT,
            "diagram_warranted": False,
            "diagram_type": None,
        }

    try:
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are an AI research assistant analyzing the content a user captured during a research session checkpoint.
The user's checkpoint is named: {checkpoint_name}

Your job is to synthesize all the content they captured and understand what they were researching, what they learned, what gaps exist, and whether a diagram would help visualize the relationships.

Be analytical, not descriptive. Find connections and tensions across sources. Prioritize the user's own thinking when present.""",
                ),
                (
                    "human",
                    """Here is all the content captured in this checkpoint:

{context}

Based on this content, provide your synthesis.""",
                ),
            ]
        )
        chain = prompt | flash.with_structured_output(SynthesisOutput)
        output = chain.invoke({"checkpoint_name": state.checkpoint_name, "context": context})
        if not isinstance(output, SynthesisOutput):
            output = SynthesisOutput.model_validate(output)

        duration_ms = round((time.time() - started_at) * 1000, 2)
        logger.info(
            json.dumps(
                {
                    "node": "synthesis",
                    "checkpoint_id": state.checkpoint_id,
                    "context_tokens_estimate": context_tokens,
                    "duration_ms": duration_ms,
                    "diagram_warranted": output.diagram_warranted,
                }
            )
        )
        return {
            "synthesis_output": output,
            "diagram_warranted": output.diagram_warranted,
            "diagram_type": output.diagram_type,
        }
    except Exception as error:
        duration_ms = round((time.time() - started_at) * 1000, 2)
        message = f"synthesis failed: {error}"
        logger.exception(
            json.dumps(
                {
                    "node": "synthesis",
                    "checkpoint_id": state.checkpoint_id,
                    "context_length": len(context),
                    "context_tokens_estimate": context_tokens,
                    "duration_ms": duration_ms,
                    "error": str(error),
                }
            )
        )
        return {
            "synthesis_output": FAILED_SYNTHESIS_OUTPUT,
            "diagram_warranted": False,
            "diagram_type": None,
            "errors": [message],
        }
