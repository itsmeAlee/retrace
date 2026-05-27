import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv
from google import genai
from langchain_google_genai import ChatGoogleGenerativeAI


ROOT_ENV = Path(__file__).resolve().parents[4] / ".env"
PACKAGE_ENV = Path(__file__).resolve().parents[2] / ".env"

load_dotenv(ROOT_ENV)
load_dotenv(PACKAGE_ENV, override=False)


def _api_key() -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for Retrace AI models.")
    return api_key


def get_available_models() -> list[str]:
    response = requests.get(
        "https://generativelanguage.googleapis.com/v1beta/models",
        headers={"x-goog-api-key": _api_key()},
        timeout=5,
    )
    response.raise_for_status()
    return [model.get("name", "") for model in response.json().get("models", []) if model.get("name")]


def select_flash_model() -> str:
    configured = os.environ.get("GEMINI_FLASH_MODEL")
    if configured:
        return configured
    models = get_available_models()
    flash_models = [
        model
        for model in models
        if "flash" in model.lower() and "embedding" not in model.lower() and "image" not in model.lower()
    ]
    if not flash_models:
        raise RuntimeError("No Gemini Flash model is available for this API key.")

    def score(model: str) -> tuple[float, int, int]:
        lower = model.lower()
        version_match = re.search(r"gemini-(\d+(?:\.\d+)?)", lower)
        version = float(version_match.group(1)) if version_match else 0.0
        stable = 0 if any(token in lower for token in ("preview", "latest", "tts", "audio", "live")) else 1
        full = 0 if "lite" in lower else 1
        return (version, stable, full)

    return max(flash_models, key=score)


FLASH_MODEL = select_flash_model()


flash_lite = ChatGoogleGenerativeAI(
    model=FLASH_MODEL,
    temperature=0,
    google_api_key=_api_key(),
    request_timeout=30,
    retries=1,
)

flash = ChatGoogleGenerativeAI(
    model=FLASH_MODEL,
    temperature=0,
    google_api_key=_api_key(),
    request_timeout=30,
    retries=1,
)

flash_vision = ChatGoogleGenerativeAI(
    model=FLASH_MODEL,
    temperature=0,
    google_api_key=_api_key(),
    request_timeout=30,
    retries=1,
)
