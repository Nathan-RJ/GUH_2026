"""Shared OpenAI plumbing for the agents.

`chat()` returns None when the AI isn't available (no API key, or running
tests), so each agent can fall back to a placeholder.

Works inside the Flask app (settings from app.config) or on its own
(settings from the environment / backend/.env via app.config.Config).
"""

import json
import logging
from pathlib import Path

from flask import current_app, has_app_context
from openai import OpenAI, OpenAIError
from pypdf import PdfReader

# How much uploaded material to send the model (characters, roughly 4 per token).
MAX_MATERIAL_CHARS = 30_000
TEXT_SUFFIXES = {".txt", ".md", ".csv", ".json", ".py", ".java", ".c", ".cpp", ".js", ".ts", ".html", ".tex"}


class AIError(Exception):
    """The OpenAI request failed (network, bad key, rate limit...)."""


def _settings() -> dict:
    if has_app_context():
        return current_app.config
    from ..config import Config

    return {"OPENAI_API_KEY": Config.OPENAI_API_KEY, "OPENAI_MODEL": Config.OPENAI_MODEL}


def _logger():
    return current_app.logger if has_app_context() else logging.getLogger(__name__)


def _client() -> OpenAI | None:
    settings = _settings()
    key = settings.get("OPENAI_API_KEY")
    if not key or settings.get("TESTING"):
        return None
    return OpenAI(api_key=key)


def chat(
    messages: list[dict],
    *,
    json_mode: bool = False,
    temperature: float = 0.7,
    max_tokens: int = 400,
) -> str | dict | None:
    """Send messages to OpenAI. Returns text (or a dict in json_mode), or None if AI is off."""
    client = _client()
    if client is None:
        return None
    try:
        response = client.chat.completions.create(
            model=_settings()["OPENAI_MODEL"],
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **({"response_format": {"type": "json_object"}} if json_mode else {}),
        )
        content = (response.choices[0].message.content or "").strip()
        return json.loads(content) if json_mode else content
    except (OpenAIError, json.JSONDecodeError) as err:
        _logger().error("OpenAI request failed: %s", err)
        raise AIError(str(err)) from err


def _read_attachment(path: Path) -> str:
    try:
        if path.suffix.lower() == ".pdf":
            return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
        if path.suffix.lower() in TEXT_SUFFIXES:
            return path.read_text(errors="ignore")
    except Exception:  # unreadable file: just skip it
        pass
    return ""


def course_material(session: dict) -> str:
    """Text of the session's uploaded files (slides, notes, rubric), trimmed to fit."""
    folder = Path(current_app.config["UPLOAD_FOLDER"]) / session["id"]
    parts = []
    for a in session["attachments"]:
        text = _read_attachment(folder / a["name"]).strip()
        if text:
            parts.append(f"--- {a['original_name']} ---\n{text}")
    return "\n\n".join(parts)[:MAX_MATERIAL_CHARS]


def topic(session: dict) -> str:
    return session["prompt"] or "(the topic covered in the course material)"
