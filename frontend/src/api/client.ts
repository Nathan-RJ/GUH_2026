// src/api/client.ts
// ------------------------------------------------------------------
// One small fetch wrapper that every other api/ file uses.
//
// - get(path) / post(path, body) / upload(path, file)
// - Prefixes VITE_API_URL in production (empty in dev, the Vite proxy handles it)
// - Turns error responses into thrown errors with a readable message
// - USE_MOCKS flag: when true, return data from lib/mockData.ts instead,
//   so the UI can be built before the backend works
// ------------------------------------------------------------------
