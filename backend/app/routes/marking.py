from flask import Blueprint, current_app, jsonify, request

from ..services import marking

bp = Blueprint("marking", __name__)

MAX_TRANSCRIPT_ENTRIES = 400


@bp.post("/mark")
def mark_session():
    """Mark a whole teaching transcript with the n8n Mark Session workflow.

    Body: {"lesson_id": "...", "transcript": [{"speaker": "user" | "assistant", "text"}],
           "nickname": "..." (optional, default MARK_SESSION_NICKNAME)}
    Returns n8n's reply unchanged: {"session_id", "score", "feedback": {..., "criteria": [...]}}.
    The webhook URL stays on the server (MARK_SESSION_URL).
    """
    body = request.get_json(silent=True) or {}
    lesson_id = str(body.get("lesson_id") or "").strip()
    transcript = marking.clean_transcript(body.get("transcript"))
    nickname = str(body.get("nickname") or "").strip() or current_app.config["MARK_SESSION_NICKNAME"]

    if not lesson_id:
        return jsonify(error="lesson_id is required."), 400
    if not any(t["speaker"] == "user" for t in transcript):
        return jsonify(error="The transcript has nothing from the user to mark yet."), 400
    if len(transcript) > MAX_TRANSCRIPT_ENTRIES:
        return jsonify(error=f"The transcript is too long (max {MAX_TRANSCRIPT_ENTRIES} entries)."), 400

    url = current_app.config["MARK_SESSION_URL"]
    if not url:
        return jsonify(error="Marking isn't set up: add MARK_SESSION_URL to backend/.env."), 503
    try:
        result = marking.mark(url, lesson_id=lesson_id, nickname=nickname, transcript=transcript)
    except marking.MarkingError as err:
        current_app.logger.warning("Marking failed: %s", err)
        return jsonify(error=str(err)), 502
    return jsonify(result)
