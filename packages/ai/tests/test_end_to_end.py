import os
import time

import pytest

from src.graph.graph import run_pipeline
from src.graph.state import CaptureItem, FinalOutput


@pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY is not set")
def test_full_pipeline_text_only() -> None:
    captures = [
        CaptureItem(
            id="1",
            type="text",
            content=(
                "Linear regression uses weights and biases to find the best fit line through data points. "
                "The loss function measures prediction error."
            ),
            source_url=None,
            source_title=None,
            file_id=None,
            file_name=None,
            file_mime_type=None,
            duration=None,
            timestamp=None,
            created_at="2026-05-01T10:00:00Z",
        ),
        CaptureItem(
            id="2",
            type="text",
            content=(
                "Gradient descent minimizes the loss by moving in the direction of steepest descent. "
                "Learning rate controls step size."
            ),
            source_url=None,
            source_title=None,
            file_id=None,
            file_name=None,
            file_mime_type=None,
            duration=None,
            timestamp=None,
            created_at="2026-05-01T10:05:00Z",
        ),
    ]

    started_at = time.perf_counter()
    result = run_pipeline(
        session_id="test-session-001",
        checkpoint_id="test-checkpoint-001",
        checkpoint_name="Learnt about Linear Regression",
        captures=[capture.model_dump() for capture in captures],
    )
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)

    assert isinstance(result, FinalOutput)
    assert result.summary
    assert result.key_findings
    assert result.checkpoint_name == "Learnt about Linear Regression"
    assert result.capture_count == 2
    assert result.diagram_mermaid is None or isinstance(result.diagram_mermaid, str)

    print(result.model_dump())
    print(f"Full pipeline completed in {duration_ms}ms")
