import json
import logging
import time

from langchain_core.runnables import RunnableLambda

from src.graph.graph import compiled_graph, route_to_agents, run_pipeline
from src.graph.nodes import file_agent as file_agent_module
from src.graph.nodes import synthesis as synthesis_module
from src.graph.nodes import text_agent as text_agent_module
from src.graph.nodes import url_agent as url_agent_module
from src.graph.nodes import video_agent as video_agent_module
from src.graph.nodes import writer as writer_module
from src.graph.nodes.orchestrator import orchestrator
from src.graph.nodes.video_agent import extract_video_id
from src.graph.state import (
    CaptureItem,
    FileSource,
    FinalOutput,
    RetraceState,
    SynthesisOutput,
    TextAgentOutput,
    UrlSource,
    YoutubeSource,
)


def make_capture(capture_type: str, index: int, **overrides: object) -> dict:
    capture = {
        "id": f"{capture_type}-{index}",
        "type": capture_type,
        "content": f"{capture_type} capture {index}",
        "created_at": f"2026-05-21T10:{index:02d}:00Z",
    }
    capture.update(overrides)
    return capture


def make_state(captures: list[dict]) -> RetraceState:
    return RetraceState(
        session_id="session-test",
        checkpoint_id="checkpoint-test",
        checkpoint_name="Test Checkpoint",
        captures=[CaptureItem.model_validate(capture) for capture in captures],
    )


class FakeStructuredModel:
    def __init__(self, output):
        self.output = output

    def with_structured_output(self, _schema):
        return RunnableLambda(lambda _input: self.output)


def test_orchestrator_classifies_mixed_capture_types_and_logs(caplog) -> None:
    captures = [
        make_capture("text", 1),
        make_capture("text", 2),
        make_capture("url", 3, source_url="https://example.com/article"),
        make_capture("url", 4, source_url="https://youtube.com/watch?v=abc123"),
        make_capture("image", 5, file_id="image-file-id", file_mime_type="image/png"),
        make_capture("file", 6, file_id="pdf-file-id", file_mime_type="application/pdf"),
    ]
    state = make_state(captures)

    with caplog.at_level(logging.INFO):
        update = orchestrator(state)

    assert update["has_text"] is True
    assert update["has_urls"] is True
    assert update["has_youtube"] is True
    assert update["has_images"] is True
    assert update["has_files"] is True
    assert update["capture_count_by_type"] == {
        "text": 2,
        "url": 1,
        "youtube": 1,
        "image": 1,
        "file": 1,
    }
    assert update["total_captures"] == 6

    routed_state = state.model_copy(update=update)
    assert route_to_agents(routed_state) == ["text_agent", "url_agent", "video_agent", "file_agent"]

    log_record = json.loads(caplog.records[-1].message)
    assert log_record["node"] == "orchestrator"
    assert log_record["checkpoint_id"] == "checkpoint-test"
    assert log_record["total_captures"] == 6
    assert log_record["counts"] == update["capture_count_by_type"]
    assert log_record["routing_to"] == ["text_agent", "url_agent", "video_agent", "file_agent"]


def test_audio_reclassified_as_text() -> None:
    state = make_state([make_capture("audio", 1, content="Voice transcript about a contradiction.")])

    update = orchestrator(state)

    assert update["has_text"] is True
    assert "has_audio" not in update
    assert not hasattr(RetraceState, "has_audio")
    assert update["capture_count_by_type"] == {"text": 1}
    assert update["captures"][0].effective_type == "text"


def test_youtube_detection() -> None:
    state = make_state(
        [
            make_capture("url", 1, source_url="https://youtube.com/watch?v=abc123"),
            make_capture("url", 2, source_url="https://example.com/article"),
        ]
    )

    update = orchestrator(state)

    assert update["has_youtube"] is True
    assert update["has_urls"] is True
    assert update["capture_count_by_type"] == {"youtube": 1, "url": 1}


def test_youtu_be_format() -> None:
    state = make_state([make_capture("url", 1, source_url="https://youtu.be/abc123")])

    update = orchestrator(state)

    assert update["has_youtube"] is True
    assert update["has_urls"] is False
    assert update["captures"][0].effective_type == "youtube"
    assert extract_video_id("https://youtu.be/abc123") == "abc123"


def test_stub_graph_runs_with_all_capture_types(monkeypatch) -> None:
    text_output = TextAgentOutput(
        key_topics=["topic"],
        key_claims=["claim"],
        entities=["entity"],
        user_thinking="voice note",
        raw_summary="summary",
    )
    url_output = UrlSource(
        url="https://example.com/article",
        title="Example",
        summary="Source summary.",
        main_argument="Argument.",
        source_type="blog",
        key_facts=["Fact"],
    )
    youtube_output = YoutubeSource(
        url="https://youtu.be/example",
        title="Research Talk",
        captured_at_timestamp="00:42",
        segment_summary="Video summary.",
        key_points=["Point"],
        relevance="Relevant.",
    )
    file_output = FileSource(
        file_name="paper.pdf",
        file_type="pdf",
        content_summary="File summary.",
        key_findings=["Finding"],
        image_description=None,
    )
    synthesis_output = SynthesisOutput(
        central_question="How should Retrace process checkpoint captures?",
        established=["Each capture type has a specialist agent."],
        tensions=[],
        gaps=["Writer output is not implemented yet."],
        user_thinking="voice note",
        key_sources=["Example"],
        diagram_warranted=False,
        diagram_type=None,
        diagram_elements=None,
    )
    final_output = FinalOutput(
        summary="You explored how Retrace processes checkpoint captures.",
        key_findings=["Each capture type has a specialist agent."],
        tensions=[],
        gaps=["Writer integration needs persistence next."],
        suggested_next="Wire the pipeline result into Appwrite.",
        diagram_mermaid=None,
        capture_count=6,
        checkpoint_name="Test Checkpoint",
    )
    monkeypatch.setattr(text_agent_module, "flash_lite", FakeStructuredModel(text_output))
    monkeypatch.setattr(url_agent_module, "analyze_url_capture", lambda _capture: url_output)
    monkeypatch.setattr(url_agent_module, "REQUEST_DELAY_SECONDS", 0)
    monkeypatch.setattr(video_agent_module, "analyze_youtube_capture", lambda _capture: youtube_output)
    monkeypatch.setattr(file_agent_module, "analyze_file_capture", lambda _capture: file_output)
    monkeypatch.setattr(synthesis_module, "flash", FakeStructuredModel(synthesis_output))
    monkeypatch.setattr(writer_module, "flash_lite", FakeStructuredModel(final_output))

    captures = [
        make_capture("text", 1),
        make_capture("url", 2, source_url="https://example.com/article", source_title="Example Article"),
        make_capture("video", 3, source_url="https://youtu.be/example", timestamp="00:42"),
        make_capture("audio", 4, content="Voice transcript about a possible contradiction.", duration=73),
        make_capture("image", 5, file_id="image-file-id", file_name="diagram.png", file_mime_type="image/png"),
        make_capture("file", 6, file_id="pdf-file-id", file_name="paper.pdf", file_mime_type="application/pdf"),
    ]

    started_at = time.perf_counter()
    result = run_pipeline(
        session_id="session-test",
        checkpoint_id="checkpoint-test",
        checkpoint_name="Test Checkpoint",
        captures=captures,
    )
    elapsed_ms = (time.perf_counter() - started_at) * 1000

    print(f"Stub graph completed in {elapsed_ms:.2f}ms")
    assert isinstance(result, FinalOutput)
    assert result.capture_count == 6
    assert result.checkpoint_name == "Test Checkpoint"

    state_result = compiled_graph.invoke(make_state(captures))
    assert state_result["has_text"] is True
    assert state_result["has_urls"] is True
    assert state_result["has_youtube"] is True
    assert state_result["has_images"] is True
    assert state_result["has_files"] is True
    assert "has_audio" not in state_result
    assert state_result["capture_count_by_type"] == {
        "text": 2,
        "url": 1,
        "youtube": 1,
        "image": 1,
        "file": 1,
    }
    assert state_result["total_captures"] == 6


def test_text_agent_mocked(monkeypatch) -> None:
    output = TextAgentOutput(
        key_topics=["retrieval"],
        key_claims=["Indexes need clean source text."],
        entities=["Retrace"],
        user_thinking="The user is deciding how to structure checkpoints.",
        raw_summary="The captures discuss retrieval and checkpoint structure.",
    )
    monkeypatch.setattr(text_agent_module, "flash_lite", FakeStructuredModel(output))
    state = make_state(
        [
            make_capture("text", 1, content="Manual note"),
            make_capture("audio", 2, content="Voice note"),
            make_capture("text", 3, content="Another text note"),
        ]
    )
    state = state.model_copy(update=orchestrator(state))

    result = text_agent_module.text_agent(state)

    assert isinstance(result["text_output"], TextAgentOutput)
    assert result["text_output"].key_topics == ["retrieval"]
    assert result["text_output"].user_thinking


def test_url_agent_mocked(monkeypatch) -> None:
    output = UrlSource(
        url="https://example.com/article",
        title="Example",
        summary="A useful article.",
        main_argument="Clean extraction matters.",
        source_type="blog",
        key_facts=["Fact one"],
    )
    monkeypatch.setattr(url_agent_module, "flash", FakeStructuredModel(output))
    monkeypatch.setattr(url_agent_module, "fetch_url_content", lambda _url: "Fetched source text.")
    monkeypatch.setattr(url_agent_module, "REQUEST_DELAY_SECONDS", 0)
    state = make_state(
        [
            make_capture("url", 1, source_url="https://example.com/article"),
            make_capture("url", 2, source_url="https://example.com/other"),
        ]
    )
    state = state.model_copy(update=orchestrator(state))

    result = url_agent_module.url_agent(state)

    assert len(result["url_output"].sources) == 2


def test_file_agent_image_mocked(monkeypatch) -> None:
    output = FileSource(
        file_name="diagram.png",
        file_type="image",
        content_summary="A system diagram.",
        key_findings=["There are four pipeline stages."],
        image_description="A diagram showing the Retrace pipeline.",
    )
    monkeypatch.setattr(file_agent_module, "flash_vision", FakeStructuredModel(output))
    monkeypatch.setattr(file_agent_module, "download_file_bytes", lambda _file_id: b"fake-image-bytes")
    state = make_state(
        [
            make_capture(
                "image",
                1,
                file_id="image-file-id",
                file_name="diagram.png",
                file_mime_type="image/png",
            )
        ]
    )
    state = state.model_copy(update=orchestrator(state))

    result = file_agent_module.file_agent(state)

    assert result["file_output"].files[0].image_description == "A diagram showing the Retrace pipeline."


def test_empty_capture_list_routes_to_synthesis_without_error() -> None:
    state = make_state([])

    assert route_to_agents(state) == ["synthesis"]

    result = compiled_graph.invoke(state)
    assert result["capture_count_by_type"] == {}
    assert result["total_captures"] == 0
    assert result["final_output"].capture_count == 0
    assert result["final_output"].checkpoint_name == "Test Checkpoint"
    assert result["final_output"].key_findings == []


def test_orchestrator_completes_under_50ms_for_20_captures() -> None:
    captures = [make_capture("text", index) for index in range(20)]
    state = make_state(captures)

    started_at = time.perf_counter()
    update = orchestrator(state)
    elapsed_ms = (time.perf_counter() - started_at) * 1000

    assert elapsed_ms < 50
    assert update["total_captures"] == 20
    assert update["capture_count_by_type"] == {"text": 20}
