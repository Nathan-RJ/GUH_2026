"""The student's misconceptions: picking a controllable number from a bank."""

import json
import random

import pytest

from app import create_app
from app.agents import llm, student
from app.services import store

BANK = [
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
    data = {"prompt": "Recursion", **fields}
    return client.post("/api/sessions", data=data, content_type="multipart/form-data")


# ---------- normalising and choosing ----------

def test_normalize_accepts_strings_and_dicts():
    result = student.normalize_misconceptions(BANK + [{"no_text": 1}, 42, ""])
    assert [m["id"] for m in result] == ["m1", "m2", "slow", "m4"]
    assert result[2]["text"] == "Recursion is always slower than iteration"
    assert result[2]["topic"] == "performance"  # extra keys are kept
    assert result[3]["text"] == "Each call shares the same local variables"


@pytest.mark.parametrize("count, expected", [(0, 0), (2, 2), (4, 4), (99, 4), (-1, 0)])
def test_choose_respects_count(count, expected):
    assert len(student.choose_misconceptions(BANK, count)) == expected


def test_choose_is_random_without_repeats():
    picks = {
        tuple(m["id"] for m in student.choose_misconceptions(BANK, 2, random.Random(seed)))
        for seed in range(30)
    }
    assert len(picks) > 1  # different sessions get different misconceptions
    assert all(len(set(p)) == 2 for p in picks)


# ---------- the student prompt ----------

def _system_prompt(app, monkeypatch, session):
    sent = {}

    def fake_chat(messages, **_):
        sent["system"] = messages[0]["content"]
        return "ok"

    monkeypatch.setattr(llm, "chat", fake_chat)
    with app.app_context():
        student.respond({"id": "s1", "prompt": "Recursion", "attachments": [], "messages": [], **session}, "hi")
    return sent["system"]


def test_student_plays_the_chosen_misconceptions(app, monkeypatch):
    chosen = student.normalize_misconceptions(["Recursion is just a loop", "A base case is optional"])
    prompt = _system_prompt(app, monkeypatch, {"student_misconceptions": chosen, "misconception_count": 2})
    assert "- Recursion is just a loop" in prompt
    assert "- A base case is optional" in prompt
    assert "Don't invent other misconceptions" in prompt


def test_student_with_zero_misconceptions(app, monkeypatch):
    prompt = _system_prompt(app, monkeypatch, {"student_misconceptions": [], "misconception_count": 0})
    assert "no particular misconceptions" in prompt


def test_student_invents_misconceptions_when_no_bank(app, monkeypatch):
    prompt = _system_prompt(app, monkeypatch, {"student_misconceptions": [], "misconception_count": 4})
    assert "You start with 4 plausible misconception(s)" in prompt


# ---------- the API ----------

def test_session_gets_requested_number_from_bank(client):
    res = _create(client, misconception_count="2", misconceptions=json.dumps(BANK))
    assert res.status_code == 201
    body = res.get_json()

    session = store.get_session(body["id"])
    assert session["misconception_count"] == 2
    assert len(session["misconception_bank"]) == 4
    assert len(session["student_misconceptions"]) == 2
    bank_ids = {m["id"] for m in session["misconception_bank"]}
    assert {m["id"] for m in session["student_misconceptions"]} <= bank_ids

    # Hidden from the webpage
    for key in store.BACKEND_ONLY:
        assert key not in body
        assert key not in client.get(f"/api/sessions/{body['id']}").get_json()


def test_count_defaults_to_setting(app, client):
    app.config["STUDENT_MISCONCEPTIONS"] = 1
    body = _create(client, misconceptions=json.dumps(BANK)).get_json()
    assert len(store.get_session(body["id"])["student_misconceptions"]) == 1


def test_no_bank_means_none_chosen_but_count_kept(client):
    body = _create(client, misconception_count="3").get_json()
    session = store.get_session(body["id"])
    assert session["student_misconceptions"] == []
    assert session["misconception_count"] == 3  # the student will invent 3


@pytest.mark.parametrize("fields", [
    {"misconception_count": "lots"},
    {"misconception_count": "-1"},
    {"misconception_count": "21"},
    {"misconceptions": "not json"},
    {"misconceptions": json.dumps({"a": 1})},
])
def test_bad_input_is_rejected(client, fields):
    assert _create(client, **fields).status_code == 400
