# app/services/exam.py
# ------------------------------------------------------------------
# The FINAL EXAM the AI student sits at the end of a session.
#
# - build_exam(topic)        short exam built from the lecturer's content
#                            and past papers (kept hidden from students)
# - sit_exam(session)        the AI student answers using ONLY what it
#                            was taught in this session
# - mark_exam(answers)       marked against the hidden rubric
#                            -> the AI's mark = the real student's score
# ------------------------------------------------------------------
