// src/types/index.ts
// ------------------------------------------------------------------
// TypeScript shapes of the JSON the backend sends back.
// THIS IS THE CONTRACT between frontend and backend: agree on it as a
// team first, and keep it in sync with backend/app/models/.
//
// - User            { id, name, role: "student" | "lecturer" }
// - Module          { id, name, code }
// - Topic           { id, moduleId, name }
// - ConceptNode     { id, label, status: "unknown" | "covered" }
// - Misconception   { id, conceptId, text, status: "held" | "fixed" }
// - ConceptMapState { nodes: ConceptNode[], misconceptions: Misconception[], links }
// - Message         { role: "student" | "ai", text, createdAt }
// - Session         { id, topicId, messages, status, understandingScore }
// - ExamResult      { score, maxScore }
// - Feedback        { unfixedMisconceptions, uncoveredConcepts, vagueAreas }
// - DashboardStats  { hardestMisconceptions, topicScores, escalatedSessions }
// ------------------------------------------------------------------
