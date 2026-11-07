# Reply 2 Me

**Learn by teaching. Prove you understand it.**

Reply 2 Me is a web app where students learn a topic by teaching it to a confused AI student. The AI student only knows what it's taught, holds onto realistic misconceptions until they're properly explained away, and is marked against the lecturer's own material. Lecturers see which topics and misconceptions their cohort struggles with while there's still time to reteach.

Built at GUH 2026.

## Why

The best way to learn something is to teach it. Explaining a topic forces you to organise it, find the gaps and put it in your own words. But most students revise passively, by rereading and highlighting, and only find their gaps in the exam. Lecturers only find out what the cohort misunderstood after marking. And most AI study tools make the AI the teacher, marking you against generic knowledge rather than what your module actually teaches.

Reply 2 Me flips that: **you explain, the AI learns**.

## How it works

**Lecturer**
1. Uploads module content (PDF, TXT or MD).
2. An n8n workflow turns it into a lesson: learning objectives, a brief for the AI student (persona, misconceptions, knowledge gaps, questions) and a hidden answer key and rubric.
3. The cohort dashboard shows understanding by topic, common misconceptions and flagged sessions.

**Student**
1. Picks a topic.
2. Meets an AI student with one of five personalities (the eager one, the sceptic, the daydreamer, the know-it-all, the quiet one), each with its own voice.
3. Teaches it out loud or by typing. The AI student asks naive follow-up questions.
4. Watches a live concept map: each learning objective is re-marked after every turn, from grey (not covered) through red (wrong) to green (accurate and complete).
5. Clicks **Finish and test** to get a score and topic-level feedback.

## Architecture

```
            ┌──────────────────────── loveable/ (React web app) ────────────────────────┐
            │  Student: topic picker · teaching screen · results                         │
            │  Lecturer: upload · cohort dashboard                                       │
            └───────────────────────────────┬────────────────────────────────────────────┘
                                            │  /api  (Vite proxies to :5000 in dev)
            ┌───────────────────────────────▼──────── backend/ (Flask API) ──────────────┐
            │  sessions · lessons · marking · voice                                      │
            │  AI Student agent (OpenAI) with a per-session knowledge bank               │
            └──────┬───────────────────────────┬──────────────────────────┬──────────────┘
                   │                           │                          │
          n8n: Prepare Lesson          n8n: Mark Session            ElevenLabs
          n8n: Get Lesson              (scores the transcript       (speech-to-text,
          (lessons in Supabase)         against the rubric)          text-to-speech)
```

- **AI Student** ([backend/app/agents/student.py](backend/app/agents/student.py)): a self-contained agent. It's told it knows exactly its knowledge bank ([knowledge.py](backend/app/agents/knowledge.py)) and nothing else: prerequisites, misconceptions and gaps from the lesson brief, plus whatever it has been taught so far.
- **Personalities** ([personalities.py](backend/app/agents/personalities.py)): one is picked at random per session, each with its own prompt, voice and colour.
- **Lessons** ([backend/app/routes/lessons.py](backend/app/routes/lessons.py)): uploads are forwarded to the n8n Prepare Lesson workflow. The lesson catalogue sent to the browser contains only the topic, summary, objectives and instructions; the source text and rubric stay server-side.
- **Marking** ([backend/app/services/marking.py](backend/app/services/marking.py)): the transcript is sent to the n8n Mark Session workflow after each turn, and the result drives the live concept map.
- **Voice** ([backend/app/voice/](backend/app/voice/)): ElevenLabs calls go through the backend so API keys never reach the browser.

### Guardrails

- The answer key (source text and rubric) is never sent to the browser.
- The AI student is instructed to use only its knowledge bank. A language model can't truly forget, so this is enforced by instructions, not guaranteed.
- Attempts to get the AI student to award itself marks are blocked.
- Uploads: one PDF, TXT or MD file, 10 MB maximum, with file contents checked (PDF signature, UTF-8 text).
- Voice replies are capped in length to limit API usage.
- External calls have timeouts and clear errors, and failed uploads warn against retrying blindly so lessons aren't duplicated.

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 19, TypeScript, TanStack Start and Router, TanStack Query, Vite 8, Tailwind CSS 4, Radix UI. Prototyped in Lovable. |
| Backend | Python, Flask, OpenAI SDK (default model `gpt-4o-mini`), pypdf |
| Orchestration | n8n workflows: Prepare Lesson, Get Lesson, Mark Session |
| Data | Supabase (lessons and marked sessions) |
| Voice | ElevenLabs |
| Tests | pytest (backend), Vitest and Testing Library (frontend) |

## Running it locally

### Requirements

- Python 3.10 or newer
- Node.js **22.12 or newer** (Vite 8 won't run on older versions; check with `node -v`)
- An OpenAI API key. An ElevenLabs key is optional and only needed for voice.

### 1. Backend (terminal 1)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # then fill in your keys (see below)
python run.py
```

The API runs at http://127.0.0.1:5000. Check it with http://127.0.0.1:5000/api/health.

### 2. Web app (terminal 2)

```bash
cd loveable
npm install --legacy-peer-deps
npm run dev
```

Open **http://localhost:8080**. In development, Vite forwards `/api` requests to the backend.

Next time, you only need `source .venv/bin/activate && python run.py` in `backend/` and `npm run dev` in `loveable/`. Press Ctrl+C in each terminal to stop.

### Environment variables

Set these in `backend/.env`. It's gitignored, so never commit real keys.

| Variable | Needed for |
|---|---|
| `OPEN_API` | The AI student. Without it, the student gives placeholder replies. |
| `OPENAI_MODEL` | Optional. Defaults to `gpt-4o-mini`. |
| `ELEVENLABS_API_KEY` | Voice input and output. |
| `ELEVENLABS_VOICE_ID`, `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL` | Optional voice overrides. |
| `MARK_SESSION_URL`, `MARK_SESSION_NICKNAME` | Optional overrides for the n8n marking workflow. |

The backend reads `.env` only when it starts, so restart it after changing keys. If the AI student still gives placeholder replies, make sure only one backend is running.

To point a production build at a separately hosted API, set `VITE_API_BASE_URL` in `loveable/.env` (see [loveable/.env.example](loveable/.env.example)).

### Tests

```bash
cd backend && pytest          # with the venv active
cd loveable && npm test
```

## Project structure

```
backend/                Flask API (more detail in backend/README.md)
  app/agents/           AI student, knowledge bank, personalities, lesson parsing
  app/routes/           sessions, lessons, marking, health
  app/services/         marking client, session store, file handling
  app/voice/            ElevenLabs speech-to-text and text-to-speech
  tests/                pytest suite
loveable/               React web app
  src/routes/           pages: home, student, teach, results, lecturer upload and dashboard
  src/components/       concept map, AI student character, voice orb, UI kit
  src/services/         API clients, live session logic, demo data
  src/voice/            microphone and speech playback
.claude/launch.json     run configurations for the backend and web app
```

## Current status

What works end to end:
- Uploading module content and turning it into a lesson with n8n.
- Teaching a real lesson by voice or text to the AI student, with five personalities.
- Live marking of every turn and a final score from the Mark Session workflow.

Still in progress:
- Separate, private uploads for past exam papers and rubrics. These are disabled in the upload page until they can be handled securely.
- The cohort dashboard uses seeded demo data for cohort numbers and student names.
- Teaching sessions are stored in memory, so they're lost when the backend restarts.
- Mode switching (curious, stubborn, challenge, exam) and escalation to the lecturer are implemented in the demo topics, and not yet for uploaded lessons.
- The teacher review agent ([backend/app/agents/teacher.py](backend/app/agents/teacher.py)) is written but not wired into the app.

## What's next

- Private exam and rubric uploads, and live cohort data on the dashboard.
- Persistent sessions and student sign-in.
- Pilot with a real university module, and integration with VLEs such as Moodle and Canvas.
- New modes: a two-player debate, and a round where you spot the one false statement among three.

## Team

Built at GUH 2026 by Alex, Kardi and Nathan.
