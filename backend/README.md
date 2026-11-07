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
| POST | `/api/sessions` | multipart form: `prompt` + any number of `files`, plus the optional knowledge-bank fields below -> new session |
| GET  | `/api/sessions/<id>` | the session (prompt, attachments, messages) |
| POST | `/api/sessions/<id>/messages` | `{"text": "..."}` (the user's explanation) -> updated session with the student's reply |
| GET  | `/api/sessions/<id>/attachments/<name>` | download an uploaded file |

## Files

- `app/routes/sessions.py`  the endpoints above
- `app/services/store.py`   in-memory session storage (swap for a database later)
- `app/services/files.py`   saves uploads
- `app/agents/student.py`   the AI student the user teaches; `respond` returns a `StudentTurn` (reply + what it learned), stored in `session["turns"]` (backend only) for the teacher
- `app/agents/knowledge.py` the student's knowledge bank
- `app/services/student_inputs.py` reads the knowledge-bank inputs (placeholder sources)
- `app/agents/teacher.py`   reviews turns (not wired into the routes yet)
- `app/agents/llm.py`       shared OpenAI client; reads uploaded .txt/.pdf etc. as hidden course material

## The student's knowledge bank

Everything the student knows is in its knowledge bank (`app/agents/knowledge.py`),
stored on the session but never sent to the webpage. The student is told to treat
anything outside it as unknown.

| Source | What | Controlled by |
|---|---|---|
| prerequisite | earlier courses' content; known confidently | `prerequisites` |
| course | a random share of the current course's content | `course_content` + `course_knowledge` (0-1, default `STUDENT_COURSE_KNOWLEDGE`=0) |
| course (misconception) | random picks from the misconception bank; wrongly believed | `misconceptions` + `misconception_count` (0-20, default `STUDENT_MISCONCEPTIONS`=3) |
| taught | what it learned from the user, added after every turn | the conversation |

All of these are optional `POST /api/sessions` form fields (lists are JSON). They're
**placeholder sources** until the real parsed content exists: swap them in
`app/services/student_inputs.py`, and adapt the formats in `knowledge.normalize()`
(it accepts strings, or objects with a `text`/`fact`/`belief`/`description` field).

With no misconception bank, the student invents `misconception_count` misconceptions itself.

## AI setup

Create `backend/.env` with:

```
OPEN_API=sk-...
OPENAI_MODEL=gpt-4o-mini   # optional
```

Without a key (and always in tests) the app returns placeholder replies.
