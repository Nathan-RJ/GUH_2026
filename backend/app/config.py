# app/config.py
# ------------------------------------------------------------------
# All settings in one place, read from environment variables (.env).
#
# - LLM_API_KEY          key for the AI provider (NEVER sent to the frontend)
# - STUDENT_MODEL        model for the AI student's replies
# - JUDGE_MODEL          cheaper/faster model for the per-turn judge
# - DATABASE_URL         e.g. sqlite:///guh.db for the hackathon
# - UPLOAD_FOLDER        where lecturer files are saved (backend/uploads)
# - FRONTEND_ORIGIN      the Lovable URL, allowed through CORS
# - SPEECH_API_KEY       e.g. ElevenLabs, for voice in/out (optional)
# ------------------------------------------------------------------
