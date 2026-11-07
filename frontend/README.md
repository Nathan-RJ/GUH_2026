# Frontend

React + Vite + TypeScript + Tailwind. Talks to the Flask backend in `../backend`.

## Run it (once the code is written)

```bash
npm install
npm run dev
```

Opens on http://localhost:5173. Any request to `/api/...` is proxied to Flask
on http://localhost:5000 (see `vite.config.ts`), so start the backend too.

## How it is organised

- `src/pages/`       one file per screen (student side + lecturer side)
- `src/components/`  reusable pieces used by the pages
- `src/api/`         the ONLY place that calls the backend (mirrors backend/app/routes)
- `src/types/`       TypeScript shapes of the JSON the backend sends back
- `src/hooks/`       stateful logic (running a session, recording voice)
- `src/context/`     app-wide state (who is logged in, student or lecturer)
- `src/lib/mockData.ts` fake backend responses so the UI can be built before Flask works

Each file starts with a comment saying what it is for.
