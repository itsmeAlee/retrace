import json
import logging
import time

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from ...models.gemini import flash
from ...utils.mermaid_templates import DIAGRAM_TEMPLATES, FLOWCHART_EXAMPLE
from ...utils.mermaid_validator import clean_mermaid, validate_mermaid
from ..state import RetraceState

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a Mermaid diagram generator.
Generate ONLY valid Mermaid syntax. No explanation.
No markdown code fences. No prose. Just the diagram code.
Follow the exact syntax shown in the example."""


FIRST_ATTEMPT_HUMAN = """Generate a {diagram_type} Mermaid diagram for this research content.

Research topic: {central_question}

Elements to include: {elements}

Syntax example to follow exactly:
{template}

Rules:
- Use the exact same syntax pattern as the example
- Include all provided elements where relevant
- Keep node labels short (max 4 words per node)
- Maximum 10 nodes total
- Output ONLY the Mermaid code, nothing else"""


RETRY_HUMAN = """Your previous Mermaid output was invalid.
Error: {error}
Previous output:
{previous_output}

Generate a corrected {diagram_type} Mermaid diagram.
Elements: {elements}
Syntax example: {template}
Output ONLY valid Mermaid code. Nothing else."""


def _diagram_chain(human_prompt: str):
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            ("human", human_prompt),
        ]
    )
    return prompt | flash | StrOutputParser()


def _log_attempt(state: RetraceState, diagram_type: str, elements: list[str], attempt: int, is_valid: bool, duration_ms: float) -> None:
    logger.info(
        json.dumps(
            {
                "node": "diagram",
                "checkpoint_id": state.checkpoint_id,
                "diagram_type": diagram_type,
                "elements_count": len(elements),
                "attempt": attempt,
                "is_valid": is_valid,
                "duration_ms": duration_ms,
            }
        )
    )


def diagram(state: RetraceState) -> dict:
    if not state.synthesis_output:
        return {"diagram_mermaid": None}
    if not state.synthesis_output.diagram_warranted:
        return {"diagram_mermaid": None}

    diagram_type = state.synthesis_output.diagram_type or "flowchart"
    elements = state.synthesis_output.diagram_elements or []
    central_question = state.synthesis_output.central_question
    template = DIAGRAM_TEMPLATES.get(diagram_type, FLOWCHART_EXAMPLE).strip()

    first_chain = _diagram_chain(FIRST_ATTEMPT_HUMAN)
    started_at = time.time()
    raw_output = first_chain.invoke(
        {
            "diagram_type": diagram_type,
            "central_question": central_question,
            "elements": ", ".join(elements) if elements else "No specific elements provided",
            "template": template,
        }
    )
    cleaned = clean_mermaid(raw_output)
    is_valid, result = validate_mermaid(cleaned)
    _log_attempt(state, diagram_type, elements, 1, is_valid, round((time.time() - started_at) * 1000, 2))
    if is_valid:
        return {"diagram_mermaid": result}

    retry_chain = _diagram_chain(RETRY_HUMAN)
    retry_started_at = time.time()
    retry_output = retry_chain.invoke(
        {
            "error": result,
            "previous_output": raw_output,
            "diagram_type": diagram_type,
            "elements": ", ".join(elements) if elements else "No specific elements provided",
            "template": template,
        }
    )
    cleaned_retry = clean_mermaid(retry_output)
    is_valid_retry, retry_result = validate_mermaid(cleaned_retry)
    _log_attempt(
        state,
        diagram_type,
        elements,
        2,
        is_valid_retry,
        round((time.time() - retry_started_at) * 1000, 2),
    )
    if is_valid_retry:
        return {"diagram_mermaid": retry_result}

    message = f"Diagram generation failed after 2 attempts: {retry_result}"
    logger.error(
        json.dumps(
            {
                "node": "diagram",
                "checkpoint_id": state.checkpoint_id,
                "diagram_type": diagram_type,
                "error": retry_result,
            }
        )
    )
    return {"diagram_mermaid": None, "errors": [message]}
