# Backend

Flask API. Sessions are kept in memory (lost on restart); attachments are saved to `uploads/`.

```bash
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Runs on http://127.0.0.1:5000. Run the tests with `pytest`.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET  | `/api/health` | `{"status": "ok"}` |
| POST | `/api/sessions` | multipart form: `prompt` + any number of `files` -> new session |
| GET  | `/api/sessions/<id>` | the session (prompt, attachments, messages) |
| POST | `/api/sessions/<id>/messages` | `{"text": "..."}` -> updated session with the reply |
| GET  | `/api/sessions/<id>/attachments/<name>` | download an uploaded file |

## Files

- `app/routes/sessions.py`  the endpoints above
- `app/services/store.py`   in-memory session storage (swap for a database later)
- `app/services/files.py`   saves uploads
- `app/services/ai.py`      **where the AI plugs in**: placeholder replies for now
