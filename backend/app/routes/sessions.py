from pathlib import Path

from flask import Blueprint, abort, current_app, jsonify, request, send_from_directory

from ..agents import knowledge, lesson, personalities, student
from ..services import store, student_inputs
from ..services.files import save_attachments

bp = Blueprint("sessions", __name__)


def _session_folder(session_id: str) -> Path:
    return Path(current_app.config["UPLOAD_FOLDER"]) / session_id


@bp.post("/sessions")
def create_session():
    """Start a session from the home page.

    Multipart form:
      prompt   the topic (optional when a lesson is given)
      files    any number of attachments
      plus the optional student inputs documented in services/student_inputs.py
      (lesson, prerequisites, known_content), which set up the student.
      personality  optional: eager | sceptic | dreamer | knowitall | shy
                   (default: random; see agents/personalities.py)
    """
    prompt = (request.form.get("prompt") or "").strip()
    files = [f for f in request.files.getlist("files") if f and f.filename]

    try:
        inputs = student_inputs.read(request.form)
    except student_inputs.InputError as err:
        return jsonify(error=str(err)), 400
    brief = lesson.parse_agent_brief(inputs.lesson)
    if not brief.topic:
        brief.topic = prompt
    if not prompt and not files and not inputs.lesson:
        return jsonify(error="Add a prompt, a lesson or at least one attachment."), 400
    try:
        personality = personalities.choose(request.form.get("personality"))
    except ValueError:
        return jsonify(error=f"personality must be one of: {', '.join(personalities.PERSONALITIES)}."), 400
    if not brief.persona:  # a lesson can set its own; otherwise the random student's personality
        brief.persona = personalities.PERSONALITIES[personality]["prompt"]

    session_id = store.new_id()
    attachments = save_attachments(files, _session_folder(session_id))
    session = store.create_session(session_id, prompt, attachments)
    session["personality"] = personality  # sent to the page too, so it can match voice + colour
    bank = knowledge.build(
        agent_brief=brief, prerequisites=inputs.prerequisites, known_content=inputs.known_content
    )
    store.set_student_setup(session_id, brief=brief.to_dict(), knowledge=bank)
    store.add_message(session_id, "assistant", student.opening(brief, bank))

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

    The student agent replies. Both messages are saved for the webpage, what
    the student learned is added to its knowledge bank, and a turn record
    (explanation, reply, learned, status) is saved in session["turns"]
    (backend only). Returns the updated session (without turns).
    """
    session = store.get_session(session_id)
    if session is None:
        return jsonify(error="Session not found."), 404

    text = ((request.get_json(silent=True) or {}).get("text") or "").strip()
    if not text:
        return jsonify(error="Message is empty."), 400

    # The student sees the history *before* this turn, plus the new explanation.
    brief = lesson.AgentBrief(**session["brief"])
    result = student.respond(brief, session["knowledge"], session["messages"], text)
    number = len(session["turns"]) + 1

    store.add_message(session_id, "user", text)
    store.add_message(session_id, "assistant", result.reply)
    knowledge.add_taught(session["knowledge"], result.learned, number)
    store.add_turn(session_id, {
        "session_id": session_id, "number": number, "explanation": text, **result.to_dict(),
        "created_at": store.now(),
    })
    return jsonify(store.public_view(session_id))


@bp.get("/sessions/<session_id>/attachments/<name>")
def download_attachment(session_id: str, name: str):
    session = store.get_session(session_id)
    if session is None or name not in {a["name"] for a in session["attachments"]}:
        abort(404)
    return send_from_directory(_session_folder(session_id), name)
