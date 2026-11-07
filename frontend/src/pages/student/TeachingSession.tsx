// src/pages/student/TeachingSession.tsx
// ------------------------------------------------------------------
// THE MAIN GAME SCREEN.
//
// Layout idea:
//   left  - ChatWindow: the conversation with the confused AI student,
//           with a text box and a VoiceButton
//   right - ConceptMap: the AI student's "brain", where misconceptions
//           show red and turn green once properly explained away
//   top   - understanding bar + "I'm done teaching - take the exam" button
//
// Uses the useSession hook for all the state and API calls.
// The exam button calls takeExam, then goes to ExamResults.
// ------------------------------------------------------------------
