from pathlib import Path

from flask import Blueprint, abort, current_app, jsonify, request, send_from_directory

from ..agents import knowledge, student
from ..services import store, student_inputs
from ..services.files import save_attachments

bp = Blueprint("sessions", __name__)


def _session_folder(session_id: str) -> Path:
    return Path(current_app.config["UPLOAD_FOLDER"]) / session_id


@bp.post("/sessions")
def create_session():
    """Start a session from the home page.

    Multipart form:
      prompt   the topic
      files    any number of attachments (course material)
      plus the optional student inputs documented in services/student_inputs.py
      (prerequisites, course_content, course_knowledge, misconceptions,
      misconception_count), which build the student's knowledge bank.
    """
    prompt = (request.form.get("prompt") or "").strip()
    files = [f for f in request.files.getlist("files") if f and f.filename]

    if not prompt and not files:
        return jsonify(error="Add a prompt or at least one attachment."), 400
    try:
        inputs = student_inputs.read(request.form, current_app.config)
    except student_inputs.InputError as err:
        return jsonify(error=str(err)), 400

    session_id = store.new_id()
    attachments = save_attachments(files, _session_folder(session_id))
    session = store.create_session(session_id, prompt, attachments)
    store.set_student_setup(
        session_id,
        settings={
            "course_knowledge": inputs.course_knowledge,
            "misconception_count": inputs.misconception_count,
        },
        knowledge=knowledge.build(
            prerequisites=inputs.prerequisites,
            course_content=inputs.course_content,
            course_knowledge=inputs.course_knowledge,
            misconceptions=inputs.misconceptions,
            misconception_count=inputs.misconception_count,
        ),
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

    The student agent replies. Both messages are saved for the webpage, what
    the student learned is added to its knowledge bank, and the StudentTurn is
    saved in session["turns"] (backend only) for the teacher agent to review
    later. Returns the updated session (without turns).
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
    knowledge.add_taught(session["knowledge"], turn.learned, turn.number)
    store.add_turn(session_id, turn.to_dict())
    return jsonify(store.public_view(session_id))


@bp.get("/sessions/<session_id>/attachments/<name>")
def download_attachment(session_id: str, name: str):
    session = store.get_session(session_id)
    if session is None or name not in {a["name"] for a in session["attachments"]}:
        abort(404)
    return send_from_directory(_session_folder(session_id), name)
