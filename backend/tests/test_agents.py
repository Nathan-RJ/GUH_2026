"""Agent tests. The OpenAI call (llm.chat) is faked, so no API key is needed."""

import pytest

from app import create_app
from app.agents import llm, teacher
from app.services import store


@pytest.fixture
def app(tmp_path):
    return create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path)})


@pytest.fixture
def client(app):
    return app.test_client()


def _new_session(client, prompt="Recursion"):
    return client.post(
        "/api/sessions", data={"prompt": prompt}, content_type="multipart/form-data"
    ).get_json()


def test_turns_are_stored_for_teacher_but_hidden_from_api(client):
    session = _new_session(client)
    sid = session["id"]
    assert "turns" not in session

    for text in ["A function calling itself.", "It needs a base case."]:
        res = client.post(f"/api/sessions/{sid}/messages", json={"text": text})
    body = res.get_json()

    assert "turns" not in body
    assert [m["role"] for m in body["messages"]] == ["assistant", "user", "assistant", "user", "assistant"]
    assert "turns" not in client.get(f"/api/sessions/{sid}").get_json()

    turns = store.get_turns(sid)
    assert [t["number"] for t in turns] == [1, 2]
    assert turns[1]["explanation"] == "It needs a base case."
    assert turns[1]["reply"] == body["messages"][-1]["text"]
    assert turns[1]["status"] == "placeholder"  # no AI in tests
    assert turns[1]["session_id"] == sid


def test_teacher_review_is_cleaned(app, monkeypatch):
    sent = {}

    def fake_chat(messages, **kwargs):
        sent["messages"], sent["kwargs"] = messages, kwargs
        return {
            "score": 14,  # out of range -> clamped
            "correct": True,
            "feedback": "Give an example.",
            "student_understanding": "Thinks recursion is a loop.",
            "misconceptions": [{"name": "recursion = loop", "status": "fixed"}, {"name": "x", "status": "??"}, "junk"],
            "concepts_covered": ["base case"],
        }

    monkeypatch.setattr(llm, "chat", fake_chat)
    session = {"id": "s1", "prompt": "Recursion", "attachments": [], "messages": []}
    with app.app_context():
        review = teacher.review(session, "It calls itself.", "So it's like a loop?")

    assert sent["kwargs"]["json_mode"] is True
    transcript = sent["messages"][1]["content"]
    assert "It calls itself." in transcript and "So it's like a loop?" in transcript
    assert review["score"] == 10
    assert review["misconceptions"] == [
        {"name": "recursion = loop", "status": "fixed"},
        {"name": "x", "status": "open"},
    ]
    assert review["concepts_covered"] == ["base case"]
