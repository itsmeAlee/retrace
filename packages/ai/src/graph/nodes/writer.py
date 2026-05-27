import json
import logging
import time

from langchain_core.prompts import ChatPromptTemplate

from ...models.gemini import flash_lite
from ..state import FinalOutput, RetraceState, SynthesisOutput

logger = logging.getLogger(__name__)


def _numbered_list(values: list[str], empty: str = "None identified.") -> str:
    if not values:
        return empty
    return "\n".join(f"{index}. {value}" for index, value in enumerate(values, start=1))


def _source_list(values: list[str]) -> str:
    if not values:
        return "No key sources identified."
    return "\n".join(f"- {value}" for value in values)


def _minimal_output(state: RetraceState) -> FinalOutput:
    return FinalOutput(
        summary="No content was captured in this checkpoint to summarize.",
        key_findings=[],
        tensions=[],
        gaps=[],
        suggested_next="Add notes or sources to this checkpoint and drop a new marker.",
        diagram_mermaid=None,
        capture_count=state.total_captures,
        checkpoint_name=state.checkpoint_name,
    )


def _with_runtime_fields(output: FinalOutput, state: RetraceState) -> FinalOutput:
    return output.model_copy(
        update={
            "diagram_mermaid": state.diagram_mermaid,
            "capture_count": state.total_captures,
            "checkpoint_name": state.checkpoint_name,
        }
    )


def _format_synthesis_context(synthesis_output: SynthesisOutput) -> dict[str, str]:
    return {
        "central_question": synthesis_output.central_question,
        "established": _numbered_list(synthesis_output.established),
        "tensions": _numbered_list(synthesis_output.tensions),
        "gaps": _numbered_list(synthesis_output.gaps),
        "user_thinking": synthesis_output.user_thinking or "No personal notes captured.",
        "key_sources": _source_list(synthesis_output.key_sources),
    }


def writer(state: RetraceState) -> dict:
    started_at = time.time()
    if state.synthesis_output is None or state.total_captures == 0:
        output = _minimal_output(state)
        return {"final_output": output}

    context = _format_synthesis_context(state.synthesis_output)
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are a research assistant writing a clear, concise AI summary for a user's research checkpoint. The user will read this summary when they resume their session.
Write in second person ('You explored...', 'You found...').
Be specific, not generic. Reference actual content.
Be concise - this is a summary, not an essay.
Maximum 3 sentences for the main summary paragraph.
Each finding, tension, and gap should be one clear sentence.
The suggested next step should be actionable and specific to what the user was actually researching.""",
            ),
            (
                "human",
                """Checkpoint name: {checkpoint_name}

Research synthesis:
Central question: {central_question}

What was established:
{established}

Tensions found:
{tensions}

Gaps identified:
{gaps}

User's own thinking:
{user_thinking}

Most important sources:
{key_sources}

Using this synthesis, write the final checkpoint summary.
The summary field should be 2-3 sentences of flowing prose.
key_findings should be max 5 items, each one sentence.
tensions should be max 3 items, each one sentence.
gaps should be max 3 items, each one sentence.
suggested_next should be one specific actionable sentence.""",
            ),
        ]
    )

    try:
        chain = prompt | flash_lite.with_structured_output(FinalOutput)
        output = chain.invoke({"checkpoint_name": state.checkpoint_name, **context})
        if not isinstance(output, FinalOutput):
            output = FinalOutput.model_validate(output)
        output = _with_runtime_fields(output, state)

        duration_ms = round((time.time() - started_at) * 1000, 2)
        logger.info(
            json.dumps(
                {
                    "node": "writer",
                    "checkpoint_name": state.checkpoint_name,
                    "capture_count": state.total_captures,
                    "summary_length": len(output.summary),
                    "key_findings_count": len(output.key_findings),
                    "diagram_present": output.diagram_mermaid is not None,
                    "duration_ms": duration_ms,
                }
            )
        )
        return {"final_output": output}
    except Exception as error:
        output = _minimal_output(state)
        message = f"writer failed: {error}"
        logger.exception(
            json.dumps(
                {
                    "node": "writer",
                    "checkpoint_name": state.checkpoint_name,
                    "synthesis_context_length": sum(len(value) for value in context.values()),
                    "duration_ms": round((time.time() - started_at) * 1000, 2),
                    "error": str(error),
                }
            )
        )
        return {"final_output": output, "errors": [message]}
