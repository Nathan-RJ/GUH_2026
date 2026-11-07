import io

import pytest

from app import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path)})
    return app.test_client()


def test_health(client):
    assert client.get("/api/health").get_json() == {"status": "ok"}


def test_create_session_with_prompt_and_files(client):
    res = client.post(
        "/api/sessions",
        data={
            "prompt": "Teach me recursion",
            "files": [
                (io.BytesIO(b"hello"), "notes.txt"),
                (io.BytesIO(b"again"), "notes.txt"),
            ],
        },
        content_type="multipart/form-data",
    )
    assert res.status_code == 201
    session = res.get_json()
    assert session["prompt"] == "Teach me recursion"
    assert [a["name"] for a in session["attachments"]] == ["notes.txt", "notes_1.txt"]
    assert session["messages"][0]["role"] == "assistant"

    download = client.get(f"/api/sessions/{session['id']}/attachments/notes_1.txt")
    assert download.data == b"again"


def test_create_session_needs_prompt_or_file(client):
    res = client.post("/api/sessions", data={"prompt": "  "}, content_type="multipart/form-data")
    assert res.status_code == 400


def test_send_message(client):
    session = client.post(
        "/api/sessions", data={"prompt": "hi"}, content_type="multipart/form-data"
    ).get_json()

    res = client.post(f"/api/sessions/{session['id']}/messages", json={"text": "Hello"})
    assert res.status_code == 200
    roles = [m["role"] for m in res.get_json()["messages"]]
    assert roles == ["assistant", "user", "assistant"]


def test_unknown_session(client):
    assert client.get("/api/sessions/nope").status_code == 404
    assert client.post("/api/sessions/nope/messages", json={"text": "x"}).status_code == 404
