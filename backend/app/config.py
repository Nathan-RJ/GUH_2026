import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Read secrets from backend/.env (never committed).
load_dotenv(BACKEND_DIR / ".env")


class Config:
    # Where uploaded attachments are saved: uploads/<session_id>/<file>
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", str(BACKEND_DIR / "uploads"))
    # Total size limit for one upload request
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024
    # Which website may call the API. "*" is fine for local dev.
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")

    # OpenAI. Put OPEN_API=sk-... in backend/.env.
    # With no key, the AI student falls back to placeholder replies.
    OPENAI_API_KEY = os.environ.get("OPEN_API")
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL") or "gpt-4o-mini"

    # n8n "Mark Session" workflow (POST /api/mark forwards transcripts to it).
    MARK_SESSION_URL = (
        os.environ.get("MARK_SESSION_URL")
        or "https://likeclockwork.app.n8n.cloud/webhook/reply2me/mark-session"
    )
    # Nickname saved with live-marked sessions, so the leaderboard can leave them out.
    MARK_SESSION_NICKNAME = os.environ.get("MARK_SESSION_NICKNAME") or "live-marking"

    # Where the student endpoint loads a lesson's hidden agent_brief from (server-side
    # only): a URL with "{lesson_id}" in it, e.g. an n8n webhook. Unset = build the
    # student's brief from the lesson's public topic, summary and objectives.
    AGENT_BRIEF_URL = os.environ.get("AGENT_BRIEF_URL") or ""
