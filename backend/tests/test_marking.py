"""POST /api/mark: forwards a transcript to the n8n Mark Session workflow. n8n is faked."""

import json
import urllib.error

import pytest

from app import create_app
from app.services import marking

LESSON_ID = "b0454456-7c09-4401-a544-373e3bbc2f10"
N8N_REPLY = {
    "session_id": "s-1",
    "score": 50,
    "feedback": {
        "summary": "Half covered.",
        "criteria": [
            {"criterion_id": "adjacent_comparisons", "title": "Comparisons", "band": "full", "marks_awarded": 25, "max_marks": 25},
            {"criterion_id": "stopping_conditions", "title": "Stopping", "band": "zero", "marks_awarded": 0, "max_marks": 25},
        ],
    },
}
TRANSCRIPT = [
    {"speaker": "assistant", "text": "Which elements do I compare?"},
    {"speaker": "user", "text": "Adjacent ones, left to right."},
]


@pytest.fixture
def client(tmp_path):
    app = create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path), "MARK_SESSION_URL": "https://n8n.test/mark"})
    return app.test_client()


class _FakeResponse:
    def __init__(self, body: bytes):
        self.body = body

    def read(self):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


@pytest.fixture
def n8n(monkeypatch):
    """Fake urlopen; records the request and replies with `reply`."""
    calls = {"reply": json.dumps(N8N_REPLY).encode()}

    def fake_urlopen(req, timeout):
        calls["url"], calls["body"], calls["timeout"] = req.full_url, json.loads(req.data), timeout
        if isinstance(calls["reply"], Exception):
            raise calls["reply"]
        return _FakeResponse(calls["reply"])

    monkeypatch.setattr(marking.urllib.request, "urlopen", fake_urlopen)
    return calls


def test_forwards_transcript_and_returns_result(client, n8n):
    res = client.post("/api/mark", json={"lesson_id": LESSON_ID, "transcript": TRANSCRIPT})
    assert res.status_code == 200
    assert res.get_json() == N8N_REPLY
    assert n8n["url"] == "https://n8n.test/mark"
    assert n8n["body"] == {"lesson_id": LESSON_ID, "nickname": "live-marking", "transcript": TRANSCRIPT}


def test_accepts_app_message_format_and_nickname(client, n8n):
    transcript = [{"from": "sam", "text": "Hi!"}, {"from": "student", "text": " Compare neighbours. "}, {"from": "student", "text": ""}]
    client.post("/api/mark", json={"lesson_id": LESSON_ID, "transcript": transcript, "nickname": "Alex"})
    assert n8n["body"]["nickname"] == "Alex"
    assert n8n["body"]["transcript"] == [
        {"speaker": "assistant", "text": "Hi!"},
        {"speaker": "user", "text": "Compare neighbours."},
    ]


@pytest.mark.parametrize("body", [
    {"transcript": TRANSCRIPT},                                              # no lesson
    {"lesson_id": LESSON_ID, "transcript": []},                              # nothing to mark
    {"lesson_id": LESSON_ID, "transcript": [{"speaker": "assistant", "text": "Hi"}]},  # nothing from the user
])
def test_rejects_bad_requests(client, n8n, body):
    res = client.post("/api/mark", json=body)
    assert res.status_code == 400
    assert "url" not in n8n  # n8n never called


@pytest.mark.parametrize("reply, message", [
    (urllib.error.URLError("down"), "Couldn't reach"),
    (b"<html>oops</html>", "isn't JSON"),
    (json.dumps({"status": "failed", "error": "Could not save the session."}).encode(), "Could not save"),
])
def test_n8n_failures_become_502(client, n8n, reply, message):
    n8n["reply"] = reply
    res = client.post("/api/mark", json={"lesson_id": LESSON_ID, "transcript": TRANSCRIPT})
    assert res.status_code == 502
    assert message in res.get_json()["error"]
