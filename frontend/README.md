# Frontend

React + Vite + TypeScript. Talks to the Flask backend in `../backend`.

```bash
npm install
npm run dev
```

Open http://localhost:5173. Requests to `/api/...` are forwarded to Flask on
port 5000 (see `vite.config.ts`), so start the backend too.

- `src/pages/Home.tsx`     prompt + attachments -> starts a session
- `src/pages/Session.tsx`  the session screen (sidebar + chat). Build the main sections here.
- `src/api.ts`             every call to the backend
- `src/types.ts`           shapes of the backend's JSON
- `src/index.css`          all the styles
