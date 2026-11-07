"""In-memory session storage.

Everything is lost when the server restarts. That's fine for the MVP;
swap this file for a database (e.g. SQLite) later without touching the routes.

A session looks like:
{
  "id": "a1b2c3d4e5f6",
  "prompt": "what the user typed on the home page",
  "attachments": [{"name", "original_name", "size", "content_type"}],
  "messages": [{"role": "user" | "assistant", "text", "created_at"}],
  "turns": [StudentTurn.to_dict(), ...],   # backend only, see agents/student.py
  "student_settings": {"course_knowledge": 0.3, "misconception_count": 3},  # backend only
  "knowledge": [...],                      # backend only: the student's knowledge bank,
                                           #   see agents/knowledge.py
  "created_at": "ISO timestamp"
}

"messages" is what the webpage shows. "turns" is one record per explanation
(the explanation, the student's reply and its status) for the teacher agent to
consume. "knowledge" is everything the student knows (including its
misconceptions) and grows each turn. All backend-only fields are left out of
API responses by public_view().
"""

import uuid
from datetime import datetime, timezone

_sessions: dict[str, dict] = {}

# Never sent to the webpage (the student must not reveal what it knows or gets wrong).
BACKEND_ONLY = {"turns", "student_settings", "knowledge"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def create_session(session_id: str, prompt: str, attachments: list[dict]) -> dict:
    session = {
        "id": session_id,
        "prompt": prompt,
        "attachments": attachments,
        "messages": [],
        "turns": [],
        "student_settings": {"course_knowledge": 0.0, "misconception_count": 0},
        "knowledge": [],
        "created_at": _now(),
    }
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> dict | None:
    return _sessions.get(session_id)


def add_message(session_id: str, role: str, text: str) -> dict:
    message = {"role": role, "text": text, "created_at": _now()}
    _sessions[session_id]["messages"].append(message)
    return message


def set_student_setup(session_id: str, *, settings: dict, knowledge: list[dict]) -> None:
    session = _sessions[session_id]
    session["student_settings"] = settings
    session["knowledge"] = knowledge


def add_turn(session_id: str, turn: dict) -> dict:
    _sessions[session_id]["turns"].append(turn)
    return turn


def get_turns(session_id: str) -> list[dict]:
    """Every StudentTurn so far, oldest first: what the teacher agent consumes."""
    return _sessions[session_id]["turns"]


def public_view(session_id: str) -> dict:
    """The session as the webpage sees it (backend-only fields removed)."""
    return {k: v for k, v in _sessions[session_id].items() if k not in BACKEND_ONLY}
