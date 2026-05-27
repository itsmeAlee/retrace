import json

from langchain_core.runnables import RunnableLambda

from src.models.summaries import CustomSelectionSummary, GrandSummary
from src.resume import generator


class FakeClient:
    def set_endpoint(self, endpoint):
        return self

    def set_project(self, project_id):
        return self

    def set_key(self, api_key):
        return self


class FakeTables:
    def __init__(self, checkpoints):
        self.checkpoints = checkpoints

    def list_rows(self, *args, **kwargs):
        return {"rows": sorted(self.checkpoints, key=lambda row: row.get("createdAt", ""))}

    def get_row(self, db_id, table_id, row_id):
        if table_id == "capture_details":
            return {"detailsFileId": f"{row_id}.json"}
        for checkpoint in self.checkpoints:
            if checkpoint["$id"] == row_id:
                return checkpoint
        raise ValueError("missing row")


class FakeStorage:
    def __init__(self, details):
        self.details = details

    def get_file_download(self, bucket_id, file_id):
        checkpoint_id = file_id.replace(".json", "")
        return self.details[checkpoint_id]


class FakeChain:
    def __init__(self, result, seen=None):
        self.result = result
        self.seen = seen

    def invoke(self, payload):
        if self.seen is not None:
            self.seen.append(payload)
        return self.result


class FakeModel:
    def __init__(self, chain):
        self.chain = chain

    def with_structured_output(self, schema):
        return RunnableLambda(self.chain.invoke)


def patch_appwrite(monkeypatch, checkpoints, details):
    monkeypatch.setattr(generator, "Client", FakeClient)
    monkeypatch.setattr(generator, "TablesDB", lambda client: FakeTables(checkpoints))
    monkeypatch.setattr(generator, "Storage", lambda client: FakeStorage(details))


def checkpoint(id, name, created_at):
    return {
        "$id": id,
        "sessionId": "session-1",
        "userId": "user-1",
        "isCheckpoint": True,
        "checkpointName": name,
        "createdAt": created_at,
    }


def details(status="complete", summary="Summary", findings=None, gaps=None):
    return json.dumps(
        {
            "aiStatus": status,
            "aiSummary": summary,
            "aiKeyFindings": findings or ["Finding"],
            "aiTensions": [],
            "aiGaps": gaps or [],
            "aiSuggestedNext": "Next",
        }
    ).encode("utf-8")


def custom_result():
    return CustomSelectionSummary(
        overview="You connected two ideas.",
        common_themes=["Theme"],
        key_takeaways=["Takeaway"],
        connections=["Connection"],
        checkpoint_names=[],
    )


def grand_result():
    return GrandSummary(
        session_overview="You explored the full session.",
        learning_arc="You started with A and moved to B.",
        total_findings=["Finding"],
        unresolved_questions=["Question"],
        suggested_next_session="Explore the gap.",
        total_checkpoints_included=0,
        session_name="",
    )


def custom_call(checkpoint_ids):
    return generator.generate_custom_selection_summary(
        checkpoint_ids,
        "Session",
        "https://example.com/v1",
        "project",
        "key",
        "db",
        "capture_items",
        user_id="user-1",
    )


def grand_call():
    return generator.generate_grand_summary(
        "session-1",
        "Session",
        "https://example.com/v1",
        "project",
        "key",
        "db",
        "capture_items",
        user_id="user-1",
    )


def test_custom_summary_requires_two_checkpoints(monkeypatch):
    patch_appwrite(monkeypatch, [], {})
    monkeypatch.setattr(generator, "CUSTOM_SUMMARY_MODEL", FakeModel(FakeChain(custom_result())))

    assert custom_call(["a"]) is None


def test_custom_summary_only_complete_included(monkeypatch):
    seen = []
    patch_appwrite(
        monkeypatch,
        [
            checkpoint("a", "One", "2026-01-01"),
            checkpoint("b", "Two", "2026-01-02"),
            checkpoint("c", "Three", "2026-01-03"),
        ],
        {"a": details(summary="A"), "b": details(status="processing"), "c": details(summary="C")},
    )
    monkeypatch.setattr(generator, "CUSTOM_SUMMARY_MODEL", FakeModel(FakeChain(custom_result(), seen=seen)))

    result = custom_call(["a", "b", "c"])

    assert result is not None
    prompt_text = str(seen[0])
    assert "Checkpoint: One" in prompt_text
    assert "Checkpoint: Two" not in prompt_text
    assert "Checkpoint: Three" in prompt_text


def test_custom_summary_maintains_selection_order(monkeypatch):
    seen = []
    patch_appwrite(
        monkeypatch,
        [
            checkpoint("a", "One", "2026-01-01"),
            checkpoint("b", "Two", "2026-01-02"),
            checkpoint("c", "Three", "2026-01-03"),
        ],
        {"a": details(summary="A"), "b": details(summary="B"), "c": details(summary="C")},
    )
    monkeypatch.setattr(generator, "CUSTOM_SUMMARY_MODEL", FakeModel(FakeChain(custom_result(), seen=seen)))

    custom_call(["c", "a", "b"])
    prompt_text = str(seen[0])

    assert prompt_text.index("Checkpoint: Three") < prompt_text.index("Checkpoint: One") < prompt_text.index("Checkpoint: Two")


def test_grand_summary_requires_two_checkpoints(monkeypatch):
    patch_appwrite(monkeypatch, [checkpoint("a", "One", "2026-01-01")], {"a": details()})
    monkeypatch.setattr(generator, "GRAND_SUMMARY_MODEL", FakeModel(FakeChain(grand_result())))

    assert grand_call() is None


def test_grand_summary_all_checkpoints_included(monkeypatch):
    seen = []
    patch_appwrite(
        monkeypatch,
        [
            checkpoint("a", "One", "2026-01-01"),
            checkpoint("b", "Two", "2026-01-02"),
            checkpoint("c", "Three", "2026-01-03"),
            checkpoint("d", "Four", "2026-01-04"),
        ],
        {"a": details(summary="A"), "b": details(summary="B"), "c": details(summary="C"), "d": details(summary="D")},
    )
    monkeypatch.setattr(generator, "GRAND_SUMMARY_MODEL", FakeModel(FakeChain(grand_result(), seen=seen)))

    result = grand_call()

    assert result is not None
    assert result.total_checkpoints_included == 4
    prompt_text = str(seen[0])
    assert "Checkpoint 1: One" in prompt_text
    assert "Checkpoint 4: Four" in prompt_text


def test_grand_summary_collects_all_gaps(monkeypatch):
    seen = []
    patch_appwrite(
        monkeypatch,
        [checkpoint("a", "One", "2026-01-01"), checkpoint("b", "Two", "2026-01-02")],
        {"a": details(gaps=["Gap A"]), "b": details(gaps=["Gap B"])},
    )
    monkeypatch.setattr(generator, "GRAND_SUMMARY_MODEL", FakeModel(FakeChain(grand_result(), seen=seen)))

    grand_call()
    prompt_text = str(seen[0])

    assert "Gap A" in prompt_text
    assert "Gap B" in prompt_text


def test_summary_models_use_expected_constants():
    assert generator.CUSTOM_SUMMARY_MODEL is generator.flash_lite
    assert generator.GRAND_SUMMARY_MODEL is generator.flash
