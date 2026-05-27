import json
import logging
import os
from typing import Any

from appwrite.client import Client
from appwrite.exception import AppwriteException
from appwrite.query import Query
from appwrite.services.storage import Storage
from appwrite.services.tables_db import TablesDB
from langchain_core.prompts import ChatPromptTemplate

from ..models.gemini import flash, flash_lite
from ..models.resume_card import ResumeCard
from ..models.summaries import CustomSelectionSummary, GrandSummary

logger = logging.getLogger(__name__)

CUSTOM_SUMMARY_MODEL = flash_lite
GRAND_SUMMARY_MODEL = flash


def _rows(result: Any) -> list[dict[str, Any]]:
    data = _model_to_dict(result)
    return [_model_to_dict(row) for row in data.get("rows", [])]


def _model_to_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return {}


def _decode_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    if not isinstance(value, str) or not value.strip():
        return []
    try:
        parsed = json.loads(value)
        return [item for item in parsed if isinstance(item, str)] if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def _read_details(storage: Storage, tables: TablesDB, db_id: str, details_table_id: str, details_bucket_id: str, checkpoint_id: str) -> dict[str, Any]:
    row = _model_to_dict(tables.get_row(db_id, details_table_id, checkpoint_id))
    details_file_id = row.get("detailsFileId") or f"{checkpoint_id}.json"
    data = storage.get_file_download(details_bucket_id, details_file_id)
    text = data.decode("utf-8") if isinstance(data, bytes) else str(data)
    return json.loads(text or "{}")


def build_resume_context(checkpoints: list[dict[str, Any]]) -> str:
    context_parts: list[str] = []
    for index, checkpoint in enumerate(checkpoints):
        details = checkpoint.get("_aiDetails", {})
        context_parts.append(
            f"""Checkpoint {index + 1}: {checkpoint.get("checkpointName") or "Untitled Checkpoint"}
Summary: {details.get("aiSummary", "")}
Key findings: {_decode_list(details.get("aiKeyFindings"))}
Suggested next: {details.get("aiSuggestedNext", "")}"""
        )
    return "\n\n".join(context_parts)


def _create_appwrite_services(
    appwrite_endpoint: str,
    appwrite_project_id: str,
    appwrite_api_key: str,
) -> tuple[TablesDB, Storage]:
    client = (
        Client()
        .set_endpoint(appwrite_endpoint)
        .set_project(appwrite_project_id)
        .set_key(appwrite_api_key)
    )
    return TablesDB(client), Storage(client)


def _with_complete_details(
    checkpoint: dict[str, Any],
    storage: Storage,
    tables: TablesDB,
    db_id: str,
    capture_details_col_id: str | None = None,
    capture_details_bucket_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    if user_id and checkpoint.get("userId") != user_id:
        return None
    try:
        details = _read_details(
            storage,
            tables,
            db_id,
            capture_details_col_id,
            capture_details_bucket_id,
            checkpoint["$id"],
        )
    except AppwriteException:
        return None
    except Exception:
        logger.exception("Failed to read checkpoint AI details.")
        return None
    if details.get("aiStatus") != "complete" or not details.get("aiSummary"):
        return None
    return {**checkpoint, "_aiDetails": details}


def _format_context_list(title: str, values: Any) -> str:
    decoded = _decode_list(values)
    if not decoded:
        return f"{title}: None"
    return f"{title}: {decoded}"


def build_custom_summary_context(checkpoints: list[dict[str, Any]]) -> str:
    context_parts: list[str] = []
    for checkpoint in checkpoints:
        details = checkpoint.get("_aiDetails", {})
        context_parts.append(
            f"""Checkpoint: {checkpoint.get("checkpointName") or "Untitled Checkpoint"}
Summary: {details.get("aiSummary", "")}
{_format_context_list("Key findings", details.get("aiKeyFindings"))}"""
        )
    return "\n\n".join(context_parts)


def build_grand_summary_context(checkpoints: list[dict[str, Any]]) -> str:
    context_parts: list[str] = []
    for index, checkpoint in enumerate(checkpoints, start=1):
        details = checkpoint.get("_aiDetails", {})
        context_parts.append(
            f"""Checkpoint {index}: {checkpoint.get("checkpointName") or "Untitled Checkpoint"}
Summary: {details.get("aiSummary", "")}
{_format_context_list("Key findings", details.get("aiKeyFindings"))}
{_format_context_list("Tensions", details.get("aiTensions"))}
{_format_context_list("Gaps", details.get("aiGaps"))}
Suggested next: {details.get("aiSuggestedNext", "")}"""
        )
    return "\n\n".join(context_parts)


def generate_resume_card(
    session_id: str,
    session_name: str,
    appwrite_endpoint: str,
    appwrite_project_id: str,
    appwrite_api_key: str,
    db_id: str,
    capture_items_col_id: str,
    *,
    capture_details_col_id: str | None = None,
    capture_details_bucket_id: str | None = None,
    user_id: str | None = None,
) -> ResumeCard | None:
    try:
        capture_details_col_id = capture_details_col_id or os.getenv("CAPTURE_DETAILS_COL_ID", "")
        capture_details_bucket_id = capture_details_bucket_id or os.getenv("CAPTURE_DETAILS_BUCKET_ID", "")
        tables, storage = _create_appwrite_services(appwrite_endpoint, appwrite_project_id, appwrite_api_key)

        result = tables.list_rows(
            db_id,
            capture_items_col_id,
            [
                Query.equal("sessionId", session_id),
                Query.equal("isCheckpoint", True),
                Query.order_asc("createdAt"),
                Query.limit(100),
            ],
        )

        complete_checkpoints: list[dict[str, Any]] = []
        for checkpoint in _rows(result):
            checkpoint_with_details = _with_complete_details(
                checkpoint,
                storage,
                tables,
                db_id,
                capture_details_col_id,
                capture_details_bucket_id,
                user_id,
            )
            if checkpoint_with_details:
                complete_checkpoints.append(checkpoint_with_details)

        if not complete_checkpoints:
            return None

        context = build_resume_context(complete_checkpoints)
        last_checkpoint = complete_checkpoints[-1]
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are generating a session resume card for a user returning to their research session.
Be warm, specific, and helpful. Write in second person. Reference actual content, not generic statements. Be concise.
The user wants to pick up quickly.""",
                ),
                (
                    "human",
                    """Session: {session_name}
Total checkpoints: {total_checkpoints}

Here are all the checkpoint summaries in order:

{full_context}

The most recent checkpoint is:
{last_checkpoint_name}

Generate a resume card that tells the user exactly where they left off and what to do next.""",
                ),
            ]
        )
        chain = prompt | CUSTOM_SUMMARY_MODEL.with_structured_output(ResumeCard)
        output = chain.invoke(
            {
                "session_name": session_name,
                "total_checkpoints": len(complete_checkpoints),
                "full_context": context,
                "last_checkpoint_name": last_checkpoint.get("checkpointName") or "Untitled Checkpoint",
            }
        )
        if not isinstance(output, ResumeCard):
            output = ResumeCard.model_validate(output)
        return output.model_copy(
            update={
                "total_checkpoints": len(complete_checkpoints),
                "session_name": session_name,
                "last_checkpoint_name": last_checkpoint.get("checkpointName") or output.last_checkpoint_name,
            }
        )
    except Exception:
        logger.exception("Failed to generate resume card.")
        return None


def generate_custom_selection_summary(
    checkpoint_ids: list[str],
    session_name: str,
    appwrite_endpoint: str,
    appwrite_project_id: str,
    appwrite_api_key: str,
    db_id: str,
    capture_items_col_id: str,
    *,
    capture_details_col_id: str | None = None,
    capture_details_bucket_id: str | None = None,
    user_id: str | None = None,
) -> CustomSelectionSummary | None:
    if len(checkpoint_ids) < 2:
        return None

    try:
        capture_details_col_id = capture_details_col_id or os.getenv("CAPTURE_DETAILS_COL_ID", "")
        capture_details_bucket_id = capture_details_bucket_id or os.getenv("CAPTURE_DETAILS_BUCKET_ID", "")
        tables, storage = _create_appwrite_services(appwrite_endpoint, appwrite_project_id, appwrite_api_key)
        complete_checkpoints: list[dict[str, Any]] = []
        for checkpoint_id in checkpoint_ids:
            try:
                checkpoint = _model_to_dict(tables.get_row(db_id, capture_items_col_id, checkpoint_id))
            except AppwriteException:
                continue
            checkpoint_with_details = _with_complete_details(
                checkpoint,
                storage,
                tables,
                db_id,
                capture_details_col_id,
                capture_details_bucket_id,
                user_id,
            )
            if checkpoint_with_details:
                complete_checkpoints.append(checkpoint_with_details)

        if len(complete_checkpoints) < 2:
            return None

        context = build_custom_summary_context(complete_checkpoints)
        checkpoint_names = [checkpoint.get("checkpointName") or "Untitled Checkpoint" for checkpoint in complete_checkpoints]
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are summarizing a specific selection of research checkpoints chosen by the user.
Find connections and common themes across them. Write in second person and reference actual checkpoint content.""",
                ),
                (
                    "human",
                    """Session: {session_name}

Selected checkpoint summaries:

{context}

Generate a concise combined summary of this selection.
The overview should be 2-3 sentences.
common_themes should have max 4 items.
key_takeaways should have max 5 items.
connections should include only meaningful relationships between selected checkpoints.""",
                ),
            ]
        )
        chain = prompt | CUSTOM_SUMMARY_MODEL.with_structured_output(CustomSelectionSummary)
        output = chain.invoke({"session_name": session_name, "context": context})
        if not isinstance(output, CustomSelectionSummary):
            output = CustomSelectionSummary.model_validate(output)
        return output.model_copy(update={"checkpoint_names": checkpoint_names})
    except Exception:
        logger.exception("Failed to generate custom selection summary.")
        return None


def generate_grand_summary(
    session_id: str,
    session_name: str,
    appwrite_endpoint: str,
    appwrite_project_id: str,
    appwrite_api_key: str,
    db_id: str,
    capture_items_col_id: str,
    *,
    capture_details_col_id: str | None = None,
    capture_details_bucket_id: str | None = None,
    user_id: str | None = None,
) -> GrandSummary | None:
    try:
        capture_details_col_id = capture_details_col_id or os.getenv("CAPTURE_DETAILS_COL_ID", "")
        capture_details_bucket_id = capture_details_bucket_id or os.getenv("CAPTURE_DETAILS_BUCKET_ID", "")
        tables, storage = _create_appwrite_services(appwrite_endpoint, appwrite_project_id, appwrite_api_key)
        result = tables.list_rows(
            db_id,
            capture_items_col_id,
            [
                Query.equal("sessionId", session_id),
                Query.equal("isCheckpoint", True),
                Query.order_asc("createdAt"),
                Query.limit(100),
            ],
        )

        complete_checkpoints: list[dict[str, Any]] = []
        all_gaps: list[str] = []
        for checkpoint in _rows(result):
            checkpoint_with_details = _with_complete_details(
                checkpoint,
                storage,
                tables,
                db_id,
                capture_details_col_id,
                capture_details_bucket_id,
                user_id,
            )
            if checkpoint_with_details:
                complete_checkpoints.append(checkpoint_with_details)
                all_gaps.extend(_decode_list(checkpoint_with_details.get("_aiDetails", {}).get("aiGaps")))

        if len(complete_checkpoints) < 2:
            return None

        context = build_grand_summary_context(complete_checkpoints)
        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are generating a comprehensive grand summary of an entire research session.
The user wants to understand what they learned, how their thinking evolved, and what remains unresolved.
Be specific, analytical, and insightful. Reference actual content from the checkpoints.""",
                ),
                (
                    "human",
                    """Session: {session_name}
Total complete checkpoints: {total_checkpoints}

Checkpoint summaries in chronological order:

{context}

Unresolved questions and gaps collected across checkpoints:
{all_gaps}

Generate the grand summary. Keep the session overview to 3-4 sentences.
The learning_arc should explain how understanding evolved from first checkpoint to last.
total_findings should have max 8 items, ordered by importance.
unresolved_questions should have max 4 items.
suggested_next_session should be one specific actionable sentence.""",
                ),
            ]
        )
        chain = prompt | GRAND_SUMMARY_MODEL.with_structured_output(GrandSummary)
        output = chain.invoke(
            {
                "session_name": session_name,
                "total_checkpoints": len(complete_checkpoints),
                "context": context,
                "all_gaps": all_gaps or ["None identified."],
            }
        )
        if not isinstance(output, GrandSummary):
            output = GrandSummary.model_validate(output)
        return output.model_copy(
            update={
                "total_checkpoints_included": len(complete_checkpoints),
                "session_name": session_name,
            }
        )
    except Exception:
        logger.exception("Failed to generate grand summary.")
        return None
