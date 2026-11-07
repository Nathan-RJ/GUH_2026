"""What the student starts with, read from a new session's request.

The real data comes from the n8n workflows (lesson rows in Supabase). Here it
can be passed to POST /api/sessions as optional JSON form fields, so the
student can be run and tested on its own. How much is passed in is the
difficulty; nothing here picks or trims.

Form fields (all optional, JSON):
    lesson         the lesson being taught: a lesson row (or [row], as Supabase
                   returns it) or just its agent_brief. Only agent_brief is used.
    prerequisites  list: earlier courses' content (lesson rows, key points, strings)
    known_content  list: parts of this course the student already knows
"""

import json
from dataclasses import dataclass, field


class InputError(ValueError):
    """Bad form field; the message is safe to show the user."""


@dataclass
class StudentInputs:
    lesson: object = None
    prerequisites: list = field(default_factory=list)
    known_content: list = field(default_factory=list)


def _json(form, name: str, *, expect_list: bool):
    raw = form.get(name)
    if not raw:
        return [] if expect_list else None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        raise InputError(f"{name} must be valid JSON.") from None
    if expect_list and not isinstance(value, list):
        raise InputError(f"{name} must be a JSON list.")
    if not expect_list and not isinstance(value, (dict, list)):
        raise InputError(f"{name} must be a JSON object (a lesson row or agent_brief).")
    return value


def read(form) -> StudentInputs:
    """Read the student's inputs from a request form. Raises InputError."""
    return StudentInputs(
        lesson=_json(form, "lesson", expect_list=False),
        prerequisites=_json(form, "prerequisites", expect_list=True),
        known_content=_json(form, "known_content", expect_list=True),
    )
