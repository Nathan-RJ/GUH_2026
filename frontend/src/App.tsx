// src/App.tsx
// ------------------------------------------------------------------
// The page ROUTES (which URL shows which page).
//
//   /                                  Landing (choose student or lecturer)
//
//   STUDENT
//   /student                           ModulePicker
//   /student/modules/:moduleId         TopicPicker
//   /student/sessions/:sessionId       TeachingSession   <- the main game screen
//   /student/sessions/:sessionId/results  ExamResults
//
//   LECTURER
//   /lecturer                          LecturerHome (their modules)
//   /lecturer/modules/:moduleId/setup  ModuleSetup (upload content + rubric)
//   /lecturer/modules/:moduleId/map    ConceptMapReview
//   /lecturer/modules/:moduleId/dashboard  Dashboard
//   /lecturer/sessions/:sessionId      SessionReview (escalated sessions)
// ------------------------------------------------------------------
