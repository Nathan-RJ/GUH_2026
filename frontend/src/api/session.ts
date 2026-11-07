// src/api/session.ts
// ------------------------------------------------------------------
// Calls for a TEACHING SESSION in progress
// (mirrors backend/app/routes/session.py).
//
// - sendMessage(sessionId, text)      POST /api/sessions/:id/messages
//                                     -> { reply, conceptMapState, understandingScore }
// - sendVoice(sessionId, audioBlob)   POST /api/sessions/:id/voice
// - getState(sessionId)               GET  /api/sessions/:id/state
// - takeExam(sessionId)               POST /api/sessions/:id/exam  -> { score }
// - getFeedback(sessionId)            GET  /api/sessions/:id/feedback
// ------------------------------------------------------------------
