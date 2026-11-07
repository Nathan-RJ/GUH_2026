# app/services/student_agent.py
# ------------------------------------------------------------------
# The confused AI STUDENT that the real student teaches.
#
# - reply(session, message)   builds the prompt from:
#       * the persona (ai/prompts/student.py)
#       * ONLY what the student has taught so far (chat history)
#       * the misconceptions it still holds (it clings to these until
#         they are properly explained away)
#   and returns a naive follow-up question or an attempt to explain back.
#
# KEY RULE: it must not use its own general knowledge, only what it
# has been taught. This is what makes the game work.
# ------------------------------------------------------------------
