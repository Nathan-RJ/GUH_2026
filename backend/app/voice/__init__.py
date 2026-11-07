"""Voice: speech-to-text (microphone -> message) and text-to-speech (reply -> audio)
using ElevenLabs. Everything voice-related lives in this folder.

Endpoints (registered under /api/voice in app/__init__.py):
  GET  /api/voice/status       -> {"enabled": bool}  is an API key configured?
  POST /api/voice/transcribe   multipart "audio" file -> {"text": "..."}
  POST /api/voice/speak        {"text": "..."} -> audio/mpeg bytes

Set ELEVENLABS_API_KEY in backend/.env (see backend/.env.example).
"""

from .routes import bp

__all__ = ["bp"]
