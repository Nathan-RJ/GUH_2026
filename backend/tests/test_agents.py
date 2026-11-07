"""Agent tests. The OpenAI call (llm.chat) is faked, so no API key is needed."""

import pytest

from app import create_app
from app.agents import llm, student, teacher


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


def test_turn_stores_student_reply_and_review(client):
    session = _new_session(client)
    res = client.post(f"/api/sessions/{session['id']}/messages", json={"text": "A function calling itself."})
    messages = res.get_json()["messages"]

    assert [m["role"] for m in messages] == ["assistant", "user", "assistant"]
    assert "review" not in messages[1]  # the user's message
    review = messages[2]["review"]  # on the student's reply
    assert set(review) == {
        "score", "correct", "feedback", "student_understanding", "misconceptions", "concepts_covered",
    }


def test_student_sees_history_and_explanation(app, monkeypatch):
    sent = {}

    def fake_chat(messages, **_):
        sent["messages"] = messages
        return "Oh! So it needs a base case?"

    monkeypatch.setattr(llm, "chat", fake_chat)
    session = {
        "id": "s1", "prompt": "Recursion", "attachments": [],
        "messages": [{"role": "assistant", "text": "Hi, what is recursion?"}],
    }
    with app.app_context():
        reply = student.respond(session, "A function that calls itself.")

    assert reply == "Oh! So it needs a base case?"
    roles = [m["role"] for m in sent["messages"]]
    assert roles == ["system", "assistant", "user"]
    assert sent["messages"][-1]["content"] == "A function that calls itself."
    assert "Recursion" in sent["messages"][0]["content"]


def test_student_handles_ai_failure(app, monkeypatch):
    def broken_chat(*_, **__):
        raise llm.AIError("boom")

    monkeypatch.setattr(llm, "chat", broken_chat)
    with app.app_context():
        reply = student.respond({"id": "s1", "prompt": "x", "attachments": [], "messages": []}, "hi")
    assert reply == student.FAILED_REPLY


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
