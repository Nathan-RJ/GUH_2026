# app/routes/student.py
# ------------------------------------------------------------------
# STUDENT SIDE: picking what to teach.
#
# GET  /api/modules                       list available modules
# GET  /api/modules/<id>/topics           list topics in a module
# POST /api/sessions                      start a teaching session on a topic
#                                         -> creates an AI student seeded with
#                                            misconceptions from that topic's bank
#                                         -> returns session_id + the AI student's opening line
# ------------------------------------------------------------------
