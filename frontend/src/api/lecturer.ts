// src/api/lecturer.ts
// ------------------------------------------------------------------
// Calls for the LECTURER side (mirrors backend/app/routes/lecturer.py).
//
// - createModule(name, code)          POST /api/modules
// - uploadDocument(moduleId, file)    POST /api/modules/:id/documents
// - uploadRubric(moduleId, file)      POST /api/modules/:id/rubric
// - buildModule(moduleId)             POST /api/modules/:id/build
// - getConceptMap(moduleId)           GET  /api/modules/:id/concept-map
// - getDashboard(moduleId)            GET  /api/modules/:id/dashboard
// - getSessionReview(sessionId)       GET  /api/sessions/:id/review
// ------------------------------------------------------------------
