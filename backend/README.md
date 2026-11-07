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
| POST | `/api/sessions/<id>/messages` | `{"text": "..."}` (the user's explanation) -> updated session: the student's reply, with the teacher's `review` on it |
| GET  | `/api/sessions/<id>/attachments/<name>` | download an uploaded file |

## Files

- `app/routes/sessions.py`  the endpoints above
- `app/services/store.py`   in-memory session storage (swap for a database later)
- `app/services/files.py`   saves uploads
- `app/agents/student.py`   the AI student the user teaches (`opening`, `respond`)
- `app/agents/teacher.py`   reviews each turn and returns a structured `review` (shape documented in the file)
- `app/agents/llm.py`       shared OpenAI client; reads uploaded .txt/.pdf etc. as hidden course material

## AI setup

Create `backend/.env` with:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini   # optional
```

Without a key (and always in tests) the app returns placeholder replies.
