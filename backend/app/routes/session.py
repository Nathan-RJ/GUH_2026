# app/routes/session.py
# ------------------------------------------------------------------
# A TEACHING SESSION in progress (this is the core game loop).
#
# POST /api/sessions/<id>/messages        student sends an explanation
#        1. judge.py checks it against the hidden concept map
#        2. updates which misconceptions are fixed / concepts covered
#        3. student_agent.py writes the AI student's reply
#        -> returns { reply, concept_map_state, understanding_score }
#
# POST /api/sessions/<id>/voice           same as /messages but takes audio
#                                         (speech-to-text first, optional spoken reply)
#
# GET  /api/sessions/<id>/state           current concept map (red/green nodes)
#
# POST /api/sessions/<id>/exam            end teaching: the AI student sits the exam
#                                         and is marked against the hidden rubric
#                                         -> returns { score }
#
# GET  /api/sessions/<id>/feedback        topic-level feedback for the student
#                                         (never reveals exam questions)
# ------------------------------------------------------------------
