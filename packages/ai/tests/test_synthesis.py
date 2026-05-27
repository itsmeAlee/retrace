from langchain_core.runnables import RunnableLambda

from src.graph.graph import route_after_synthesis
from src.graph.nodes import synthesis as synthesis_module
from src.graph.nodes.synthesis import build_synthesis_context, synthesis
from src.graph.state import (
    FileAgentOutput,
    FileSource,
    RetraceState,
    SynthesisOutput,
    TextAgentOutput,
    UrlAgentOutput,
    UrlSource,
    YoutubeAgentOutput,
    YoutubeSource,
)


class FakeStructuredModel:
    def __init__(self, output):
        self.output = output

    def with_structured_output(self, _schema):
        return RunnableLambda(lambda _input: self.output)


def make_state(**overrides) -> RetraceState:
    values = {
        "session_id": "session-test",
        "checkpoint_id": "checkpoint-test",
        "checkpoint_name": "Checkpoint Alpha",
        "captures": [],
    }
    values.update(overrides)
    return RetraceState(**values)


def make_synthesis_output(diagram_warranted: bool = False) -> SynthesisOutput:
    return SynthesisOutput(
        central_question="How should research checkpoints connect notes and sources?",
        established=["Checkpoint outputs are structured before synthesis."],
        tensions=["Fast capture can conflict with rich analysis."],
        gaps=["No writer output exists yet."],
        user_thinking="The user wants stable checkpoint summaries.",
        key_sources=["Example Article", "Research Talk"],
        diagram_warranted=diagram_warranted,
        diagram_type="concept_map" if diagram_warranted else None,
        diagram_elements=["Notes", "Sources", "Checkpoint"] if diagram_warranted else None,
    )


def make_text_output() -> TextAgentOutput:
    return TextAgentOutput(
        key_topics=["checkpoint design", "research workflow"],
        key_claims=["Captured notes should be synthesized after extraction."],
        entities=["Retrace"],
        user_thinking="The user thinks checkpoints should preserve current notes.",
        raw_summary="The user is refining a checkpoint-based research workflow.",
    )


def make_url_output() -> UrlAgentOutput:
    return UrlAgentOutput(
        sources=[
            UrlSource(
                url="https://example.com/article",
                title="Example Article",
                summary="An article about structured research workflows.",
                main_argument="Structured capture improves later synthesis.",
                source_type="blog",
                key_facts=["Research notes need context."],
            )
        ]
    )


def make_youtube_output() -> YoutubeAgentOutput:
    return YoutubeAgentOutput(
        videos=[
            YoutubeSource(
                url="https://youtu.be/abc123",
                title="Research Talk",
                captured_at_timestamp="01:20",
                segment_summary="The speaker explains knowledge capture.",
                key_points=["Capture first, synthesize later."],
                relevance="Supports the checkpoint workflow.",
            )
        ]
    )


def make_file_output() -> FileAgentOutput:
    return FileAgentOutput(
        files=[
            FileSource(
                file_name="diagram.png",
                file_type="image",
                content_summary="A visual map of the research pipeline.",
                key_findings=["The pipeline has four major stages."],
                image_description="A concept map connecting capture, extraction, synthesis, and writing.",
            )
        ]
    )


def test_synthesis_with_all_outputs(monkeypatch) -> None:
    expected = make_synthesis_output(diagram_warranted=True)
    monkeypatch.setattr(synthesis_module, "flash", FakeStructuredModel(expected))
    state = make_state(
        text_output=make_text_output(),
        url_output=make_url_output(),
        youtube_output=make_youtube_output(),
        file_output=make_file_output(),
    )

    result = synthesis(state)

    assert isinstance(result["synthesis_output"], SynthesisOutput)
    assert result["synthesis_output"].central_question
    assert result["synthesis_output"].diagram_warranted is True
    print(result["synthesis_output"].model_dump())


def test_synthesis_with_partial_outputs(monkeypatch) -> None:
    expected = make_synthesis_output(diagram_warranted=False)
    monkeypatch.setattr(synthesis_module, "flash", FakeStructuredModel(expected))
    state = make_state(text_output=make_text_output(), url_output=make_url_output())

    context = build_synthesis_context(state)
    result = synthesis(state)

    assert "=== TEXT AND NOTES ===" in context
    assert "=== WEB SOURCE: Example Article ===" in context
    assert "=== YOUTUBE VIDEO:" not in context
    assert "=== FILE:" not in context
    assert result["synthesis_output"].diagram_warranted is False


def test_synthesis_empty_checkpoint() -> None:
    result = synthesis(make_state())

    assert "No content" in result["synthesis_output"].central_question
    assert result["synthesis_output"].diagram_warranted is False


def test_routing_to_diagram() -> None:
    state = make_state(synthesis_output=make_synthesis_output(diagram_warranted=True))

    assert route_after_synthesis(state) == "diagram"


def test_routing_to_writer() -> None:
    state = make_state(synthesis_output=make_synthesis_output(diagram_warranted=False))

    assert route_after_synthesis(state) == "writer"


def test_context_assembly() -> None:
    state = make_state(text_output=make_text_output(), file_output=make_file_output())

    context = build_synthesis_context(state)

    assert "=== TEXT AND NOTES ===" in context
    assert "checkpoint design" in context
    assert "=== FILE: diagram.png (image) ===" in context
    assert "Image description: A concept map" in context
    assert "=== WEB SOURCE:" not in context
    assert "=== YOUTUBE VIDEO:" not in context
