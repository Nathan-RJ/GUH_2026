import random

import pytest

from app import create_app
from app.agents import lesson, personalities, student
from app.services import store
from app.voice import settings as voice_settings


@pytest.fixture
def client(tmp_path):
    app = create_app({"TESTING": True, "UPLOAD_FOLDER": str(tmp_path)})
    return app.test_client()


def _new_session(client, **form):
    return client.post("/api/sessions", data={"prompt": "Recursion", **form}, content_type="multipart/form-data")


def test_every_personality_has_a_real_voice():
    for p in personalities.PERSONALITIES.values():
        assert p["voice"] in voice_settings.VOICES
        assert p["prompt"]


def test_choose_random_or_requested():
    rng = random.Random(1)
    picks = {personalities.choose(None, rng) for _ in range(100)}
    assert picks == set(personalities.PERSONALITIES)  # all of them come up
    assert personalities.choose("Sceptic") == "sceptic"
    with pytest.raises(ValueError):
        personalities.choose("grumpy")


def test_session_gets_a_personality(client):
    res = _new_session(client)
    assert res.status_code == 201
    assert res.get_json()["personality"] in personalities.PERSONALITIES


def test_session_can_request_a_personality(client):
    assert _new_session(client, personality="shy").get_json()["personality"] == "shy"
    assert _new_session(client, personality="grumpy").status_code == 400


def test_personality_becomes_the_students_persona(client):
    session_id = _new_session(client, personality="knowitall").get_json()["id"]
    brief = lesson.AgentBrief(**store.get_session(session_id)["brief"])
    expected = personalities.PERSONALITIES["knowitall"]["prompt"]
    assert brief.persona == expected
    assert expected in student.system_prompt(brief, [])


def test_lesson_persona_wins_over_the_random_one(client):
    lesson_json = '{"agent_brief": {"topic": "Recursion", "persona": "A sleepy pirate."}}'
    session_id = _new_session(client, lesson=lesson_json).get_json()["id"]
    assert store.get_session(session_id)["brief"]["persona"] == "A sleepy pirate."
