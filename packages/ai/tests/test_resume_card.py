from src.models.resume_card import ResumeCard
from src.resume import generator
from langchain_core.runnables import RunnableLambda


class FakeTables:
    def __init__(self, checkpoints):
        self.checkpoints = checkpoints

    def list_rows(self, *args, **kwargs):
        return {"rows": sorted(self.checkpoints, key=lambda row: row.get("createdAt", ""))}

    def get_row(self, db_id, table_id, row_id):
        return {"detailsFileId": f"{row_id}.json"}


class FakeStorage:
    def __init__(self, details):
        self.details = details

    def get_file_download(self, bucket_id, file_id):
        checkpoint_id = file_id.replace(".json", "")
        return self.details[checkpoint_id]


class FakeClient:
    def set_endpoint(self, endpoint):
        return self

    def set_project(self, project_id):
        return self

    def set_key(self, api_key):
        return self


class FakeChain:
    def __init__(self, result=None, error=None, seen=None):
        self.result = result
        self.error = error
        self.seen = seen

    def invoke(self, payload):
        if self.seen is not None:
            self.seen.append(payload)
        if self.error:
            raise self.error
        return self.result


class FakeModel:
    def __init__(self, chain):
        self.chain = chain

    def with_structured_output(self, schema):
        return RunnableLambda(self.chain.invoke)


def patch_appwrite(monkeypatch, checkpoints, details, chain):
    monkeypatch.setattr(generator, "Client", FakeClient)
    monkeypatch.setattr(generator, "TablesDB", lambda client: FakeTables(checkpoints))
    monkeypatch.setattr(generator, "Storage", lambda client: FakeStorage(details))
    monkeypatch.setattr(generator, "flash_lite", FakeModel(chain))
    monkeypatch.setattr(generator, "CUSTOM_SUMMARY_MODEL", FakeModel(chain))


def checkpoint(id, name, created_at):
    return {
        "$id": id,
        "sessionId": "session-1",
        "userId": "user-1",
        "isCheckpoint": True,
        "checkpointName": name,
        "createdAt": created_at,
    }


def details(status="complete", summary="Summary", suggested_next="Next", findings=None):
    import json

    return json.dumps({
        "aiStatus": status,
        "aiSummary": summary,
        "aiSuggestedNext": suggested_next,
        "aiKeyFindings": findings or ["Finding"],
    }).encode("utf-8")


def resume(total=1, last="One"):
    return ResumeCard(
        last_checkpoint_name=last,
        where_you_left_off="You were learning regression.",
        what_you_established=["You learned a concept."],
        suggested_next="You should test it.",
        total_checkpoints=total,
        session_name="Session",
    )


def call():
    return generator.generate_resume_card(
        "session-1",
        "Session",
        "https://example.com/v1",
        "project",
        "key",
        "db",
        "capture_items",
        user_id="user-1",
    )


def test_resume_card_no_complete_checkpoints(monkeypatch):
    patch_appwrite(
        monkeypatch,
        [checkpoint("a", "One", "2026-01-01")],
        {"a": details(status="processing")},
        FakeChain(resume()),
    )

    assert call() is None


def test_resume_card_single_checkpoint(monkeypatch):
    patch_appwrite(
        monkeypatch,
        [checkpoint("a", "One", "2026-01-01")],
        {"a": details()},
        FakeChain(resume(total=1, last="One")),
    )

    card = call()
    assert card is not None
    assert card.total_checkpoints == 1
    assert card.last_checkpoint_name == "One"


def test_resume_card_multiple_checkpoints(monkeypatch):
    seen = []
    patch_appwrite(
        monkeypatch,
        [
            checkpoint("a", "One", "2026-01-01"),
            checkpoint("b", "Two", "2026-01-02"),
            checkpoint("c", "Three", "2026-01-03"),
        ],
        {"a": details(summary="A"), "b": details(summary="B"), "c": details(summary="C")},
        FakeChain(resume(total=3, last="Three"), seen=seen),
    )

    card = call()
    assert card is not None
    assert card.total_checkpoints == 3
    prompt_text = str(seen[0])
    assert "Checkpoint 1: One" in prompt_text
    assert "Checkpoint 3: Three" in prompt_text


def test_resume_card_context_order(monkeypatch):
    seen = []
    patch_appwrite(
        monkeypatch,
        [
            checkpoint("c", "Three", "2026-01-03"),
            checkpoint("a", "One", "2026-01-01"),
            checkpoint("b", "Two", "2026-01-02"),
        ],
        {"a": details(summary="A"), "b": details(summary="B"), "c": details(summary="C")},
        FakeChain(resume(total=3, last="Three"), seen=seen),
    )

    call()
    context = str(seen[0])
    assert context.index("Checkpoint 1: One") < context.index("Checkpoint 2: Two") < context.index("Checkpoint 3: Three")


def test_resume_card_model_failure(monkeypatch):
    patch_appwrite(
        monkeypatch,
        [checkpoint("a", "One", "2026-01-01")],
        {"a": details()},
        FakeChain(error=RuntimeError("model failed")),
    )

    assert call() is None
