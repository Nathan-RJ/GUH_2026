// src/api/student.ts
// ------------------------------------------------------------------
// Calls for the STUDENT picking what to teach
// (mirrors backend/app/routes/student.py).
//
// - getModules()                      GET  /api/modules
// - getTopics(moduleId)               GET  /api/modules/:id/topics
// - startSession(topicId)             POST /api/sessions
//                                     -> { sessionId, openingMessage }
// ------------------------------------------------------------------
