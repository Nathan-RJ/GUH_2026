# app/services/judge.py
# ------------------------------------------------------------------
# The hidden JUDGE: runs on every student message, never seen by the student.
#
# - evaluate(session, message)   compares the explanation to the concept
#                                map and returns structured JSON:
#       { concepts_covered: [...], misconceptions_fixed: [...],
#         new_misconceptions: [...], vague: true/false }
# - Updates the session state (this is what turns map nodes red -> green)
# - Flags a session for lecturer review (escalation) if something looks
#   off, e.g. abuse or the student being badly stuck
# ------------------------------------------------------------------
