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
| POST | `/api/sessions` | multipart form: `prompt` + any number of `files`, optional `misconception_count` (0-20) and `misconceptions` (JSON list) -> new session |
| GET  | `/api/sessions/<id>` | the session (prompt, attachments, messages) |
| POST | `/api/sessions/<id>/messages` | `{"text": "..."}` (the user's explanation) -> updated session with the student's reply |
| GET  | `/api/sessions/<id>/attachments/<name>` | download an uploaded file |

## Files

- `app/routes/sessions.py`  the endpoints above
- `app/services/store.py`   in-memory session storage (swap for a database later)
- `app/services/files.py`   saves uploads
- `app/agents/student.py`   the AI student the user teaches; `respond` returns a `StudentTurn`, stored in `session["turns"]` (backend only) for the teacher
- `app/agents/teacher.py`   reviews turns (not wired into the routes yet)
- `app/agents/llm.py`       shared OpenAI client; reads uploaded .txt/.pdf etc. as hidden course material

## Student misconceptions

The student is given a random selection of misconceptions from the session's
misconception bank, and holds onto them until the user explains them away.

- **How many** (the difficulty knob): `misconception_count` on `POST /api/sessions`,
  else `STUDENT_MISCONCEPTIONS` in `.env` (default 3). 0 = the student is just new to the topic.
- **The bank**: generating it is out of scope for now. Until it exists, pass a JSON list
  (strings, or objects with a `text`/`belief`/`description` field) in the `misconceptions`
  form field. Swap in the real source in `_misconception_bank()` in `app/routes/sessions.py`;
  adapt the format in `normalize_misconceptions()` in `app/agents/student.py`.
- With no bank, the student invents `misconception_count` misconceptions itself.
- The bank and the chosen misconceptions are stored on the session but never sent to the webpage.

## AI setup

Create `backend/.env` with:

```
OPEN_API=sk-...
OPENAI_MODEL=gpt-4o-mini   # optional
```

Without a key (and always in tests) the app returns placeholder replies.
