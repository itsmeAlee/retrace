import json
import logging

from src.graph.nodes import diagram as diagram_module
from src.graph.nodes.diagram import diagram
from src.graph.state import RetraceState, SynthesisOutput
from src.utils.mermaid_templates import DIAGRAM_TEMPLATES
from src.utils.mermaid_validator import clean_mermaid, validate_mermaid


class FakeStringModel:
    def __init__(self, outputs: list[str]):
        self.outputs = outputs
        self.calls = 0

    def __call__(self, _input):
        output = self.outputs[min(self.calls, len(self.outputs) - 1)]
        self.calls += 1
        return output


def make_synthesis_output(diagram_warranted: bool = True, diagram_type: str = "concept_map") -> SynthesisOutput:
    return SynthesisOutput(
        central_question="How should notes connect to research sources?",
        established=["Notes and sources should be synthesized together."],
        tensions=[],
        gaps=[],
        user_thinking="The user wants a clear knowledge map.",
        key_sources=["Example Article"],
        diagram_warranted=diagram_warranted,
        diagram_type=diagram_type if diagram_warranted else None,
        diagram_elements=["Notes", "Sources", "Synthesis", "Checkpoint"] if diagram_warranted else None,
    )


def make_state(diagram_warranted: bool = True, diagram_type: str = "concept_map") -> RetraceState:
    return RetraceState(
        session_id="session-test",
        checkpoint_id="checkpoint-test",
        checkpoint_name="Checkpoint Alpha",
        captures=[],
        synthesis_output=make_synthesis_output(diagram_warranted=diagram_warranted, diagram_type=diagram_type),
    )


def test_clean_mermaid_strips_fences() -> None:
    raw = "```mermaid\ngraph TD\n A-->B\n C-->D\n```"

    assert clean_mermaid(raw) == "graph TD\n A-->B\n C-->D"


def test_clean_mermaid_strips_plain_fences() -> None:
    raw = "```\nflowchart LR\n A-->B\n B-->C\n```"

    assert clean_mermaid(raw) == "flowchart LR\n A-->B\n B-->C"


def test_validate_valid_mermaid() -> None:
    is_valid, cleaned = validate_mermaid("graph TD\n A-->B\n B-->C")

    assert is_valid is True
    assert cleaned == "graph TD\n A-->B\n B-->C"


def test_validate_empty_string() -> None:
    is_valid, error = validate_mermaid("")

    assert is_valid is False
    assert "empty" in error


def test_validate_invalid_start() -> None:
    is_valid, error = validate_mermaid("not a diagram\n A-->B")

    assert is_valid is False
    assert "start with" in error


def test_diagram_node_success(monkeypatch) -> None:
    model = FakeStringModel(["graph TD\n A[Notes]-->B[Sources]\n B-->C[Synthesis]"])
    monkeypatch.setattr(diagram_module, "flash", model)

    result = diagram(make_state())
    is_valid, _ = validate_mermaid(result["diagram_mermaid"])

    assert result["diagram_mermaid"] == "graph TD\n A[Notes]-->B[Sources]\n B-->C[Synthesis]"
    assert is_valid is True
    assert model.calls == 1


def test_diagram_node_retry_success(monkeypatch, caplog) -> None:
    model = FakeStringModel(["not a diagram\n A-->B", "flowchart LR\n A[Notes]-->B[Sources]\n B-->C[Synthesis]"])
    monkeypatch.setattr(diagram_module, "flash", model)

    with caplog.at_level(logging.INFO):
        result = diagram(make_state(diagram_type="flowchart"))

    assert result["diagram_mermaid"] == "flowchart LR\n A[Notes]-->B[Sources]\n B-->C[Synthesis]"
    assert "errors" not in result
    assert model.calls == 2

    records = [json.loads(record.message) for record in caplog.records if record.name == diagram_module.logger.name]
    assert records[0]["attempt"] == 1
    assert records[0]["is_valid"] is False
    assert records[1]["attempt"] == 2
    assert records[1]["is_valid"] is True


def test_diagram_node_both_fail(monkeypatch) -> None:
    model = FakeStringModel(["bad\n A-->B", "still bad\n A-->B"])
    monkeypatch.setattr(diagram_module, "flash", model)

    result = diagram(make_state())

    assert result["diagram_mermaid"] is None
    assert len(result["errors"]) == 1
    assert "after 2 attempts" in result["errors"][0]


def test_diagram_node_skips_when_not_warranted(monkeypatch) -> None:
    model = FakeStringModel(["graph TD\n A-->B\n B-->C"])
    monkeypatch.setattr(diagram_module, "flash", model)

    result = diagram(make_state(diagram_warranted=False))

    assert result["diagram_mermaid"] is None
    assert model.calls == 0


def test_all_diagram_types_have_templates() -> None:
    assert set(DIAGRAM_TEMPLATES) == {
        "concept_map",
        "flowchart",
        "timeline",
        "comparison_table",
        "sequence",
        "tree",
    }
