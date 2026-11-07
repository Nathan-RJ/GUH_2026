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
| POST | `/api/sessions` | multipart form: `prompt` + any number of `files`, plus optional `lesson`, `prerequisites`, `known_content` (JSON) -> new session |
| GET  | `/api/sessions/<id>` | the session (prompt, attachments, messages) |
| POST | `/api/sessions/<id>/messages` | `{"text": "..."}` (the user's explanation) -> updated session with the student's reply |
| GET  | `/api/sessions/<id>/attachments/<name>` | download an uploaded file |
| POST | `/api/mark` | `{"lesson_id", "transcript": [{"speaker", "text"}]}` -> forwards to the n8n Mark Session workflow; returns `{session_id, score, feedback: {criteria: [...]}}`. Saves a session row in Supabase every call. |

## Files

- `app/routes/sessions.py`  the endpoints above
- `app/services/store.py`   in-memory session storage (swap for a database later)
- `app/services/files.py`   saves uploads
- `app/services/marking.py` calls the n8n Mark Session webhook (`MARK_SESSION_URL`)
- `app/agents/student.py`   the AI student (see below)
- `app/agents/lesson.py`    reads n8n lesson rows (agent_brief, key points)
- `app/agents/knowledge.py` the student's knowledge bank
- `app/services/student_inputs.py` reads the student's inputs for the session endpoints
- `app/agents/teacher.py`   reviews turns (not wired into the routes yet)
- `app/agents/llm.py`       shared OpenAI client; reads uploaded .txt/.pdf etc. as hidden course material

## The student agent

Self-contained: data in, reply out (`app/agents/`). No Flask, storage or file
reading inside it; the caller keeps the conversation and knowledge bank.

```python
from app.agents import knowledge, lesson, student

brief = lesson.parse_agent_brief(lesson_row)          # uses ONLY agent_brief
bank = knowledge.build(agent_brief=brief, prerequisites=prereq_rows, known_content=[])
first = student.opening(brief, bank)                   # the lesson's opening_line
reply = student.respond(brief, bank, transcript, "You compare neighbouring elements.")
knowledge.add_taught(bank, reply.learned, turn=1)      # reply.reply, reply.learned, reply.status
```

- **Lesson** (`lesson.py`): reads rows from the n8n Prepare Lesson workflow. For the
  lesson being taught only `agent_brief` is used (persona, opening line, misconceptions,
  knowledge gaps, behaviour rules, questions). `source_text`, `student_brief` and
  `rubric` hold the answers and are never given to the student.
- **Knowledge bank** (`knowledge.py`): exactly what's passed in. Prerequisites (lesson
  rows' key points, or strings) are known confidently; `known_content` is what it already
  knows of this course; misconceptions and gaps come from `agent_brief`; what it's taught
  is added each turn. How much is passed in is the difficulty, decided upstream.
- The student is told it knows its knowledge bank and nothing else. The model can't
  truly forget, so this is strong instruction, not a guarantee.
- `transcript` accepts our messages (`role`) or the n8n format (`speaker`).

The session endpoints are a thin wrapper for running it locally: `POST /api/sessions`
takes optional JSON form fields `lesson`, `prerequisites` and `known_content`
(`app/services/student_inputs.py`).

## AI setup

Create `backend/.env` with:

```
OPEN_API=sk-...
OPENAI_MODEL=gpt-4o-mini   # optional
```

Without a key (and always in tests) the app returns placeholder replies.
