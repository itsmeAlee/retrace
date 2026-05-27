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


def main(context):
    body = parse_body(context)
    session_id = str(body.get("session_id") or body.get("sessionId") or "").strip()
    session_name = str(body.get("session_name") or body.get("sessionName") or "").strip()
    if not session_id:
        return response_json(context, {"error": "Missing session_id"}, 400)

    user = get_authenticated_user(context)
    if not user:
        return response_json(context, {"error": "Unauthorized"}, 401)

    try:
        from src.resume.generator import generate_resume_card

        card = generate_resume_card(
            session_id=session_id,
            session_name=session_name,
            appwrite_endpoint=os.getenv("APPWRITE_FUNCTION_API_ENDPOINT") or os.getenv("APPWRITE_ENDPOINT", ""),
            appwrite_project_id=os.getenv("APPWRITE_FUNCTION_PROJECT_ID") or os.getenv("APPWRITE_PROJECT_ID", ""),
            appwrite_api_key=os.getenv("APPWRITE_API_KEY", ""),
            db_id=os.getenv("DB_ID", ""),
            capture_items_col_id=os.getenv("CAPTURE_ITEMS_COL_ID", ""),
            capture_details_col_id=os.getenv("CAPTURE_DETAILS_COL_ID", ""),
            capture_details_bucket_id=os.getenv("CAPTURE_DETAILS_BUCKET_ID", ""),
            user_id=user_id_from_model(user),
        )
        return response_json(context, {"card": card.model_dump() if card else None}, 200)
    except Exception as exc:
        if hasattr(context, "error"):
            context.error(f"resume-card failed: {exc}")
        return response_json(context, {"card": None}, 200)
