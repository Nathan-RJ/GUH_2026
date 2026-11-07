# app/routes/lecturer.py
# ------------------------------------------------------------------
# LECTURER SIDE of the app.
#
# POST /api/modules                       create a module (name, code)
# POST /api/modules/<id>/documents        upload slides / notes / past papers
# POST /api/modules/<id>/rubric           upload the marking rubric (HIDDEN from students)
# POST /api/modules/<id>/build            run ingestion -> concept map -> misconception bank
# GET  /api/modules/<id>/concept-map      view the generated concept map
# GET  /api/modules/<id>/dashboard        cohort stats: most common unfixed
#                                         misconceptions, weak topics, escalated sessions
# GET  /api/sessions/<id>/review          read an escalated session in full
# ------------------------------------------------------------------
