"""The student's knowledge bank: everything the student "knows".

The student may only reason from this bank. It's built when a session
starts and grows as the user teaches:

    source        kind            what it is
    ------------  --------------  ----------------------------------------------
    prerequisite  fact            earlier courses' content (e.g. COURSE1 for
                                  COURSE2); the student is confident about it
    course        fact            a random share of the current course's content
                                  (0 = knows none of it, 1 = knows all of it)
    course        misconception   a random selection from the misconception bank:
                                  things it wrongly believes about the course
    taught        fact            what it learned from the user, turn by turn

An entry looks like:
    {"id": "k3", "text": "...", "source": "course", "kind": "fact", ...}
plus `turn` for taught entries, and any extra keys from the input data.

The input formats (prerequisites, course content, misconception bank) aren't
decided yet. `normalize` accepts plain strings or dicts; adapt it when the
real formats are known.

Nothing here calls the AI or saves anything: the student agent reads and
extends the bank, and the store keeps it on the session (session["knowledge"]).
"""

import random

# Keys we'll accept as an item's text until the real formats are decided.
_TEXT_KEYS = ("text", "fact", "belief", "misconception", "content", "description", "statement", "name")


def normalize(raw, id_prefix: str) -> list[dict]:
    """Turn a list in any reasonable shape into [{"id": ..., "text": ..., <other keys kept>}].

    Accepts strings, or dicts with the text under one of _TEXT_KEYS. Items
    without usable text are dropped. Missing ids become "<prefix>1", "<prefix>2"...
    """
    result = []
    for index, item in enumerate(raw or [], start=1):
        if isinstance(item, str):
            item = {"text": item}
        if not isinstance(item, dict):
            continue
        text = next((str(item[k]).strip() for k in _TEXT_KEYS if item.get(k)), "")
        if not text:
            continue
        result.append({**item, "id": str(item.get("id") or f"{id_prefix}{index}"), "text": text})
    return result


def pick(items: list[dict], count: int, rng: random.Random | None = None) -> list[dict]:
    """`count` items at random, no repeats (fewer if there aren't enough)."""
    count = max(0, min(int(count), len(items)))
    return (rng or random).sample(items, count)


def build(
    *,
    prerequisites=None,
    course_content=None,
    course_knowledge: float = 0.0,
    misconceptions=None,
    misconception_count: int = 0,
    rng: random.Random | None = None,
) -> list[dict]:
    """The student's starting knowledge bank.

    prerequisites        all of it is known, confidently
    course_content       a random `course_knowledge` share (0-1) of it is known
    misconceptions       the misconception bank; `misconception_count` are believed
    """
    rng = rng or random
    course = normalize(course_content, "c")
    bank = []
    bank += [{**item, "source": "prerequisite", "kind": "fact"} for item in normalize(prerequisites, "p")]
    bank += [
        {**item, "source": "course", "kind": "fact"}
        for item in pick(course, round(len(course) * course_knowledge), rng)
    ]
    bank += [
        {**item, "source": "course", "kind": "misconception"}
        for item in pick(normalize(misconceptions, "m"), misconception_count, rng)
    ]
    return bank


def _key(text: str) -> str:
    """Loose form of a statement for spotting duplicates (case, spacing, punctuation)."""
    return " ".join("".join(ch for ch in text.lower() if ch.isalnum() or ch.isspace()).split())


def add_taught(bank: list[dict], texts: list[str], turn: int) -> list[dict]:
    """Record what the student learned from the user this turn. Returns the new entries.

    Statements already in the bank (from any source) are skipped.
    """
    seen = {_key(k["text"]) for k in bank}
    taught_so_far = sum(1 for k in bank if k["source"] == "taught")
    new = []
    for text in texts:
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
        ("prerequisite", "fact", "From earlier courses (you're confident about these)"),
        ("course", "fact", "About this course (you already know these)"),
        ("course", "misconception",
         "About this course (you sincerely believe these; they're wrong but you don't know that)"),
        ("taught", "fact", "Learned from your tutor in this session"),
    ]
    parts = []
    for source, kind, heading in sections:
        items = [k["text"] for k in bank if k["source"] == source and k["kind"] == kind]
        if items:
            parts.append(heading + ":\n" + "\n".join(f"- {text}" for text in items))
    return "\n\n".join(parts) or "(nothing yet: you're completely new to this topic)"
