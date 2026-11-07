"""POST /api/student/reply: the real student agent for the app's lessons. OpenAI is faked."""

import json

import pytest

from app import create_app
from app.agents import llm
from app.routes import student as student_route

FIXTURE = json.loads((__import__("pathlib").Path(__file__).parent / "fixtures" / "bubble_sort_lesson.json").read_text())
BODY = {
    "lesson_id": "lesson-1",
    "topic": "Bubble sort",
    "summary": "Teach how bubble sort puts a list into ascending order.",
    "objectives": ["Describe which elements are compared and in what order."],
    "transcript": [
        {"speaker": "assistant", "text": "Hi! Can you teach me?"},
        {"speaker": "user", "text": "You compare neighbours."},
    ],
    "message": "You compare neighbours.",
    "learned": ["Bubble sort sorts a list."],
}


@pytest.fixture(autouse=True)
def clear_cache():
    student_route._brief_cache.clear()


@pytest.fixture
def client(tmp_path):
    return create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path)}).test_client()


@pytest.fixture
def chat(monkeypatch):
    sent = {}

    def fake(messages, **kwargs):
        sent["messages"], sent["kwargs"] = messages, kwargs
        return {"reply": "So I only compare the two next to each other?", "learned": ["You compare neighbouring elements."]}

    monkeypatch.setattr(llm, "chat", fake)
    return sent


def test_replies_to_the_actual_message_with_public_brief(client, chat):
    res = client.post("/api/student/reply", json=BODY)
    assert res.status_code == 200
    assert res.get_json() == {
        "reply": "So I only compare the two next to each other?",
        "learned": ["You compare neighbouring elements."],
        "status": "ok",
        "brief": "public",
    }
    system = chat["messages"][0]["content"]
    assert "Topic: Bubble sort" in system
    assert "- Describe which elements are compared and in what order." in system  # a knowledge gap
    assert "- Bubble sort sorts a list." in system  # learned earlier, now known
    # The latest message is sent once, after the history before it
    assert chat["messages"][-1] == {"role": "user", "content": "You compare neighbours."}
    assert [m["role"] for m in chat["messages"][2:]] == ["assistant", "user"]


def test_opening_without_a_message(client, monkeypatch):
    monkeypatch.setattr(llm, "chat", lambda *_, **__: "Hi! I'm new to bubble sort. Where do I start?")
    res = client.post("/api/student/reply", json={**BODY, "message": "", "transcript": []})
    assert res.get_json()["reply"] == "Hi! I'm new to bubble sort. Where do I start?"


def test_uses_the_lessons_real_agent_brief_when_available(tmp_path, chat, monkeypatch):
    app = create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path), "AGENT_BRIEF_URL": "https://n8n.test/brief/{lesson_id}"})
    fetched = []

    class Res:
        def read(self):
            return json.dumps(FIXTURE).encode()

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    def fake_urlopen(req, timeout):
        fetched.append(req.full_url)
        return Res()

    monkeypatch.setattr(student_route.urllib.request, "urlopen", fake_urlopen)
    client = app.test_client()
    res = client.post("/api/student/reply", json=BODY)
    client.post("/api/student/reply", json=BODY)

    assert res.get_json()["brief"] == "lesson"
    assert fetched == ["https://n8n.test/brief/lesson-1"]  # cached after the first call
    system = chat["messages"][0]["content"]
    assert "Every comparison requires a swap." in system  # a misconception from the real brief
    assert "greater than the right value" not in system  # answers never reach the student


def test_falls_back_to_public_brief_when_brief_url_fails(tmp_path, chat, monkeypatch):
    app = create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path), "AGENT_BRIEF_URL": "https://n8n.test/brief/{lesson_id}"})

    def down(*_, **__):
        raise student_route.urllib.error.URLError("down")

    monkeypatch.setattr(student_route.urllib.request, "urlopen", down)
    assert app.test_client().post("/api/student/reply", json=BODY).get_json()["brief"] == "public"


def test_needs_a_lesson_or_topic(client):
    assert client.post("/api/student/reply", json={"message": "hi"}).status_code == 400


def test_ai_failure_is_reported_not_raised(client, monkeypatch):
    def broken(*_, **__):
        raise llm.AIError("boom")

    monkeypatch.setattr(llm, "chat", broken)
    data = client.post("/api/student/reply", json=BODY).get_json()
    assert data["status"] == "failed" and data["learned"] == []
