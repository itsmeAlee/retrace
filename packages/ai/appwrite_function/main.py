import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from appwrite.client import Client
from appwrite.exception import AppwriteException
from appwrite.id import ID
from appwrite.input_file import InputFile
from appwrite.permission import Permission
from appwrite.query import Query
from appwrite.role import Role
from appwrite.services.storage import Storage
from appwrite.services.tables_db import TablesDB

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))

DB_ID = os.getenv("DB_ID", "")
CAPTURE_ITEMS_TABLE_ID = os.getenv("CAPTURE_ITEMS_COL_ID", "")
SESSIONS_TABLE_ID = os.getenv("SESSIONS_COL_ID", "")
CAPTURE_DETAILS_TABLE_ID = os.getenv("CAPTURE_DETAILS_COL_ID", "")
CAPTURE_DETAILS_BUCKET_ID = os.getenv("CAPTURE_DETAILS_BUCKET_ID", "")
REQUIRED_ENV_VARS = (
    "GEMINI_API_KEY",
    "APPWRITE_API_KEY",
    "DB_ID",
    "CAPTURE_ITEMS_COL_ID",
    "CAPTURE_DETAILS_COL_ID",
    "CAPTURE_DETAILS_BUCKET_ID",
    "APPWRITE_BUCKET_ID",
)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_response(context: Any, payload: dict[str, Any], status: int = 200) -> Any:
    response = getattr(context, "res", None) or getattr(context, "response", None)
    if response and hasattr(response, "json"):
        return response.json(payload, status)
    return payload


def log(context: Any, payload: dict[str, Any]) -> None:
    message = json.dumps(payload, default=str)
    if hasattr(context, "log"):
        context.log(message)
    else:
        print(message)


def error(context: Any, message: str) -> None:
    if hasattr(context, "error"):
        context.error(message)
    else:
        print(message, file=sys.stderr)


def parse_event_payload(context: Any) -> dict[str, Any]:
    req = getattr(context, "req", None)
    body_json = getattr(req, "body_json", None) or getattr(req, "bodyJson", None)
    if isinstance(body_json, dict):
        return body_json

    body = getattr(req, "body", None)
    if isinstance(body, dict):
        return body
    if isinstance(body, str) and body.strip():
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            pass

    raw_event = os.getenv("APPWRITE_FUNCTION_EVENT_DATA", "")
    if raw_event.strip():
        try:
            return json.loads(raw_event)
        except json.JSONDecodeError:
            pass

    return {}


def extract_row(payload: dict[str, Any]) -> dict[str, Any]:
    for key in ("row", "document", "data", "payload"):
        candidate = payload.get(key)
        if isinstance(candidate, dict):
            if "$id" in candidate or "isCheckpoint" in candidate:
                return candidate
            nested = extract_row(candidate)
            if nested:
                return nested
    if "$id" in payload or "isCheckpoint" in payload:
        return payload
    return {}


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    return bool(value)


def model_to_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        data = value
    if hasattr(value, "to_dict"):
        data = value.to_dict()
    elif hasattr(value, "model_dump"):
        data = value.model_dump()
    elif not isinstance(value, dict):
        return {}

    nested = data.get("data")
    if isinstance(nested, dict):
        return {**nested, **{key: item for key, item in data.items() if key != "data"}}
    return data


def appwrite_id(value: Any) -> str:
    data = model_to_dict(value)
    return str(data.get("$id") or data.get("id") or getattr(value, "id", "") or "")


def client_from_env(context: Any) -> Client:
    endpoint = os.getenv("APPWRITE_FUNCTION_API_ENDPOINT") or os.getenv("APPWRITE_ENDPOINT")
    project_id = os.getenv("APPWRITE_FUNCTION_PROJECT_ID") or os.getenv("APPWRITE_PROJECT_ID")
    api_key = os.getenv("APPWRITE_API_KEY")
    if not endpoint or not project_id:
        raise RuntimeError("Missing Appwrite endpoint or project ID.")

    client = Client().set_endpoint(endpoint).set_project(project_id)
    if api_key:
        return client.set_key(api_key)

    req = getattr(context, "req", None)
    headers = getattr(req, "headers", {}) or {}
    dynamic_key = headers.get("x-appwrite-key") or headers.get("X-Appwrite-Key")
    if dynamic_key:
        return client.set_key(dynamic_key)
    raise RuntimeError("Missing APPWRITE_API_KEY or x-appwrite-key execution header.")


def missing_required_env() -> list[str]:
    missing = [
        name
        for name in REQUIRED_ENV_VARS
        if not os.getenv(name)
    ]
    if not (os.getenv("APPWRITE_FUNCTION_API_ENDPOINT") or os.getenv("APPWRITE_ENDPOINT")):
        missing.append("APPWRITE_ENDPOINT")
    if not (os.getenv("APPWRITE_FUNCTION_PROJECT_ID") or os.getenv("APPWRITE_PROJECT_ID")):
        missing.append("APPWRITE_PROJECT_ID")
    return missing


def update_checkpoint(tables: TablesDB, checkpoint_id: str, data: dict[str, Any]) -> None:
    tables.update_row(DB_ID, CAPTURE_ITEMS_TABLE_ID, checkpoint_id, data)


def row_permissions(user_id: str) -> list[str]:
    return [
        Permission.read(Role.user(user_id)),
        Permission.update(Role.user(user_id)),
        Permission.delete(Role.user(user_id)),
    ]


def get_detail_payload(storage: Storage, tables: TablesDB, checkpoint_id: str, user_id: str) -> tuple[dict[str, Any], dict[str, Any] | None]:
    try:
        row = model_to_dict(tables.get_row(DB_ID, CAPTURE_DETAILS_TABLE_ID, checkpoint_id))
    except AppwriteException:
        return {}, None
    if row.get("userId") != user_id:
        return {}, None
    try:
        data = storage.get_file_download(CAPTURE_DETAILS_BUCKET_ID, row["detailsFileId"])
        text = data.decode("utf-8") if isinstance(data, bytes) else str(data)
        return json.loads(text or "{}"), row
    except Exception:
        return {}, row


def upsert_detail_payload(
    storage: Storage,
    tables: TablesDB,
    *,
    checkpoint_id: str,
    session_id: str,
    user_id: str,
    payload: dict[str, Any],
) -> None:
    now = iso_now()
    existing_payload, existing_row = get_detail_payload(storage, tables, checkpoint_id, user_id)
    merged = {**existing_payload, **payload, "updatedAt": now}
    encoded = json.dumps(merged, ensure_ascii=False).encode("utf-8")

    if existing_row and existing_row.get("detailsFileId"):
        try:
            storage.delete_file(CAPTURE_DETAILS_BUCKET_ID, existing_row["detailsFileId"])
        except Exception:
            pass

    file = storage.create_file(
        CAPTURE_DETAILS_BUCKET_ID,
        ID.unique(),
        InputFile.from_bytes(encoded, f"{checkpoint_id}.json"),
        permissions=row_permissions(user_id),
    )
    row_data = {
        "sessionId": session_id,
        "userId": user_id,
        "detailsFileId": appwrite_id(file),
        "detailsSize": len(encoded),
        "updatedAt": now,
    }

    if existing_row:
        tables.update_row(DB_ID, CAPTURE_DETAILS_TABLE_ID, checkpoint_id, row_data)
        return

    try:
        tables.create_row(
            DB_ID,
            CAPTURE_DETAILS_TABLE_ID,
            checkpoint_id,
            {**row_data, "createdAt": now},
            permissions=row_permissions(user_id),
        )
    except AppwriteException as exc:
        if "already exists" not in str(exc).lower():
            raise
        tables.update_row(DB_ID, CAPTURE_DETAILS_TABLE_ID, checkpoint_id, row_data)


def is_schema_write_failure(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        isinstance(exc, AppwriteException)
        and (
            "column_not_found" in message
            or "column_limit_exceeded" in message
            or "invalid document structure" in message
            or "unknown attribute" in message
        )
    )


def write_ai_payload(
    tables: TablesDB,
    storage: Storage,
    checkpoint: dict[str, Any],
    payload: dict[str, Any],
    direct_payload: dict[str, Any] | None = None,
) -> None:
    checkpoint_id = str(checkpoint["$id"])
    try:
        update_checkpoint(tables, checkpoint_id, direct_payload or payload)
    except Exception as exc:
        if not is_schema_write_failure(exc):
            raise
        # Fallback: write only the most critical fields that are known to exist as columns.
        minimal_direct = {
            key: value
            for key, value in (direct_payload or payload).items()
            if key in {"aiTitle", "aiStatus", "aiContext", "aiError", "aiProcessedAt"}
        }
        if minimal_direct:
            try:
                update_checkpoint(tables, checkpoint_id, minimal_direct)
            except Exception:
                pass
    upsert_detail_payload(
        storage,
        tables,
        checkpoint_id=checkpoint_id,
        session_id=str(checkpoint["sessionId"]),
        user_id=str(checkpoint["userId"]),
        payload=payload,
    )


def mark_failed(tables: TablesDB | None, storage: Storage | None, checkpoint: dict[str, Any] | None, message: str) -> None:
    if not tables or not storage or not checkpoint:
        return
    try:
        detail_payload = {
            "aiStatus": "failed",
            "aiError": message[:500],
            "aiErrors": [message],
            "aiProcessedAt": iso_now(),
        }
        direct_payload = {
            "aiStatus": "failed",
            "aiError": message[:500],
            "aiProcessedAt": iso_now(),
        }
        write_ai_payload(tables, storage, checkpoint, detail_payload, direct_payload)
    except Exception:
        pass


def map_capture(row: dict[str, Any]) -> dict[str, Any]:
    capture_type = row.get("type") or "text"
    content = row.get("content") or ""
    source_url = row.get("sourceUrl") or (content if capture_type in {"url", "video"} else None)
    return {
        "id": row.get("$id") or row.get("id"),
        "type": capture_type,
        "content": content,
        "source_url": source_url,
        "source_title": row.get("sourceTitle") or row.get("fileName"),
        "file_id": row.get("fileId"),
        "file_name": row.get("fileName"),
        "file_mime_type": row.get("fileMimeType"),
        "duration": row.get("duration"),
        "timestamp": row.get("timestamp"),
        "created_at": row.get("createdAt") or row.get("$createdAt") or iso_now(),
    }


def fetch_checkpoint_captures(tables: TablesDB, checkpoint_id: str) -> list[dict[str, Any]]:
    result = tables.list_rows(
        DB_ID,
        CAPTURE_ITEMS_TABLE_ID,
        [
            Query.equal("checkpointId", checkpoint_id),
            Query.equal("isCheckpoint", False),
            Query.order_asc("createdAt"),
            Query.limit(100),
        ],
    )
    rows = getattr(result, "rows", None)
    if rows is None:
        rows = model_to_dict(result).get("rows", [])
    return [map_capture(model_to_dict(row)) for row in rows]


def fetch_session_name(tables: TablesDB, session_id: str) -> str:
    try:
        session = model_to_dict(tables.get_row(DB_ID, SESSIONS_TABLE_ID, session_id))
        return str(session.get("name") or "Session")
    except Exception:
        return "Session"


def run_simple_pipeline(**kwargs: Any) -> Any:
    from src.checkpoint_pipeline.pipeline import run_checkpoint_pipeline

    return run_checkpoint_pipeline(**kwargs)


def run_retrace_pipeline(**kwargs: Any) -> Any:
    return run_simple_pipeline(**kwargs)


def main(context):
    checkpoint: dict[str, Any] | None = None
    tables: TablesDB | None = None
    storage: Storage | None = None
    try:
        payload = parse_event_payload(context)
        checkpoint = model_to_dict(extract_row(payload))
        if not checkpoint or not truthy(checkpoint.get("isCheckpoint")):
            log(context, {"function": "retrace-ai-pipeline", "status": "skipped", "reason": "not_checkpoint"})
            return json_response(context, {"success": True, "skipped": True})

        checkpoint_id = str(checkpoint["$id"])
        existing_status = str(checkpoint.get("aiStatus") or "").lower()
        if existing_status and existing_status != "pending":
            log(
                context,
                {
                    "function": "retrace-ai-pipeline",
                    "status": "skipped",
                    "reason": "ai_status_not_pending",
                    "checkpoint_id": checkpoint_id,
                    "ai_status": existing_status,
                },
            )
            return json_response(context, {"success": True, "skipped": True})

        client = client_from_env(context)
        tables = TablesDB(client)
        storage = Storage(client)
        missing_env = missing_required_env()
        log(
            context,
            {
                "step": "env_checked",
                "required": {
                    "GEMINI_API_KEY": bool(os.getenv("GEMINI_API_KEY")),
                    "APPWRITE_ENDPOINT": bool(os.getenv("APPWRITE_ENDPOINT") or os.getenv("APPWRITE_FUNCTION_API_ENDPOINT")),
                    "APPWRITE_PROJECT_ID": bool(os.getenv("APPWRITE_PROJECT_ID") or os.getenv("APPWRITE_FUNCTION_PROJECT_ID")),
                    "APPWRITE_API_KEY": bool(os.getenv("APPWRITE_API_KEY")),
                    "DB_ID": bool(os.getenv("DB_ID")),
                    "CAPTURE_ITEMS_COL_ID": bool(os.getenv("CAPTURE_ITEMS_COL_ID")),
                    "APPWRITE_BUCKET_ID": bool(os.getenv("APPWRITE_BUCKET_ID")),
                },
            },
        )
        if missing_env:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing_env)}")

        session_id = str(checkpoint["sessionId"])
        checkpoint_name = checkpoint.get("checkpointName") or checkpoint.get("content") or "Checkpoint"
        session_name = fetch_session_name(tables, session_id)

        log(context, {"step": "mark_processing", "checkpoint_id": checkpoint_id})
        write_ai_payload(
            tables,
            storage,
            checkpoint,
            {"fullContent": checkpoint.get("content", ""), "aiStatus": "processing", "aiError": "", "aiErrors": []},
            {"aiStatus": "processing", "aiError": ""},
        )

        captures = fetch_checkpoint_captures(tables, checkpoint_id)
        log(context, {
            "step": "captures_fetched",
            "checkpoint_id": checkpoint_id,
            "capture_count": len(captures),
            "capture_types": [c.get("type") for c in captures],
        })

        result = run_retrace_pipeline(
            checkpoint_id=checkpoint_id,
            checkpoint_name=checkpoint_name,
            session_name=session_name,
            note_content=checkpoint.get("content") or "",
            captures=captures,
            appwrite_endpoint=os.getenv("APPWRITE_FUNCTION_API_ENDPOINT") or os.getenv("APPWRITE_ENDPOINT", ""),
            appwrite_project_id=os.getenv("APPWRITE_FUNCTION_PROJECT_ID") or os.getenv("APPWRITE_PROJECT_ID", ""),
            appwrite_api_key=os.getenv("APPWRITE_API_KEY", ""),
            appwrite_bucket_id=os.getenv("APPWRITE_BUCKET_ID", ""),
            event_logger=lambda payload: log(context, payload),
        )
        if result is None:
            log(context, {"step": "pipeline_returned_none", "checkpoint_id": checkpoint_id})
            mark_failed(tables, storage, checkpoint, "Pipeline returned None")
            return json_response(context, {"success": False, "error": "Pipeline returned no result."}, 200)

        title = getattr(result, "title", None) or checkpoint_name
        context_text = getattr(result, "context", "")
        key_points = list(getattr(result, "key_points", None) or getattr(result, "key_findings", []) or [])
        sources_used = [
            source.model_dump() if hasattr(source, "model_dump") else source
            for source in list(getattr(result, "sources_used", []) or [])
        ]
        diagrams = [
            diagram.model_dump() if hasattr(diagram, "model_dump") else diagram
            for diagram in list(getattr(result, "diagrams", []) or [])
        ]
        capture_count = int(getattr(result, "capture_count", len(captures)) or 0)

        log(context, {
            "step": "pipeline_complete",
            "checkpoint_id": checkpoint_id,
            "title": title,
            "context_len": len(context_text),
            "key_points_count": len(key_points),
            "sources_count": len(sources_used),
            "diagram_count": len(diagrams),
            "capture_count": capture_count,
        })

        # Full payload goes to capture_details storage (JSON file)
        processed_at = iso_now()
        detail_payload = {
            "aiTitle": title,
            "aiContext": context_text,
            "aiKeyPoints": key_points,
            "aiSourcesUsed": sources_used,
            "aiKeyFindings": key_points,
            "aiDiagrams": diagrams,
            "aiStatus": "complete",
            "aiProcessedAt": processed_at,
            "aiError": "",
            "aiErrors": [],
            "aiCaptureCount": capture_count,
        }

        # Direct payload only includes columns that exist in the capture_items schema.
        # Large list fields live in capture_details when capture_items is at its column size limit.
        direct_payload = {
            "aiTitle": title,
            "aiStatus": "complete",
            "aiContext": context_text,
            "aiProcessedAt": processed_at,
            "aiError": "",
        }

        log(
            context,
            {
                "step": "appwrite_write_start",
                "checkpoint_id": checkpoint_id,
                "direct_fields": direct_payload,
                "detail_fields": {
                    "aiTitle": title,
                    "aiContext_len": len(context_text),
                    "aiKeyPoints": key_points,
                    "aiSourcesUsed": sources_used,
                    "aiDiagrams": diagrams,
                    "aiStatus": "complete",
                    "aiProcessedAt": processed_at,
                    "aiError": "",
                    "aiCaptureCount": capture_count,
                },
            },
        )
        write_ai_payload(tables, storage, checkpoint, detail_payload, direct_payload)
        log(
            context,
            {
                "function": "retrace-ai-pipeline",
                "checkpoint_id": checkpoint_id,
                "status": "complete",
                "capture_count": capture_count,
                "diagram_count": len(diagrams),
            },
        )
        return json_response(context, {"success": True, "checkpointId": checkpoint_id})
    except Exception as exc:
        error(context, f"retrace-ai-pipeline failed: {exc}")
        mark_failed(tables, storage, checkpoint, str(exc))
        return json_response(context, {"success": False, "error": str(exc)}, 200)
