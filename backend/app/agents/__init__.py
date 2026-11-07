"""AI agents.

- student.py  the confused student the user teaches
- teacher.py  reviews each turn (the user's explanation + the student's reply)
- llm.py      shared OpenAI client and course-material loading

One teaching turn is: explanation -> student.respond -> teacher.review.
routes/sessions.py runs it and stores the results.
"""

from . import student, teacher  # noqa: F401
