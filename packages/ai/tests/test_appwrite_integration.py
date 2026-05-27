import json
from types import SimpleNamespace

from appwrite.exception import AppwriteException

from appwrite_function import main as function_main
from src.graph.state import FinalOutput


class FakeResponse:
    def json(self, payload, status=200):
        return {"payload": payload, "status": status}


class FakeContext:
    def __init__(self, body):
        self.req = SimpleNamespace(body=body, headers={})
        self.res = FakeResponse()
        self.logs = []
        self.errors = []

    def log(self, message):
        self.logs.append(message)

    def error(self, message):
        self.errors.append(message)


class FakeStorage:
    def __init__(self):
        self.files = {}
        self.deleted = []

    def create_file(self, bucket_id, file_id, file, permissions=None):
        self.files[file_id] = file.data
        return {"$id": file_id}

    def get_file_download(self, bucket_id, file_id):
        return self.files[file_id]

    def delete_file(self, bucket_id, file_id):
        self.deleted.append(file_id)
        self.files.pop(file_id, None)
        return {}


class FakeTables:
    def __init__(self, captures=None):
        self.captures = captures or []
        self.rows = {}
        self.created = []
        self.updated = []

    def get_row(self, database_id, table_id, row_id, *args, **kwargs):
        key = (table_id, row_id)
        if key not in self.rows:
            raise AppwriteException("not found")
        return self.rows[key]

    def create_row(self, database_id, table_id, row_id, data, permissions=None, *args, **kwargs):
        row = {"$id": row_id, **data}
        self.rows[(table_id, row_id)] = row
        self.created.append((table_id, row_id, data))
        return row

    def update_row(self, database_id, table_id, row_id, data, *args, **kwargs):
        key = (table_id, row_id)
        row = {**self.rows.get(key, {"$id": row_id}), **data}
        self.rows[key] = row
        self.updated.append((table_id, row_id, data))
        return row

    def list_rows(self, database_id, table_id, queries=None, *args, **kwargs):
        return {"rows": self.captures}


def checkpoint_row():
    return {
        "$id": "checkpoint-1",
        "sessionId": "session-1",
        "userId": "user-1",
        "type": "text",
        "content": "Captured note",
        "isCheckpoint": True,
        "checkpointName": "Learned regression",
        "createdAt": "2026-05-21T00:00:00Z",
    }


def decode_latest_payload(storage):
    latest = list(storage.files.values())[-1]
    return json.loads(latest.decode("utf-8"))


def install_fakes(monkeypatch, tables, storage):
    monkeypatch.setattr(function_main, "client_from_env", lambda context: object())
    monkeypatch.setattr(function_main, "TablesDB", lambda client: tables)
    monkeypatch.setattr(function_main, "Storage", lambda client: storage)


def test_non_checkpoint_document_skipped(monkeypatch):
    tables = FakeTables()
    storage = FakeStorage()
    install_fakes(monkeypatch, tables, storage)
    monkeypatch.setattr(function_main, "run_retrace_pipeline", lambda **kwargs: None)

    context = FakeContext({"row": {"$id": "capture-1", "isCheckpoint": False}})
    result = function_main.main(context)

    assert result["payload"]["skipped"] is True
    assert tables.created == []
    assert tables.updated == []
    assert storage.files == {}


def test_field_name_mapping():
    mapped = function_main.map_capture({
        "$id": "capture-1",
        "type": "url",
        "content": "https://example.com",
        "sourceUrl": "https://example.com/article",
        "sourceTitle": "Example",
        "fileId": "file-1",
        "fileName": "doc.pdf",
        "fileMimeType": "application/pdf",
        "duration": 12,
        "createdAt": "2026-05-21T00:00:00Z",
    })

    assert mapped["id"] == "capture-1"
    assert mapped["source_url"] == "https://example.com/article"
    assert mapped["source_title"] == "Example"
    assert mapped["file_id"] == "file-1"
    assert mapped["file_name"] == "doc.pdf"
    assert mapped["file_mime_type"] == "application/pdf"
    assert mapped["created_at"] == "2026-05-21T00:00:00Z"


def test_url_source_falls_back_to_content():
    mapped = function_main.map_capture({
        "$id": "capture-1",
        "type": "url",
        "content": "https://example.com/article",
        "createdAt": "2026-05-21T00:00:00Z",
    })

    assert mapped["source_url"] == "https://example.com/article"


def test_failed_pipeline_sets_failed_status(monkeypatch):
    tables = FakeTables(captures=[])
    storage = FakeStorage()
    install_fakes(monkeypatch, tables, storage)
    monkeypatch.setattr(function_main, "run_retrace_pipeline", lambda **kwargs: None)

    context = FakeContext({"row": checkpoint_row()})
    function_main.main(context)

    payload = decode_latest_payload(storage)
    assert payload["aiStatus"] == "failed"
    assert payload["aiErrors"] == ["Pipeline returned None"]


def test_complete_pipeline_writes_all_fields(monkeypatch):
    tables = FakeTables(captures=[{
        "$id": "capture-1",
        "type": "text",
        "content": "Linear regression note",
        "createdAt": "2026-05-21T00:00:00Z",
    }])
    storage = FakeStorage()
    install_fakes(monkeypatch, tables, storage)
    monkeypatch.setattr(
        function_main,
        "run_retrace_pipeline",
        lambda **kwargs: FinalOutput(
            summary="You explored regression.",
            key_findings=["Loss measures error."],
            tensions=[],
            gaps=["Try a dataset."],
            suggested_next="Fit a small model next.",
            diagram_mermaid="graph TD\n A-->B",
            capture_count=1,
            checkpoint_name="Learned regression",
        ),
    )

    context = FakeContext({"row": checkpoint_row()})
    function_main.main(context)

    payload = decode_latest_payload(storage)
    assert payload["aiStatus"] == "complete"
    assert payload["aiSummary"] == "You explored regression."
    assert payload["aiKeyFindings"] == ["Loss measures error."]
    assert payload["aiDiagramMermaid"] == "graph TD\n A-->B"
    assert payload["aiCaptureCount"] == 1
    assert payload["aiProcessedAt"]


def test_diagram_mermaid_none_stays_json_null(monkeypatch):
    tables = FakeTables()
    storage = FakeStorage()
    install_fakes(monkeypatch, tables, storage)
    monkeypatch.setattr(
        function_main,
        "run_retrace_pipeline",
        lambda **kwargs: FinalOutput(
            summary="No diagram needed.",
            key_findings=[],
            tensions=[],
            gaps=[],
            suggested_next="Keep researching.",
            diagram_mermaid=None,
            capture_count=0,
            checkpoint_name="Empty",
        ),
    )

    context = FakeContext({"row": checkpoint_row()})
    function_main.main(context)

    payload = decode_latest_payload(storage)
    assert payload["aiDiagramMermaid"] is None
