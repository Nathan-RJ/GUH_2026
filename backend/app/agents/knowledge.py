"""The student's knowledge bank: everything the student "knows" (and doesn't).

The student may only reason from this bank. It's built from whatever the
caller provides (how much is provided is the difficulty, decided upstream),
and grows as the user teaches:

    source        kind            what it is                         from
    ------------  --------------  ---------------------------------  ---------------------------
    prerequisite  fact            earlier courses; known confidently  `prerequisites`
    course        fact            parts of this course it already     `known_content`
                                  knows (often none)
    course        misconception   things it wrongly believes          agent_brief.misconceptions
    course        gap             things it explicitly doesn't know   agent_brief.knowledge_gaps
    taught        fact            what it learned from the user       each turn's `learned`

An entry looks like:
    {"id": "p3", "text": "...", "source": "prerequisite", "kind": "fact", ...}
plus `turn` for taught entries, and any extra keys from the input data.

`prerequisites` and `known_content` accept lesson rows (their key points are
used, never the rubric), student_brief-like objects, plain strings, or dicts
with the text under a common key. See lesson.content_points and normalize.

Nothing here calls the AI or saves anything.
"""

from . import lesson as lesson_data

# Keys we'll accept as an item's text.
_TEXT_KEYS = ("text", "fact", "point", "belief", "misconception", "gap", "content", "description", "statement", "name")


def normalize(raw, id_prefix: str) -> list[dict]:
    """Turn a list in any reasonable shape into [{"id": ..., "text": ..., <other keys kept>}].

    Each item may be a string, a dict with the text under one of _TEXT_KEYS,
    or a lesson row / student_brief (expanded into its key points). Items
    without usable text are dropped. Missing ids become "<prefix>1", "<prefix>2"...
    """
    if raw is None:
        return []
    raw = lesson_data._decode(raw)
    if not isinstance(raw, list):
        raw = [raw]

    result = []
    for item in raw:
        for point in lesson_data.content_points(item):
            if isinstance(point, str):
                point = {"text": point}
            text = next((str(point[k]).strip() for k in _TEXT_KEYS if point.get(k)), "")
            if text:
                result.append({**point, "id": str(point.get("id") or f"{id_prefix}{len(result) + 1}"), "text": text})
    return result


def build(*, agent_brief=None, prerequisites=None, known_content=None) -> list[dict]:
    """The student's starting knowledge bank, from exactly what it's given.

    agent_brief     an AgentBrief (or anything lesson.parse_agent_brief accepts):
                    its misconceptions and knowledge_gaps are used
    prerequisites   earlier courses' content: known confidently
    known_content   parts of the current course it already knows
    """
    if not isinstance(agent_brief, lesson_data.AgentBrief):
        agent_brief = lesson_data.parse_agent_brief(agent_brief)
    bank = []
    bank += [{**i, "source": "prerequisite", "kind": "fact"} for i in normalize(prerequisites, "p")]
    bank += [{**i, "source": "course", "kind": "fact"} for i in normalize(known_content, "c")]
    bank += [{**i, "source": "course", "kind": "misconception"} for i in normalize(agent_brief.misconceptions, "m")]
    bank += [{**i, "source": "course", "kind": "gap"} for i in normalize(agent_brief.knowledge_gaps, "g")]
    return bank


def _key(text: str) -> str:
    """Loose form of a statement for spotting duplicates (case, spacing, punctuation)."""
    return " ".join("".join(ch for ch in text.lower() if ch.isalnum() or ch.isspace()).split())


def add_taught(bank: list[dict], texts: list[str], turn: int) -> list[dict]:
    """Record what the student learned from the user this turn. Returns the new entries.

    Statements already in the bank as facts are skipped.
    """
    seen = {_key(k["text"]) for k in bank if k["kind"] == "fact"}
    taught_so_far = sum(1 for k in bank if k["source"] == "taught")
    new = []
    for text in texts or []:
        if not isinstance(text, str) or not text.strip() or _key(text) in seen:
            continue
        seen.add(_key(text))
        new.append({
            "id": f"t{taught_so_far + len(new) + 1}", "text": text.strip(),
            "source": "taught", "kind": "fact", "turn": turn,
        })
    bank.extend(new)
    return new


def misconceptions(bank: list[dict]) -> list[dict]:
    return [k for k in bank if k["kind"] == "misconception"]


def describe(bank: list[dict]) -> str:
    """The bank as prompt text for the student."""
    sections = [
        ("prerequisite", "fact", "From earlier courses (you know these well and are confident about them)"),
        ("course", "fact", "About this topic (you already know these)"),
        ("taught", "fact", "Learned from your tutor in this session (you know these now)"),
        ("course", "misconception",
         "About this topic (you believe these, but you're not sure; they're wrong, though you don't know that)"),
        ("course", "gap", "About this topic (you DON'T know these yet; this is what you need to be taught)"),
    ]
    parts = []
    for source, kind, heading in sections:
        items = [k["text"] for k in bank if k["source"] == source and k["kind"] == kind]
        if items:
            parts.append(heading + ":\n" + "\n".join(f"- {text}" for text in items))
    return "\n\n".join(parts) or "(nothing: you're completely new to this subject)"
