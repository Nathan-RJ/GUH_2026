# Student lesson catalogue

The student page now calls `service.getStudentModule()` on mount, on window
focus, and through Refresh lessons. Successful uploads invalidate its query.
It no longer displays the demo module as the uploaded lesson catalogue.
The upload success message is "Lesson uploaded successfully." The underlying
database status remains `draft`; Get Lesson already permits non-failed drafts.

## Data path

Student UI -> services/lessons.ts -> GET /api/lessons -> n8n Get Lesson -> database.

The production Get Lesson base URL includes its webhook ID:
`https://likeclockwork.app.n8n.cloud/webhook/70126bb4-d705-4478-ac1f-16c05b931594/reply2me/lesson/`

The workflow `8paqcqhhyCCGoqRD` was updated and published as
**Student lesson catalogue**:

- Validate Lesson ID accepts a UUID or the literal `all`.
- Load Lesson uses Get Many / Return All, with the validated filter expression
  `{{ $json.lesson_id === 'all' ? 'status=neq.failed' : 'id=eq.' + $json.lesson_id }}`.
- Build Public Lesson returns `{lessons: [...]}` for `all`, preserving the
  original object response and 404 behaviour for a UUID.
- Only the existing public fields are returned: lesson ID, title, status,
  student-facing topic, summary, task instructions and learning objectives.
  Rubrics, source text, key-point answers and agent briefs remain excluded.

Live browser verification returned six saved lessons, including Generalisation
new and ProbNotes1&2. The existing Bubble sort test UUID lookup also succeeded.

## Frontend behaviour

The teaching page loads the selected real topic and preserves its lesson ID
for the existing live marking integration. Results use that topic's title.
Learning-objective cards are replaced with the actual criterion IDs returned
by marking. Other contributors' existing simulated dialogue and voice code
are retained; this change does not replace the dialogue engine with the backend
student agent. Teacher dashboard demo analytics are unchanged.

## Running

Restart Flask and Vite, then open `/student`. Use Refresh lessons after an upload
from another browser. Empty and failed catalogue responses have explicit UI
states, with no silent demo fallback. Production requires the same `/api` proxy
or `VITE_API_BASE_URL` configuration documented for uploads.

The live workflow's list and single-item reads were verified. The local build,
TypeScript check and 11 isolated backend tests passed. Terminal DNS access to
n8n remains unavailable, so a complete local browser-to-Flask-to-n8n test was
not possible in this environment.

All 32 frontend tests passed across 8 suites. On this Windows environment the
test runner needed TEMP and TMP pointed at `loveable/node_modules/.test-temp`
to avoid a system temporary-directory permission error.

Changed local files:
- `backend/app/routes/lessons.py`
- `backend/tests/test_lesson_upload.py`
- `loveable/src/routes/lecturer.upload.tsx`
- `loveable/src/routes/student.index.tsx`
- `loveable/src/routes/student.teach.$topicId.tsx`
- `loveable/src/routes/student.results.tsx`
- `loveable/src/services/index.ts`, `mock.ts`, `types.ts`
- `loveable/src/services/lessons.ts`, `lessons.test.ts`
- This document.
