"""What the student starts with, read from a new session's request.

PLACEHOLDER SOURCES: the real prerequisite knowledge, course content and
misconception bank will come from elsewhere (parsed from the lecturer's
uploads). Until then they can be passed to POST /api/sessions as optional
JSON-list form fields. When the real sources exist, change `read()` to load
them; the formats are normalised in agents/knowledge.py `normalize`.

Form fields (all optional):
    prerequisites        JSON list: knowledge from earlier courses
    course_content       JSON list: the current course's content
    course_knowledge     0-1: share of course_content the student already knows
                         (default STUDENT_COURSE_KNOWLEDGE)
    misconceptions       JSON list: the misconception bank
    misconception_count  0-20: how many misconceptions the student believes
                         (default STUDENT_MISCONCEPTIONS)
"""

import json
from dataclasses import dataclass, field

MAX_MISCONCEPTION_COUNT = 20


class InputError(ValueError):
    """Bad form field; the message is safe to show the user."""


@dataclass
class StudentInputs:
    prerequisites: list = field(default_factory=list)
    course_content: list = field(default_factory=list)
    course_knowledge: float = 0.0
    misconceptions: list = field(default_factory=list)
    misconception_count: int = 0


def _json_list(form, name: str) -> list:
    raw = form.get(name)
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        value = None
    if not isinstance(value, list):
        raise InputError(f"{name} must be a JSON list.")
    return value


def _number(form, name: str, default, cast, low, high, description: str):
    raw = form.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = cast(raw)
    except ValueError:
        value = None
    if value is None or not low <= value <= high:
        raise InputError(f"{name} must be {description}.")
    return value


def read(form, config) -> StudentInputs:
    """Read the student's inputs from a request form. Raises InputError."""
    return StudentInputs(
        prerequisites=_json_list(form, "prerequisites"),
        course_content=_json_list(form, "course_content"),
        course_knowledge=_number(
            form, "course_knowledge", config["STUDENT_COURSE_KNOWLEDGE"], float, 0.0, 1.0,
            "a number from 0 to 1",
        ),
        misconceptions=_json_list(form, "misconceptions"),
        misconception_count=_number(
            form, "misconception_count", config["STUDENT_MISCONCEPTIONS"], int, 0, MAX_MISCONCEPTION_COUNT,
            f"a whole number from 0 to {MAX_MISCONCEPTION_COUNT}",
        ),
    )
