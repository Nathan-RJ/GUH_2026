"""The teacher agent: reviews each teaching turn behind the scenes.

After the student replies, the teacher looks at the user's explanation and
the student's response, checks them against the hidden course material, and
returns a structured review:

    review(session, explanation, student_reply) -> dict

    {
      "score": 0-10,              how good the user's explanation was
      "correct": true/false,      was the explanation factually right?
      "feedback": "...",          one or two sentences of advice for the user
      "student_understanding": "...", what the student now seems to believe
      "misconceptions": [         the student's misconceptions so far
        {"name": "...", "status": "open" | "fixed"}
      ],
      "concepts_covered": ["..."] concepts the user has explained so far
    }

It never returns None: with the AI off it returns a placeholder review.
"""

from . import llm

SYSTEM_PROMPT = """\
You are an experienced university lecturer quietly observing a "learning by
teaching" session. A user (the tutor) is teaching a topic to an AI student
who started with some misconceptions. You do not talk to either of them.

After each turn, review the tutor's latest explanation and the student's
response, using the whole conversation for context. Judge the explanation
against the course material below when there is some (it is the answer key),
otherwise against standard university-level knowledge of the topic.

Reply with JSON only, exactly in this shape:
{{
  "score": <integer 0-10: accuracy, clarity and depth of the latest explanation>,
  "correct": <true if the latest explanation was factually correct, else false>,
  "feedback": "<1-2 sentences of specific advice to the tutor; mention any error they made>",
  "student_understanding": "<1 sentence: what the student now seems to believe>",
  "misconceptions": [{{"name": "<short label>", "status": "open" or "fixed"}}],
  "concepts_covered": ["<short label of each concept the tutor has explained so far>"]
}}

"misconceptions" lists every misconception the student has shown in the
whole conversation, keeping the same labels across turns. Mark one "fixed"
only once the tutor has clearly explained it away and the student accepted it.
Don't reveal or quote exam questions in the feedback.

Topic: {topic}
{material}"""

PLACEHOLDER = {
    "score": None,
    "correct": None,
    "feedback": "(Placeholder review: set OPEN_API in backend/.env to connect the teacher agent.)",
    "student_understanding": "",
    "misconceptions": [],
    "concepts_covered": [],
}


def _transcript(session: dict, explanation: str, student_reply: str) -> str:
    lines = []
    for m in session["messages"]:
        speaker = "TUTOR" if m["role"] == "user" else "STUDENT"
        lines.append(f"{speaker}: {m['text']}")
    lines.append(f"TUTOR (latest explanation): {explanation}")
    lines.append(f"STUDENT (latest response): {student_reply}")
    return "\n\n".join(lines)


def _clean(raw: dict) -> dict:
    """Make sure the frontend always gets the documented shape."""
    score = raw.get("score")
    misconceptions = [
        {"name": str(m.get("name", "")), "status": "fixed" if m.get("status") == "fixed" else "open"}
        for m in raw.get("misconceptions") or []
        if isinstance(m, dict) and m.get("name")
    ]
    return {
        "score": max(0, min(10, int(score))) if isinstance(score, (int, float)) else None,
        "correct": raw.get("correct") if isinstance(raw.get("correct"), bool) else None,
        "feedback": str(raw.get("feedback") or ""),
        "student_understanding": str(raw.get("student_understanding") or ""),
        "misconceptions": misconceptions,
        "concepts_covered": [str(c) for c in raw.get("concepts_covered") or []],
    }


def review(session: dict, explanation: str, student_reply: str) -> dict:
    """Review one teaching turn. `session["messages"]` is the history before this turn."""
    material = llm.course_material(session)
    system = SYSTEM_PROMPT.format(
        topic=llm.topic(session),
        material=f"\nCourse material (answer key):\n{material}" if material else "",
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": _transcript(session, explanation, student_reply)},
    ]
    try:
        raw = llm.chat(messages, json_mode=True, temperature=0.2, max_tokens=600)
    except llm.AIError:
        return {**PLACEHOLDER, "feedback": "(The teacher couldn't review this turn: the AI request failed.)"}
    if raw is None:
        return dict(PLACEHOLDER)
    return _clean(raw)
