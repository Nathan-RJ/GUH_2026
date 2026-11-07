# Module-content upload integration

The UI calls `service.processDocument({file, title, kind: 'content'})`. It sends
one real file and a trimmed title to Flask at `POST /api/lessons/prepare`.
Flask validates and forwards multipart data to the fixed n8n production URL.
Only `{lesson_id: <non-empty string>, status: 'draft'}` on a completed HTTP
response confirms a saved draft. Acknowledgements become `unconfirmed`.
There are no automatic retries because a timed-out workflow may still save a lesson.

## Workflow inspection, 7 November 2026

Editor: https://likeclockwork.app.n8n.cloud/workflow/DCG0SwXgAMrIyMaM

The editor displayed Publish and a disabled Unpublish option: unpublished at
inspection. No workflow settings were changed. The Respond Lesson Created node
returns `lesson_id` and `status`; its fallback is `status: failed` plus an error.
The save branch stores a draft. No topics are returned, so the upload page shows
only the saved receipt. Other pages retain their existing demo data.

## Local test

1. Publish the prepared workflow in n8n after checking its credentials/nodes.
2. In `backend`, install `requirements.txt` and run `python run.py` (port 5000).
3. In `loveable`, install dependencies and run `npm run dev`.
4. Open the Vite URL printed in the terminal and visit `/lecturer/upload`.
5. Choose `tests/2026-11-07-bubble-sort.md`, check the title, and click
   **Upload and prepare lesson**. Expect uploading, waiting, then a saved-draft
   receipt containing a lesson ID. Verify that ID in n8n's execution output.
6. If completion is unconfirmed or times out, check executions before retrying.

## Deployment

The Vite proxy is development-only. Deploy Flask and either reverse-proxy `/api`
to it on the frontend origin, or build the frontend with `VITE_API_BASE_URL`
set to the Flask HTTPS origin (without `/api`). Set backend `FRONTEND_ORIGIN`
to the exact frontend origin for cross-origin operation. Do not point the browser
at n8n directly. Preserve the existing `/api/voice` routing separately.

Allow at least 135 seconds for requests at the hosting/proxy layer and at least
11 MB for multipart bodies. Flask waits up to 120 seconds for n8n. Hosts with
shorter request limits require a future job/status polling API. Existing app
authentication is unchanged; this endpoint does not add lecturer authentication.
Only module content is supported; exam/rubric category fields are rejected.

## Checks

Backend forwarding tests (no AI credentials or pytest required):
`python -m unittest discover -s tests -p test_lesson_upload.py -v` from `backend`.

Frontend service tests: `node --test tests/upload.test.cjs` from `loveable`.
These use TypeScript and Node's test runner, with an in-memory HTTP transport.
They verify file bytes, validation, production URLs, acknowledgements and errors.
The TSX parsing check is not a full type check or browser rendering test.

Live webhook testing was blocked by terminal DNS resolution and the workflow
being unpublished. React/Vite dependencies were absent and unavailable offline,
so a full frontend build, type check and browser test could not run here.
All 8 isolated Flask route tests and 6 frontend service/syntax checks passed.
Starting the full backend app was also blocked by missing `flask_cors`; install
`backend/requirements.txt` before running it. Python compilation and
`git diff --check` passed. These checks do not prove live lesson generation.
