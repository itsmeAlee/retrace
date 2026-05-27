import os
import sys
from pathlib import Path
from types import SimpleNamespace

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)
os.environ.setdefault("GEMINI_API_KEY", "test-key")

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

from langchain_core.runnables import RunnableLambda

from src.checkpoint_pipeline import pipeline
from src.models.checkpoint_summary import CheckpointSummary
from src.utils.mermaid_validator import validate_mermaid


class FakeFlash(RunnableLambda):
    def __init__(self, summary: CheckpointSummary | None = None, diagram: str = "graph TD\n    A[Idea] --> B[Result]\n    B --> C[Next Step]"):
        super().__init__(lambda _input: diagram)
        self.summary = summary

    def with_structured_output(self, _model):
        summary = self.summary or CheckpointSummary(
            title="Checkpoint Summary",
            summary="You captured a useful checkpoint summary with enough detail to resume the work.",
            key_points=[
                "The first important idea was captured clearly.",
                "The second important idea adds useful context.",
                "The voice note adds the user's own thinking.",
            ],
            sources_used=["User notes"],
            has_diagram=False,
            diagram_mermaid=None,
            capture_count=3,
        )
        return RunnableLambda(lambda _input: summary.model_copy(deep=True))


def run_with_fake_flash(monkeypatch, summary: CheckpointSummary | None = None):
    monkeypatch.setattr(pipeline, "flash", FakeFlash(summary=summary))
    monkeypatch.setattr(pipeline, "flash_vision", FakeFlash())


def test_text_only_checkpoint(monkeypatch):
    run_with_fake_flash(monkeypatch)
    result = pipeline.run_checkpoint_pipeline(
        checkpoint_id="cp1",
        checkpoint_name="Text Notes",
        session_name="Research Session",
        note_content="Manual checkpoint notes.",
        captures=[
            {"id": "1", "type": "text", "content": "Linear regression fits a line."},
            {"id": "2", "type": "text", "content": "Loss measures prediction error."},
            {"id": "3", "type": "audio", "content": "I think learning rate controls stability."},
        ],
        appwrite_endpoint="https://example.com/v1",
        appwrite_project_id="project",
        appwrite_api_key="key",
        appwrite_bucket_id="bucket",
    )

    assert result is not None
    assert result.capture_count == 3
    assert 3 <= len(result.key_points) <= 5


def test_url_content_fetched(monkeypatch):
    monkeypatch.setattr(pipeline, "fetch_jina_reader", lambda _url: "Fetched article body from Jina.")
    state = base_state(
        captures=[
            {
                "id": "url1",
                "type": "url",
                "content": "https://example.com/article",
                "source_url": "https://example.com/article",
                "source_title": "Example Article",
            }
        ]
    )

    output = pipeline.content_processor(state)

    assert "Fetched article body from Jina." in output["processed_content"]
    assert "[Web source - Example Article]" in output["processed_content"]


def test_image_described(monkeypatch):
    monkeypatch.setattr(pipeline, "download_appwrite_file", lambda *_args: b"fake-image")
    monkeypatch.setattr(pipeline, "describe_image_with_gemini", lambda *_args: "A diagram showing a research workflow.")
    state = base_state(
        captures=[
            {
                "id": "img1",
                "type": "image",
                "file_id": "file1",
                "file_name": "workflow.png",
                "file_mime_type": "image/png",
            }
        ]
    )

    output = pipeline.content_processor(state)

    assert "[Image description]" in output["processed_content"]
    assert "research workflow" in output["processed_content"]


def test_empty_checkpoint(monkeypatch):
    run_with_fake_flash(
        monkeypatch,
        CheckpointSummary(
            title="Empty Checkpoint",
            summary="You have not captured content in this checkpoint yet, so there is nothing substantive to summarize.",
            key_points=[],
            sources_used=[],
            has_diagram=False,
            capture_count=0,
        ),
    )

    result = pipeline.run_checkpoint_pipeline(
        checkpoint_id="empty",
        checkpoint_name="Empty",
        session_name="Research Session",
        note_content="",
        captures=[],
        appwrite_endpoint="https://example.com/v1",
        appwrite_project_id="project",
        appwrite_api_key="key",
        appwrite_bucket_id="bucket",
    )

    assert result is not None
    assert "nothing" in result.summary.lower() or "not captured" in result.summary.lower()


def test_diagram_generated_when_warranted(monkeypatch):
    run_with_fake_flash(
        monkeypatch,
        CheckpointSummary(
            title="Connected Ideas",
            summary="You connected several related ideas.",
            key_points=["Idea A leads to Idea B.", "Idea B informs Idea C.", "Idea C suggests action."],
            sources_used=["User notes"],
            has_diagram=True,
            capture_count=1,
        ),
    )

    result = pipeline.run_checkpoint_pipeline(
        checkpoint_id="diagram",
        checkpoint_name="Diagram",
        session_name="Research Session",
        note_content="A leads to B, and B leads to C.",
        captures=[],
        appwrite_endpoint="https://example.com/v1",
        appwrite_project_id="project",
        appwrite_api_key="key",
        appwrite_bucket_id="bucket",
    )

    assert result is not None
    assert result.diagram_mermaid is not None
    assert validate_mermaid(result.diagram_mermaid)[0]


def test_diagram_skipped_when_not_warranted(monkeypatch):
    run_with_fake_flash(
        monkeypatch,
        CheckpointSummary(
            title="No Diagram Needed",
            summary="You captured a simple note.",
            key_points=["One clear point."],
            sources_used=["User notes"],
            has_diagram=False,
            capture_count=1,
        ),
    )

    result = pipeline.run_checkpoint_pipeline(
        checkpoint_id="no-diagram",
        checkpoint_name="No Diagram",
        session_name="Research Session",
        note_content="A simple note.",
        captures=[],
        appwrite_endpoint="https://example.com/v1",
        appwrite_project_id="project",
        appwrite_api_key="key",
        appwrite_bucket_id="bucket",
    )

    assert result is not None
    assert result.diagram_mermaid is None


def test_non_checkpoint_document_skipped(monkeypatch):
    from appwrite_function import main as function_main

    called = False

    def fake_pipeline(**_kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(function_main, "run_simple_pipeline", fake_pipeline)
    context = SimpleNamespace(req=SimpleNamespace(body={"document": {"$id": "cap1", "isCheckpoint": False}}))

    result = function_main.main(context)

    assert result["success"] is True
    assert result["skipped"] is True
    assert called is False


def base_state(captures):
    return {
        "checkpoint_row_id": "cp",
        "checkpoint_name": "Checkpoint",
        "session_name": "Session",
        "note_content": "",
        "captures": captures,
        "processed_content": "",
        "summary": None,
        "error": None,
        "appwrite_endpoint": "https://example.com/v1",
        "appwrite_project_id": "project",
        "appwrite_api_key": "key",
        "appwrite_bucket_id": "bucket",
    }
