"""The student's knowledge bank: building it, growing it, and how the student uses it."""

import json
import random

import pytest

from app import create_app
from app.agents import knowledge, llm, student
from app.services import store

PREREQS = ["A function can call other functions", {"fact": "Each function call gets its own stack frame"}]
COURSE = [f"Course fact {i}" for i in range(1, 11)]
MISCONCEPTIONS = [
    "Recursion is just a loop",
    "A base case is optional",
    {"id": "slow", "belief": "Recursion is always slower than iteration", "topic": "performance"},
    {"description": "Each call shares the same local variables"},
]


@pytest.fixture
def app(tmp_path):
    return create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path)})


@pytest.fixture
def client(app):
    return app.test_client()


def _create(client, **fields):
    data = {"prompt": "Recursion", **{k: json.dumps(v) if isinstance(v, list) else v for k, v in fields.items()}}
    return client.post("/api/sessions", data=data, content_type="multipart/form-data")


def _of(bank, source, kind="fact"):
    return [k for k in bank if k["source"] == source and k["kind"] == kind]


# ---------- normalize / pick ----------

def test_normalize_accepts_strings_and_dicts():
    result = knowledge.normalize(MISCONCEPTIONS + [{"no_text": 1}, 42, ""], "m")
    assert [m["id"] for m in result] == ["m1", "m2", "slow", "m4"]
    assert result[2]["text"] == "Recursion is always slower than iteration"
    assert result[2]["topic"] == "performance"  # extra keys are kept
    assert result[3]["text"] == "Each call shares the same local variables"


@pytest.mark.parametrize("count, expected", [(0, 0), (2, 2), (4, 4), (99, 4), (-1, 0)])
def test_pick_respects_count(count, expected):
    assert len(knowledge.pick(knowledge.normalize(MISCONCEPTIONS, "m"), count)) == expected


def test_pick_is_random_without_repeats():
    items = knowledge.normalize(MISCONCEPTIONS, "m")
    picks = {tuple(m["id"] for m in knowledge.pick(items, 2, random.Random(seed))) for seed in range(30)}
    assert len(picks) > 1
    assert all(len(set(p)) == 2 for p in picks)


# ---------- build ----------

def test_build_combines_all_sources():
    bank = knowledge.build(
        prerequisites=PREREQS, course_content=COURSE, course_knowledge=0.3,
        misconceptions=MISCONCEPTIONS, misconception_count=2, rng=random.Random(1),
    )
    assert [k["text"] for k in _of(bank, "prerequisite")] == [
        "A function can call other functions", "Each function call gets its own stack frame",
    ]
    assert len(_of(bank, "course")) == 3  # 30% of 10
    assert set(k["text"] for k in _of(bank, "course")) <= set(COURSE)
    assert len(_of(bank, "course", "misconception")) == 2
    assert knowledge.misconceptions(bank) == _of(bank, "course", "misconception")


@pytest.mark.parametrize("level, expected", [(0, 0), (0.5, 5), (1, 10)])
def test_course_knowledge_level(level, expected):
    bank = knowledge.build(course_content=COURSE, course_knowledge=level)
    assert len(_of(bank, "course")) == expected


def test_build_with_nothing_is_empty():
    assert knowledge.build() == []
    assert "completely new" in knowledge.describe([])


def test_add_taught_numbers_entries_across_turns():
    bank = knowledge.build(prerequisites=PREREQS)
    knowledge.add_taught(bank, ["Recursion is a function calling itself.", "  ", 5], turn=1)
    knowledge.add_taught(bank, ["It needs a base case."], turn=2)
    taught = _of(bank, "taught")
    assert [(k["id"], k["turn"], k["text"]) for k in taught] == [
        ("t1", 1, "Recursion is a function calling itself."),
        ("t2", 2, "It needs a base case."),
    ]


def test_add_taught_skips_duplicates():
    bank = knowledge.build(prerequisites=["A function can call other functions"])
    knowledge.add_taught(bank, ["Recursion is a function calling itself."], turn=1)
    new = knowledge.add_taught(
        bank,
        ["recursion is a function calling itself", "A function can call other functions!", "Base case stops it."],
        turn=2,
    )
    assert [(k["id"], k["text"]) for k in new] == [("t2", "Base case stops it.")]
    assert len(_of(bank, "taught")) == 2


def test_describe_groups_by_source():
    bank = knowledge.build(
        prerequisites=["P fact"], course_content=["C fact"], course_knowledge=1,
        misconceptions=["M belief"], misconception_count=1,
    )
    knowledge.add_taught(bank, ["T fact"], turn=1)
    text = knowledge.describe(bank)
    order = [text.index(s) for s in ("earlier courses", "- P fact", "already know", "- C fact",
                                     "sincerely believe", "- M belief", "from your tutor", "- T fact")]
    assert order == sorted(order)


# ---------- the student prompt ----------

def _prompt_for(app, monkeypatch, bank, misconception_count=0):
    sent = {}

    def fake_chat(messages, **_):
        sent["system"] = messages[0]["content"]
        return {"reply": "ok", "learned": []}

    monkeypatch.setattr(llm, "chat", fake_chat)
    session = {
        "id": "s1", "prompt": "Recursion", "attachments": [], "messages": [], "knowledge": bank,
        "student_settings": {"course_knowledge": 0.0, "misconception_count": misconception_count},
    }
    with app.app_context():
        student.respond(session, "hi")
    return sent["system"]


def test_student_prompt_contains_its_knowledge(app, monkeypatch):
    bank = knowledge.build(prerequisites=["P fact"], misconceptions=["Recursion is just a loop"], misconception_count=1)
    prompt = _prompt_for(app, monkeypatch, bank, misconception_count=1)
    assert "- P fact" in prompt
    assert "- Recursion is just a loop" in prompt
    assert "Don't invent other misconceptions" in prompt
    assert "Treat anything not\non this list as unknown" in prompt


def test_student_with_no_misconceptions(app, monkeypatch):
    prompt = _prompt_for(app, monkeypatch, [], misconception_count=0)
    assert "no particular misconceptions" in prompt


def test_student_invents_misconceptions_when_bank_has_none(app, monkeypatch):
    prompt = _prompt_for(app, monkeypatch, [], misconception_count=4)
    assert "You also have 4 plausible misconception(s)" in prompt


# ---------- the API ----------

def test_session_builds_knowledge_bank(client):
    res = _create(
        client, prerequisites=PREREQS, course_content=COURSE, course_knowledge="0.2",
        misconceptions=MISCONCEPTIONS, misconception_count="2",
    )
    assert res.status_code == 201
    body = res.get_json()
    session = store.get_session(body["id"])

    bank = session["knowledge"]
    assert len(_of(bank, "prerequisite")) == 2
    assert len(_of(bank, "course")) == 2
    assert len(knowledge.misconceptions(bank)) == 2
    assert session["student_settings"] == {"course_knowledge": 0.2, "misconception_count": 2}

    for key in store.BACKEND_ONLY:  # never sent to the webpage
        assert key not in body
        assert key not in client.get(f"/api/sessions/{body['id']}").get_json()


def test_defaults_come_from_settings(app, client):
    app.config["STUDENT_MISCONCEPTIONS"] = 1
    app.config["STUDENT_COURSE_KNOWLEDGE"] = 0.5
    body = _create(client, course_content=COURSE, misconceptions=MISCONCEPTIONS).get_json()
    bank = store.get_session(body["id"])["knowledge"]
    assert len(knowledge.misconceptions(bank)) == 1
    assert len(_of(bank, "course")) == 5


def test_teaching_adds_to_knowledge_bank(app, client, monkeypatch):
    body = _create(client, prerequisites=PREREQS).get_json()
    monkeypatch.setattr(
        llm, "chat", lambda *_, **__: {"reply": "Got it!", "learned": ["Recursion means a function calls itself."]}
    )
    client.post(f"/api/sessions/{body['id']}/messages", json={"text": "Recursion is a function calling itself."})

    session = store.get_session(body["id"])
    taught = _of(session["knowledge"], "taught")
    assert [(k["text"], k["turn"]) for k in taught] == [("Recursion means a function calls itself.", 1)]
    assert session["turns"][0]["learned"] == ["Recursion means a function calls itself."]


def test_failed_turn_learns_nothing(client, monkeypatch):
    body = _create(client).get_json()

    def broken_chat(*_, **__):
        raise llm.AIError("boom")

    monkeypatch.setattr(llm, "chat", broken_chat)
    client.post(f"/api/sessions/{body['id']}/messages", json={"text": "Anything"})
    assert _of(store.get_session(body["id"])["knowledge"], "taught") == []


@pytest.mark.parametrize("fields", [
    {"misconception_count": "lots"},
    {"misconception_count": "-1"},
    {"misconception_count": "21"},
    {"course_knowledge": "1.5"},
    {"course_knowledge": "half"},
    {"misconceptions": "not json"},
    {"prerequisites": json.dumps({"a": 1})},
    {"course_content": "[1,"},
])
def test_bad_input_is_rejected(client, fields):
    res = _create(client, **fields)
    assert res.status_code == 400
    assert res.get_json()["error"]
