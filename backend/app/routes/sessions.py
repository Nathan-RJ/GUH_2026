import json
from pathlib import Path

from flask import Blueprint, abort, current_app, jsonify, request, send_from_directory

from ..agents import personalities, student
from ..services import store
from ..services.files import save_attachments

bp = Blueprint("sessions", __name__)

MAX_MISCONCEPTION_COUNT = 20


def _session_folder(session_id: str) -> Path:
    return Path(current_app.config["UPLOAD_FOLDER"]) / session_id


def _misconception_count() -> int:
    """`misconception_count` form field, else the STUDENT_MISCONCEPTIONS setting."""
    raw = request.form.get("misconception_count")
    if raw is None or raw.strip() == "":
        return current_app.config["STUDENT_MISCONCEPTIONS"]
    count = int(raw)  # ValueError -> 400 in create_session
    if not 0 <= count <= MAX_MISCONCEPTION_COUNT:
        raise ValueError
    return count


def _misconception_bank() -> list:
    """The misconceptions this session's student can be given.

    PLACEHOLDER SOURCE: for now they can be passed in as a JSON list in the
    `misconceptions` form field. Replace this with the real source (e.g. the
    bank generated from the lecturer's content) once it exists; the student
    agent normalises the format (agents/student.py normalize_misconceptions).
    """
    raw = request.form.get("misconceptions")
    if not raw:
        return []
    bank = json.loads(raw)  # JSONDecodeError (a ValueError) -> 400 in create_session
    if not isinstance(bank, list):
        raise ValueError
    return bank


@bp.post("/sessions")
def create_session():
    """Start a session from the home page.

    Multipart form:
      prompt               the topic
      files                any number of attachments (course material)
      misconception_count  optional, 0-20: how many misconceptions the student
                           gets (default: STUDENT_MISCONCEPTIONS setting)
      misconceptions       optional JSON list: the misconception bank (temporary;
                           see _misconception_bank)
      personality          optional: eager | sceptic | dreamer | knowitall | shy
                           (default: random; see agents/personalities.py)
    """
    prompt = (request.form.get("prompt") or "").strip()
    files = [f for f in request.files.getlist("files") if f and f.filename]

    if not prompt and not files:
        return jsonify(error="Add a prompt or at least one attachment."), 400
    try:
        count = _misconception_count()
    except ValueError:
        return jsonify(error=f"misconception_count must be a whole number from 0 to {MAX_MISCONCEPTION_COUNT}."), 400
    try:
        bank = _misconception_bank()
    except ValueError:
        return jsonify(error="misconceptions must be a JSON list."), 400
    try:
        personality = personalities.choose(request.form.get("personality"))
    except ValueError:
        return jsonify(error=f"personality must be one of: {', '.join(personalities.PERSONALITIES)}."), 400

    session_id = store.new_id()
    attachments = save_attachments(files, _session_folder(session_id))
    session = store.create_session(session_id, prompt, attachments)
    session["personality"] = personality  # sent to the page too, so it can match voice + colour
    store.set_misconceptions(
        session_id,
        count=count,
        bank=student.normalize_misconceptions(bank),
        chosen=student.choose_misconceptions(bank, count),
    )
    store.add_message(session_id, "assistant", student.opening(session))

    return jsonify(store.public_view(session_id)), 201


@bp.get("/sessions/<session_id>")
def get_session(session_id: str):
    session = store.get_session(session_id)
    if session is None:
        return jsonify(error="Session not found."), 404
    return jsonify(store.public_view(session_id))


@bp.post("/sessions/<session_id>/messages")
def send_message(session_id: str):
    """One teaching turn. Body: {"text": "<the user's explanation>"}.

    The student agent replies. Both messages are saved for the webpage, and the
    StudentTurn is saved in session["turns"] (backend only) for the teacher
    agent to review later. Returns the updated session (without turns).
    """
    session = store.get_session(session_id)
    if session is None:
        return jsonify(error="Session not found."), 404

    text = ((request.get_json(silent=True) or {}).get("text") or "").strip()
    if not text:
        return jsonify(error="Message is empty."), 400

    # The student sees the history *before* this turn, plus the new explanation.
    turn = student.respond(session, text)

    store.add_message(session_id, "user", text)
    store.add_message(session_id, "assistant", turn.reply)
    store.add_turn(session_id, turn.to_dict())
    return jsonify(store.public_view(session_id))


@bp.get("/sessions/<session_id>/attachments/<name>")
def download_attachment(session_id: str, name: str):
    session = store.get_session(session_id)
    if session is None or name not in {a["name"] for a in session["attachments"]}:
        abort(404)
    return send_from_directory(_session_folder(session_id), name)
