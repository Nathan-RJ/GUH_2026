// src/hooks/useSession.ts
// ------------------------------------------------------------------
// All the state + logic for a teaching session, so the
// TeachingSession page stays simple.
//
// Holds: messages, conceptMapState, understandingScore, isWaiting, error
// Provides:
// - send(text)     adds your message right away, calls
//                  api/session.sendMessage, then adds the AI reply and
//                  updates the concept map
// - sendAudio(blob)  the same, but via voice
// - finish()       calls takeExam and returns the score
// Loads the existing session state on page refresh (getState).
// ------------------------------------------------------------------
