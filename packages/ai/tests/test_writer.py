from langchain_core.runnables import RunnableLambda

from src.graph.nodes import writer as writer_module
from src.graph.nodes.writer import writer
from src.graph.state import FinalOutput, RetraceState, SynthesisOutput


class FakeStructuredModel:
    def __init__(self, output):
        self.output = output

    def with_structured_output(self, _schema):
        return RunnableLambda(lambda _input: self.output)


def make_synthesis_output() -> SynthesisOutput:
    return SynthesisOutput(
        central_question="How does linear regression learn from data?",
        established=["Linear regression fits a line by optimizing weights and bias."],
        tensions=["A high learning rate can speed up or destabilize training."],
        gaps=["The user has not captured examples of regularization yet."],
        user_thinking="The user is connecting loss functions to gradient descent.",
        key_sources=["Linear Regression Notes"],
        diagram_warranted=False,
        diagram_type=None,
        diagram_elements=None,
    )


def make_state(**overrides) -> RetraceState:
    values = {
        "session_id": "session-test",
        "checkpoint_id": "checkpoint-test",
        "checkpoint_name": "Learnt about Linear Regression",
        "captures": [],
        "total_captures": 4,
    }
    values.update(overrides)
    return RetraceState(**values)


def make_final_output(diagram_mermaid: str | None = "model should not control this") -> FinalOutput:
    return FinalOutput(
        summary="You explored how linear regression learns from data through loss and gradient descent.",
        key_findings=["You found that weights and bias define the fitted line."],
        tensions=["Choosing a learning rate involves a stability tradeoff."],
        gaps=["You still need examples of regularization."],
        suggested_next="Capture one worked example showing gradient descent updates step by step.",
        diagram_mermaid=diagram_mermaid,
        capture_count=999,
        checkpoint_name="Wrong model checkpoint",
    )


def test_writer_with_full_synthesis(monkeypatch) -> None:
    monkeypatch.setattr(writer_module, "flash_lite", FakeStructuredModel(make_final_output()))
    state = make_state(synthesis_output=make_synthesis_output(), diagram_mermaid="graph TD\n A-->B\n B-->C")

    result = writer(state)
    output = result["final_output"]

    assert output.summary
    assert output.diagram_mermaid == state.diagram_mermaid
    assert output.capture_count == 4
    assert output.checkpoint_name == "Learnt about Linear Regression"


def test_writer_no_synthesis() -> None:
    result = writer(make_state(synthesis_output=None))
    output = result["final_output"]

    assert "No content" in output.summary
    assert output.key_findings == []
    assert output.capture_count == 4


def test_writer_sets_diagram_from_state(monkeypatch) -> None:
    monkeypatch.setattr(writer_module, "flash_lite", FakeStructuredModel(make_final_output(diagram_mermaid="model diagram")))
    state = make_state(synthesis_output=make_synthesis_output(), diagram_mermaid="graph TD\n Real-->Diagram\n Diagram-->Writer")

    output = writer(state)["final_output"]

    assert output.diagram_mermaid == "graph TD\n Real-->Diagram\n Diagram-->Writer"


def test_writer_diagram_none_when_not_generated(monkeypatch) -> None:
    monkeypatch.setattr(writer_module, "flash_lite", FakeStructuredModel(make_final_output(diagram_mermaid="model diagram")))
    state = make_state(synthesis_output=make_synthesis_output(), diagram_mermaid=None)

    output = writer(state)["final_output"]

    assert output.diagram_mermaid is None
