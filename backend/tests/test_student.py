"""The student agent, its knowledge bank, and reading real lesson data.

Uses a real lesson row from the n8n Prepare Lesson workflow (fixtures/).
The OpenAI call (llm.chat) is faked, so no API key is needed.
"""

import json
from pathlib import Path

import pytest

from app import create_app
from app.agents import knowledge, lesson, llm, student
from app.services import store

LESSON_ROWS = json.loads((Path(__file__).parent / "fixtures" / "bubble_sort_lesson.json").read_text())
LESSON = LESSON_ROWS[0]
AGENT_BRIEF = json.loads(LESSON["agent_brief"])
KEY_POINTS = json.loads(LESSON["student_brief"])["key_points"]

PREREQ_LESSON = {
    "id": "prereq-1",
    "title": "Lists",
    "source_text": "unused when key points exist",
    "student_brief": json.dumps({"topic": "Lists", "key_points": ["A list holds values in order.", "Each value has an index."]}),
    "rubric": json.dumps({"criteria": [{"source_reference": "SECRET RUBRIC TEXT"}]}),
}


@pytest.fixture
def app(tmp_path):
    return create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path)})


@pytest.fixture
def client(app):
    return app.test_client()


def _of(bank, source, kind="fact"):
    return [k["text"] for k in bank if k["source"] == source and k["kind"] == kind]


def _fake_chat(monkeypatch, result):
    sent = {}

    def fake(messages, **kwargs):
        sent["messages"], sent["kwargs"] = messages, kwargs
        return result

    monkeypatch.setattr(llm, "chat", fake)
    return sent


# ---------- reading lesson data ----------

@pytest.mark.parametrize("raw", [
    LESSON_ROWS,                    # as Supabase returns it
    LESSON,                         # one row
    json.dumps(LESSON_ROWS),        # as a JSON string
    AGENT_BRIEF,                    # just the agent_brief
    LESSON["agent_brief"],          # agent_brief as a JSON string
])
def test_parse_agent_brief_accepts_any_form(raw):
    brief = lesson.parse_agent_brief(raw)
    assert brief.topic == "Bubble sort"
    assert brief.opening_line.startswith("I'm confused about bubble sort")
    assert len(brief.misconceptions) == 4
    assert len(brief.knowledge_gaps) == 4
    assert len(brief.behaviour_rules) == 6
    assert len(brief.questions_to_ask) == 5


def test_parse_agent_brief_missing_is_empty():
    for raw in (None, "", {}, [], "not json"):
        assert lesson.parse_agent_brief(raw) == lesson.AgentBrief()


def test_content_points_uses_key_points_never_rubric():
    assert lesson.content_points(PREREQ_LESSON) == ["A list holds values in order.", "Each value has an index."]
    assert lesson.content_points(LESSON) == KEY_POINTS


def test_content_points_falls_back_to_source_text():
    row = {"source_text": "First paragraph.\n\nSecond paragraph.", "student_brief": "{}"}
    assert lesson.content_points(row) == ["First paragraph.", "Second paragraph."]


# ---------- building the knowledge bank ----------

def test_build_from_lesson_only_has_misconceptions_and_gaps():
    bank = knowledge.build(agent_brief=LESSON)
    assert _of(bank, "course", "misconception") == AGENT_BRIEF["misconceptions"]
    assert _of(bank, "course", "gap") == AGENT_BRIEF["knowledge_gaps"]
    assert _of(bank, "course") == [] and _of(bank, "prerequisite") == []
    # Nothing from the answers made it in
    assert not any(point in k["text"] for k in bank for point in KEY_POINTS)


def test_build_uses_exactly_what_it_is_given():
    bank = knowledge.build(
        agent_brief=LESSON,
        prerequisites=[PREREQ_LESSON, "A loop repeats code."],
        known_content=["Bubble sort sorts a list into ascending order."],
    )
    assert _of(bank, "prerequisite") == ["A list holds values in order.", "Each value has an index.", "A loop repeats code."]
    assert _of(bank, "course") == ["Bubble sort sorts a list into ascending order."]
    assert all("SECRET RUBRIC TEXT" not in k["text"] for k in bank)


def test_build_with_nothing_is_empty():
    assert knowledge.build() == []
    assert "completely new" in knowledge.describe([])


def test_add_taught_numbers_and_skips_known_facts():
    bank = knowledge.build(prerequisites=["A loop repeats code."], agent_brief=LESSON)
    knowledge.add_taught(bank, ["Compare adjacent elements.", "  ", 5], turn=1)
    new = knowledge.add_taught(bank, ["compare adjacent elements", "a loop repeats code!", "Swap if left > right."], turn=2)
    assert [(k["id"], k["turn"], k["text"]) for k in new] == [("t2", 2, "Swap if left > right.")]
    assert _of(bank, "taught") == ["Compare adjacent elements.", "Swap if left > right."]


def test_describe_orders_known_before_unknown():
    bank = knowledge.build(agent_brief=LESSON, prerequisites=["P fact"], known_content=["C fact"])
    knowledge.add_taught(bank, ["T fact"], turn=1)
    text = knowledge.describe(bank)
    markers = ["- P fact", "- C fact", "- T fact", AGENT_BRIEF["misconceptions"][0], AGENT_BRIEF["knowledge_gaps"][0]]
    positions = [text.index(m) for m in markers]
    assert positions == sorted(positions)
    assert "DON'T know these yet" in text


# ---------- the student prompt ----------

def test_prompt_has_brief_and_knowledge_but_no_answers():
    brief = lesson.parse_agent_brief(LESSON)
    prompt = student.system_prompt(brief, knowledge.build(agent_brief=brief, prerequisites=["A loop repeats code."]))
    assert brief.persona in prompt
    assert "THE KNOWLEDGE BOUNDARY" in prompt
    assert "- A loop repeats code." in prompt
    for item in brief.misconceptions + brief.knowledge_gaps + brief.behaviour_rules + brief.questions_to_ask:
        assert item in prompt
    # The answers (student_brief key points, rubric) are never in the student's prompt
    assert "greater than the right value" not in prompt
    assert "n-1 passes" not in prompt
    assert "Topic: Bubble sort" in prompt


def test_prompt_without_brief_still_works():
    prompt = student.system_prompt(lesson.AgentBrief(), [])
    assert "completely new" in prompt
    assert "Rules for this lesson" not in prompt


# ---------- opening / respond ----------

def test_opening_uses_the_lessons_opening_line(monkeypatch):
    def no_ai(*_, **__):
        raise AssertionError("should not call the AI")

    monkeypatch.setattr(llm, "chat", no_ai)
    brief = lesson.parse_agent_brief(LESSON)
    assert student.opening(brief, []) == AGENT_BRIEF["opening_line"]


def test_respond_is_self_contained(monkeypatch):
    """No Flask app, no session: data in, reply out."""
    sent = _fake_chat(monkeypatch, {"reply": "So I only compare neighbours?", "learned": ["Compare adjacent elements."]})
    brief = lesson.parse_agent_brief(LESSON)
    transcript = [  # the n8n transcript format
        {"speaker": "assistant", "text": AGENT_BRIEF["opening_line"]},
        {"speaker": "user", "text": "Hi!"},
        {"speaker": "assistant", "text": "Hi, can you help?"},
    ]
    result = student.respond(brief, knowledge.build(agent_brief=brief), transcript, "Compare adjacent elements.")

    assert result.to_dict() == {"reply": "So I only compare neighbours?", "learned": ["Compare adjacent elements."], "status": "ok"}
    assert sent["kwargs"]["json_mode"] is True
    roles = [m["role"] for m in sent["messages"]]
    assert roles == ["system", "system", "assistant", "user", "assistant", "user"]
    assert sent["messages"][-1]["content"] == "Compare adjacent elements."


def test_respond_handles_ai_failure(monkeypatch):
    def broken(*_, **__):
        raise llm.AIError("boom")

    monkeypatch.setattr(llm, "chat", broken)
    result = student.respond(lesson.AgentBrief(), [], [], "hi")
    assert (result.reply, result.learned, result.status) == (student.FAILED_REPLY, [], "failed")


def test_respond_handles_reply_missing_from_json(monkeypatch):
    _fake_chat(monkeypatch, {"learned": ["x"]})
    result = student.respond(lesson.AgentBrief(), [], [], "hi")
    assert (result.status, result.learned) == ("failed", [])


def test_respond_placeholder_without_ai(monkeypatch):
    _fake_chat(monkeypatch, None)
    result = student.respond(lesson.AgentBrief(), [], [], "hi")
    assert result.status == "placeholder"


# ---------- the session API (thin wrapper around the student) ----------

def _create(client, **fields):
    data = {k: json.dumps(v) if not isinstance(v, str) else v for k, v in fields.items()}
    return client.post("/api/sessions", data=data, content_type="multipart/form-data")


def test_session_from_lesson(client):
    res = _create(client, lesson=LESSON_ROWS, prerequisites=[PREREQ_LESSON])
    assert res.status_code == 201
    body = res.get_json()
    assert body["messages"][0]["text"] == AGENT_BRIEF["opening_line"]

    session = store.get_session(body["id"])
    assert session["brief"]["topic"] == "Bubble sort"
    assert len(knowledge.misconceptions(session["knowledge"])) == 4
    assert _of(session["knowledge"], "prerequisite") == ["A list holds values in order.", "Each value has an index."]
    for key in store.BACKEND_ONLY:  # never sent to the webpage
        assert key not in body
        assert key not in client.get(f"/api/sessions/{body['id']}").get_json()


def test_teaching_adds_to_knowledge_bank(client, monkeypatch):
    body = _create(client, lesson=LESSON).get_json()
    _fake_chat(monkeypatch, {"reply": "Got it!", "learned": ["Compare adjacent elements from left to right."]})
    client.post(f"/api/sessions/{body['id']}/messages", json={"text": "Compare neighbours, left to right."})

    session = store.get_session(body["id"])
    assert _of(session["knowledge"], "taught") == ["Compare adjacent elements from left to right."]
    turn = session["turns"][0]
    assert (turn["number"], turn["status"], turn["learned"]) == (1, "ok", ["Compare adjacent elements from left to right."])


def test_failed_turn_learns_nothing(client, monkeypatch):
    body = _create(client, lesson=LESSON).get_json()

    def broken(*_, **__):
        raise llm.AIError("boom")

    monkeypatch.setattr(llm, "chat", broken)
    client.post(f"/api/sessions/{body['id']}/messages", json={"text": "Anything"})
    assert _of(store.get_session(body["id"])["knowledge"], "taught") == []


@pytest.mark.parametrize("fields", [
    {"lesson": "not json"},
    {"lesson": "42"},
    {"prerequisites": json.dumps({"a": 1})},
    {"known_content": "[1,"},
])
def test_bad_input_is_rejected(client, fields):
    res = client.post("/api/sessions", data={"prompt": "x", **fields}, content_type="multipart/form-data")
    assert res.status_code == 400
    assert res.get_json()["error"]


def test_needs_prompt_lesson_or_file(client):
    assert client.post("/api/sessions", data={}, content_type="multipart/form-data").status_code == 400
