# app/models/session.py
# ------------------------------------------------------------------
# A STUDENT'S TEACHING SESSION
# - TeachingSession    who, which topic, start/end time, status,
#                      escalated flag, final score
# - Message            each chat turn (role: student / ai, text)
# - SessionConcept     live state of each concept/misconception in this
#                      session (red = unfixed, green = fixed/covered)
# - ExamResult         the AI student's answers, marks and feedback
# ------------------------------------------------------------------
