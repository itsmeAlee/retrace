import json
import os
import sys
from pathlib import Path
from typing import Any

from appwrite.client import Client
from appwrite.services.account import Account

PACKAGE_ROOT = Path(__file__).resolve().parent.parent
if str(PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(PACKAGE_ROOT))


def parse_body(context: Any) -> dict[str, Any]:
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
            return {}
    return {}


def response_json(context: Any, payload: dict[str, Any], status: int = 200) -> Any:
    response = getattr(context, "res", None) or getattr(context, "response", None)
    if response and hasattr(response, "json"):
        return response.json(payload, status)
    return payload


def get_header(context: Any, name: str) -> str:
    headers = getattr(getattr(context, "req", None), "headers", {}) or {}
    return str(headers.get(name) or headers.get(name.lower()) or headers.get(name.upper()) or "").strip()


def get_authenticated_user(context: Any) -> dict[str, Any] | None:
    jwt = get_header(context, "x-appwrite-user-jwt")
    if not jwt:
        auth = get_header(context, "authorization")
        if auth.lower().startswith("bearer "):
            jwt = auth[7:].strip()
    if not jwt:
        return None

    endpoint = os.getenv("APPWRITE_FUNCTION_API_ENDPOINT") or os.getenv("APPWRITE_ENDPOINT")
    project_id = os.getenv("APPWRITE_FUNCTION_PROJECT_ID") or os.getenv("APPWRITE_PROJECT_ID")
    if not endpoint or not project_id:
        return None

    client = Client().set_endpoint(endpoint).set_project(project_id).set_jwt(jwt)
    try:
        return Account(client).get()
    except Exception:
        return None


def model_to_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if hasattr(value, "to_dict"):
        return value.to_dict()
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return {}


def user_id_from_model(user: Any) -> str:
    data = model_to_dict(user)
    return str(data.get("$id") or data.get("id") or getattr(user, "id", ""))


def base_kwargs() -> dict[str, str]:
    return {
        "appwrite_endpoint": os.getenv("APPWRITE_FUNCTION_API_ENDPOINT") or os.getenv("APPWRITE_ENDPOINT", ""),
        "appwrite_project_id": os.getenv("APPWRITE_FUNCTION_PROJECT_ID") or os.getenv("APPWRITE_PROJECT_ID", ""),
        "appwrite_api_key": os.getenv("APPWRITE_API_KEY", ""),
        "db_id": os.getenv("DB_ID", ""),
        "capture_items_col_id": os.getenv("CAPTURE_ITEMS_COL_ID", ""),
        "capture_details_col_id": os.getenv("CAPTURE_DETAILS_COL_ID", ""),
        "capture_details_bucket_id": os.getenv("CAPTURE_DETAILS_BUCKET_ID", ""),
    }


def main(context):
    body = parse_body(context)
    summary_type = str(body.get("type") or "").strip().lower()
    session_id = str(body.get("session_id") or body.get("sessionId") or "").strip()
    session_name = str(body.get("session_name") or body.get("sessionName") or "").strip()
    checkpoint_ids = body.get("checkpoint_ids") or body.get("checkpointIds")

    user = get_authenticated_user(context)
    if not user:
        return response_json(context, {"error": "Unauthorized"}, 401)

    if not session_name:
        return response_json(context, {"error": "Missing session_name"}, 400)

    from src.resume.generator import generate_custom_selection_summary, generate_grand_summary

    kwargs = {**base_kwargs(), "user_id": user_id_from_model(user)}

    try:
        if summary_type == "custom":
            if not isinstance(checkpoint_ids, list) or len(checkpoint_ids) < 2:
                return response_json(context, {"error": "Select at least 2 checkpoints."}, 400)
            result = generate_custom_selection_summary(
                checkpoint_ids=[str(checkpoint_id) for checkpoint_id in checkpoint_ids],
                session_name=session_name,
                **kwargs,
            )
            if result is None:
                return response_json(context, {"error": "Selected checkpoints have no completed AI summaries yet."}, 400)
            return response_json(context, {"type": "custom", "result": result.model_dump()}, 200)

        if summary_type == "grand":
            if not session_id:
                return response_json(context, {"error": "Missing session_id"}, 400)
            result = generate_grand_summary(
                session_id=session_id,
                session_name=session_name,
                **kwargs,
            )
            if result is None:
                return response_json(context, {"error": "Not enough completed checkpoints for a grand summary. Need at least 2."}, 400)
            return response_json(context, {"type": "grand", "result": result.model_dump()}, 200)

        return response_json(context, {"error": "Unknown summary type."}, 400)
    except Exception as exc:
        if hasattr(context, "error"):
            context.error(f"summarize failed: {exc}")
        return response_json(context, {"error": "Summary unavailable."}, 500)
