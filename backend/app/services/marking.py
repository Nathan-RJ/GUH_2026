"""Calls the n8n "Mark Session" workflow, using only the Python standard library.

    mark(url, lesson_id, nickname, transcript) -> dict

The workflow marks everything the human said in the transcript against the
lesson's hidden rubric and replies:

    {"session_id": "...", "score": 0-100,
     "feedback": {"summary", "strengths": [...], "next_steps": [...],
                  "criteria": [{"criterion_id", "title", "band": "full" | "partial" | "zero",
                                "marks_awarded", "max_marks", "evidence": [{"turn", "quote"}],
                                "feedback"}]}}

Note: every call also saves a session row in Supabase (the workflow only
returns session_id once it has saved), so live marking after each message
creates one row per message.
"""

import json
import urllib.error
import urllib.request

TIMEOUT_SECONDS = 90


class MarkingError(Exception):
    """n8n couldn't be reached, errored, or replied with something unusable."""


def clean_transcript(raw) -> list[dict]:
    """Keep only {"speaker": "user" | "assistant", "text"} entries with text.

    Accepts "speaker" or "role", and the Lovable app's "student"/"sam" names.
    """
    aliases = {"user": "user", "student": "user", "assistant": "assistant", "sam": "assistant"}
    result = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        speaker = aliases.get(str(item.get("speaker") or item.get("role") or item.get("from") or "").lower())
        text = str(item.get("text") or "").strip()
        if speaker and text:
            result.append({"speaker": speaker, "text": text})
    return result


def mark(url: str, *, lesson_id: str, nickname: str, transcript: list[dict]) -> dict:
    """Send the transcript to n8n and return its JSON reply. Raises MarkingError."""
    body = json.dumps({"lesson_id": lesson_id, "nickname": nickname, "transcript": transcript}).encode()
    req = urllib.request.Request(
        url, data=body, method="POST", headers={"Content-Type": "application/json", "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as res:
            raw = res.read()
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:300]
        raise MarkingError(f"The marking service returned {err.code}: {detail}") from err
    except (urllib.error.URLError, TimeoutError) as err:
        reason = getattr(err, "reason", err)
        raise MarkingError(f"Couldn't reach the marking service: {reason}") from err

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as err:
        raise MarkingError("The marking service replied with something that isn't JSON.") from err
    if not isinstance(data, dict):
        raise MarkingError("The marking service replied in an unexpected format.")
    if data.get("status") == "failed" or "score" not in data:
        raise MarkingError(str(data.get("error") or "The marking service couldn't mark this session."))
    return data
