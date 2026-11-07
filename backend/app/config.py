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

    # OpenAI. Put OPENAI_API_KEY=sk-... in backend/.env (API_KEY also works).
    # With no key, the AI student falls back to placeholder replies.
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY") or os.environ.get("API_KEY")
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    # How many misconceptions the student is given, picked at random from the
    # session's misconception bank. This is the difficulty knob: 0 = the student
    # is just new to the topic, higher = harder to teach. A session can override
    # it (POST /api/sessions `misconception_count`).
    STUDENT_MISCONCEPTIONS = int(os.environ.get("STUDENT_MISCONCEPTIONS", "3"))
