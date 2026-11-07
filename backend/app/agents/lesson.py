"""Reading the lesson data produced by the n8n "Prepare Lesson" workflow.

A lesson row (Supabase `lessons` table) looks like:

    {"id", "title", "status", "source_path", "source_text",
     "student_brief": "<JSON string>", "agent_brief": "<JSON string>",
     "rubric": "<JSON string>", "created_at"}

For the lesson being taught, the student only ever reads `agent_brief`.
`source_text`, `student_brief` (key points) and `rubric` contain the answers,
so `parse_agent_brief` never looks at them.

For prerequisite lessons (and course content the student is allowed to know),
`content_points` reads the content: `student_brief.key_points`, falling back
to the summary, then `source_text` paragraphs. Never the rubric.

The JSON fields may arrive as strings or already-decoded objects; both work.
"""

import json
from dataclasses import asdict, dataclass, field


@dataclass
class AgentBrief:
    """How the AI student should behave for one lesson (from `agent_brief`)."""

    topic: str = ""
    persona: str = ""
    opening_line: str = ""
    knowledge_gaps: list = field(default_factory=list)  # things it doesn't know yet
    misconceptions: list = field(default_factory=list)  # things it wrongly believes
    behaviour_rules: list = field(default_factory=list)
    questions_to_ask: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _decode(value):
    """JSON string -> object; anything else is returned unchanged."""
    if isinstance(value, str):
        stripped = value.strip()
        if stripped[:1] in ("{", "["):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass
    return value


def _strings(value) -> list:
    """A list of non-empty items; a single string becomes a one-item list."""
    value = _decode(value)
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    return [v for v in value if (isinstance(v, str) and v.strip()) or isinstance(v, dict)]


def _first_row(value):
    """Supabase returns rows as a list; accept a single row too."""
    value = _decode(value)
    if isinstance(value, list) and value and isinstance(value[0], dict):
        return value[0]
    return value


def parse_agent_brief(raw) -> AgentBrief:
    """An AgentBrief from a lesson row, an agent_brief object, or either as JSON. Missing -> empty."""
    data = _first_row(raw)
    if isinstance(data, dict) and "agent_brief" in data:  # a whole lesson row: use ONLY agent_brief
        data = _decode(data["agent_brief"])
    if not isinstance(data, dict):
        return AgentBrief()
    return AgentBrief(
        topic=str(data.get("topic") or "").strip(),
        persona=str(data.get("persona") or "").strip(),
        opening_line=str(data.get("opening_line") or "").strip(),
        knowledge_gaps=_strings(data.get("knowledge_gaps")),
        misconceptions=_strings(data.get("misconceptions")),
        behaviour_rules=_strings(data.get("behaviour_rules")),
        questions_to_ask=_strings(data.get("questions_to_ask")),
    )


def content_points(item) -> list:
    """The teachable content of one item, as a list of statements (strings or dicts).

    - plain string                     -> [string]
    - lesson row                       -> its student_brief key points (or summary,
                                          or source_text paragraphs); never the rubric
    - student_brief-like {"key_points"} -> the key points
    - any other dict                   -> [dict] (knowledge.normalize finds its text)
    """
    item = _decode(item)
    if isinstance(item, str):
        return [item] if item.strip() else []
    if not isinstance(item, dict):
        return []

    if "student_brief" in item or "source_text" in item:  # a lesson row
        brief = _decode(item.get("student_brief"))
        points = _brief_points(brief) if isinstance(brief, dict) else []
        if points:
            return points
        text = item.get("source_text") or ""
        return [p.strip() for p in str(text).split("\n\n") if p.strip()]

    if "key_points" in item:
        return _brief_points(item)

    return [item]


def _brief_points(brief: dict) -> list:
    """A student_brief's key points, else its summary, else nothing."""
    points = _strings(brief.get("key_points"))
    if points:
        return points
    return [brief["summary"]] if isinstance(brief.get("summary"), str) and brief["summary"].strip() else []
