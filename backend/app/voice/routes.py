from flask import Blueprint, Response, jsonify, request
from werkzeug.utils import secure_filename

from . import elevenlabs, settings

bp = Blueprint("voice", __name__)

MAX_SPEAK_CHARS = 5000  # keeps a single reply from burning lots of credits


def _not_configured():
    return (
        jsonify(
            error="Voice isn't set up: add ELEVENLABS_API_KEY to backend/.env "
            "and restart the backend."
        ),
        503,
    )


@bp.get("/status")
def status():
    return jsonify(enabled=bool(settings.api_key()), voices=list(settings.VOICES))


@bp.post("/speak")
def speak():
    """Body: {"text": "...", "voice": "gigi"} -> MP3 audio.
    `voice` is optional and must be a name from settings.VOICES."""
    key = settings.api_key()
    if not key:
        return _not_configured()

    body = request.get_json(silent=True) or {}
    text = (body.get("text") or "").strip()
    if not text:
        return jsonify(error="Nothing to read out."), 400
    if len(text) > MAX_SPEAK_CHARS:
        return jsonify(error=f"Text is too long to read out (max {MAX_SPEAK_CHARS} characters)."), 400

    voice_id = settings.voice_id(body.get("voice") or None)
    if voice_id is None:
        return jsonify(error=f"Unknown voice. Choose one of: {', '.join(settings.VOICES)}."), 400

    try:
        audio = elevenlabs.text_to_speech(
            text, api_key=key, voice_id=voice_id, model_id=settings.tts_model()
        )
    except elevenlabs.ElevenLabsError as err:
        return jsonify(error=str(err)), 502

    return Response(audio, mimetype="audio/mpeg")


@bp.post("/transcribe")
def transcribe():
    """Multipart form with an "audio" file -> {"text": "..."}."""
    key = settings.api_key()
    if not key:
        return _not_configured()

    upload = request.files.get("audio")
    data = upload.read() if upload else b""
    if not data:
        return jsonify(error="No audio was recorded."), 400

    try:
        text = elevenlabs.speech_to_text(
            data,
            filename=secure_filename(upload.filename or "") or "recording.webm",
            content_type=upload.mimetype or "application/octet-stream",
            api_key=key,
            model_id=settings.stt_model(),
        )
    except elevenlabs.ElevenLabsError as err:
        return jsonify(error=str(err)), 502

    return jsonify(text=text)
