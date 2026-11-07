import io

import pytest

from app import create_app
from app.voice import elevenlabs, settings


@pytest.fixture
def client(tmp_path):
    app = create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path)})
    return app.test_client()


@pytest.fixture
def with_key(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-key")


@pytest.fixture
def without_key(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", "")


def test_status(client, with_key):
    data = client.get("/api/voice/status").get_json()
    assert data["enabled"] is True
    assert data["voices"] == ["gigi", "jessica", "laura", "charlie", "liam"]


def test_not_configured(client, without_key):
    assert client.get("/api/voice/status").get_json()["enabled"] is False
    assert client.post("/api/voice/speak", json={"text": "hi"}).status_code == 503
    assert client.post("/api/voice/transcribe").status_code == 503


def test_speak_returns_audio(client, with_key, monkeypatch):
    calls = {}

    def fake_tts(text, **kwargs):
        calls.update(text=text, **kwargs)
        return b"MP3DATA"

    monkeypatch.setattr(elevenlabs, "text_to_speech", fake_tts)
    res = client.post("/api/voice/speak", json={"text": "Hello there"})
    assert res.status_code == 200
    assert res.mimetype == "audio/mpeg"
    assert res.data == b"MP3DATA"
    assert calls["text"] == "Hello there"
    assert calls["api_key"] == "test-key"


def test_speak_with_chosen_voice(client, with_key, monkeypatch):
    calls = []
    monkeypatch.setattr(elevenlabs, "text_to_speech", lambda text, **kw: calls.append(kw) or b"MP3")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "")

    assert client.post("/api/voice/speak", json={"text": "hi", "voice": "Liam"}).status_code == 200
    assert client.post("/api/voice/speak", json={"text": "hi"}).status_code == 200
    assert calls[0]["voice_id"] == settings.VOICES["liam"]
    assert calls[1]["voice_id"] == settings.VOICES["gigi"]  # default


def test_speak_rejects_unknown_voice(client, with_key, monkeypatch):
    monkeypatch.setattr(elevenlabs, "text_to_speech", lambda *a, **k: b"MP3")
    res = client.post("/api/voice/speak", json={"text": "hi", "voice": "someone-else"})
    assert res.status_code == 400
    assert "gigi" in res.get_json()["error"]


def test_speak_validation(client, with_key):
    assert client.post("/api/voice/speak", json={"text": "  "}).status_code == 400
    assert client.post("/api/voice/speak", json={"text": "x" * 5001}).status_code == 400


def test_transcribe(client, with_key, monkeypatch):
    seen = {}

    def fake_stt(audio, **kwargs):
        seen.update(audio=audio, **kwargs)
        return "what is recursion"

    monkeypatch.setattr(elevenlabs, "speech_to_text", fake_stt)
    res = client.post(
        "/api/voice/transcribe",
        data={"audio": (io.BytesIO(b"WEBMDATA"), "recording.webm", "audio/webm")},
        content_type="multipart/form-data",
    )
    assert res.get_json() == {"text": "what is recursion"}
    assert seen["audio"] == b"WEBMDATA"
    assert seen["content_type"] == "audio/webm"


def test_transcribe_needs_audio(client, with_key):
    res = client.post("/api/voice/transcribe", data={}, content_type="multipart/form-data")
    assert res.status_code == 400


def test_elevenlabs_error_becomes_502(client, with_key, monkeypatch):
    def boom(*args, **kwargs):
        raise elevenlabs.ElevenLabsError("ElevenLabs returned 401: bad key")

    monkeypatch.setattr(elevenlabs, "text_to_speech", boom)
    res = client.post("/api/voice/speak", json={"text": "hi"})
    assert res.status_code == 502
    assert "401" in res.get_json()["error"]


def test_multipart_body_shape():
    body = elevenlabs._multipart(
        "BOUNDARY",
        fields={"model_id": "scribe_v2"},
        file_field="file",
        filename="a.webm",
        content_type="audio/webm",
        data=b"AUDIO",
    )
    assert b'name="model_id"\r\n\r\nscribe_v2\r\n' in body
    assert b'name="file"; filename="a.webm"\r\nContent-Type: audio/webm\r\n\r\nAUDIO\r\n' in body
    assert body.endswith(b"--BOUNDARY--\r\n")
