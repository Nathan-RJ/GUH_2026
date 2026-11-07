"""Voice settings, read from environment variables or backend/.env."""

import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"  # backend/.env

# The student voices the page can pick from (ElevenLabs premade voices).
# Keep the names in sync with loveable/src/voice/voices.ts (which sets each blob colour).
VOICES = {
    "gigi": "jBpfuIE2acCO8z3wKNLl",  # childish
    "jessica": "cgSgspJ2msm6clMCkdW9",  # young, playful
    "laura": "FGY2WhTYpPnrIDTdsKH5",  # young, quirky
    "charlie": "IKne3meq5aSn9XLyUdCD",  # young man
    "liam": "TX3LPaxmHKxFdv7VOQHJ",  # young man
}

# Defaults (override any of these in backend/.env)
DEFAULT_VOICE_ID = VOICES["gigi"]
DEFAULT_TTS_MODEL = "eleven_flash_v2_5"  # low-latency text-to-speech
DEFAULT_STT_MODEL = "scribe_v2"  # speech-to-text


def _load_env_file() -> None:
    """Minimal .env reader so voice needs no extra packages.
    Real environment variables win over the file."""
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()


def api_key() -> str:
    return os.environ.get("ELEVENLABS_API_KEY", "").strip()


def voice_id(name: str | None = None) -> str | None:
    """ElevenLabs voice ID for a voice name from VOICES (None if it's not one of them).
    With no name: ELEVENLABS_VOICE_ID from .env, else the default."""
    if name:
        return VOICES.get(name.strip().lower())
    return os.environ.get("ELEVENLABS_VOICE_ID", "").strip() or DEFAULT_VOICE_ID


def tts_model() -> str:
    return os.environ.get("ELEVENLABS_TTS_MODEL", "").strip() or DEFAULT_TTS_MODEL


def stt_model() -> str:
    return os.environ.get("ELEVENLABS_STT_MODEL", "").strip() or DEFAULT_STT_MODEL
