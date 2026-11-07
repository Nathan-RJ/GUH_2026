import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Config:
    # Where uploaded attachments are saved: uploads/<session_id>/<file>
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", str(BACKEND_DIR / "uploads"))
    # Total size limit for one upload request
    MAX_CONTENT_LENGTH = 25 * 1024 * 1024
    # Which website may call the API. "*" is fine for local dev.
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")
