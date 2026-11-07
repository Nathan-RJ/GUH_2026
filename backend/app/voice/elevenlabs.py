"""Calls to the ElevenLabs REST API, using only the Python standard library.

Docs:
  https://elevenlabs.io/docs/api-reference/text-to-speech/convert
  https://elevenlabs.io/docs/api-reference/speech-to-text/convert
"""

import json
import urllib.error
import urllib.parse
import urllib.request
import uuid

API_BASE = "https://api.elevenlabs.io/v1"
TIMEOUT_SECONDS = 60


class ElevenLabsError(Exception):
    """Raised when ElevenLabs can't be reached or returns an error."""


def _send(req: urllib.request.Request) -> bytes:
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as res:
            return res.read()
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:300]
        raise ElevenLabsError(f"ElevenLabs returned {err.code}: {detail}") from err
    except urllib.error.URLError as err:
        raise ElevenLabsError(f"Couldn't reach ElevenLabs: {err.reason}") from err


def text_to_speech(text: str, *, api_key: str, voice_id: str, model_id: str) -> bytes:
    """Turn text into MP3 audio bytes."""
    url = (
        f"{API_BASE}/text-to-speech/{urllib.parse.quote(voice_id)}"
        "?output_format=mp3_44100_128"
    )
    req = urllib.request.Request(
        url,
        method="POST",
        data=json.dumps({"text": text, "model_id": model_id}).encode("utf-8"),
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
    )
    return _send(req)


def speech_to_text(
    audio: bytes, *, filename: str, content_type: str, api_key: str, model_id: str
) -> str:
    """Turn recorded audio (webm, mp4, mp3, wav...) into text."""
    boundary = uuid.uuid4().hex
    body = _multipart(
        boundary,
        # tag_audio_events off: we only want spoken words, not "[laughter]" etc.
        fields={"model_id": model_id, "tag_audio_events": "false"},
        file_field="file",
        filename=filename,
        content_type=content_type,
        data=audio,
    )
    req = urllib.request.Request(
        f"{API_BASE}/speech-to-text",
        method="POST",
        data=body,
        headers={
            "xi-api-key": api_key,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        result = json.loads(_send(req))
    except json.JSONDecodeError as err:
        raise ElevenLabsError("ElevenLabs sent back an unreadable transcript.") from err
    return (result.get("text") or "").strip()


def _multipart(
    boundary: str,
    *,
    fields: dict[str, str],
    file_field: str,
    filename: str,
    content_type: str,
    data: bytes,
) -> bytes:
    """Build a multipart/form-data body by hand (no `requests` dependency)."""
    out = bytearray()
    for name, value in fields.items():
        out += (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n"
        ).encode("utf-8")
    out += (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    out += data + b"\r\n"
    out += f"--{boundary}--\r\n".encode("utf-8")
    return bytes(out)
