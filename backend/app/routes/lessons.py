"""Forward module content to n8n; never infer completion from HTTP 200 alone."""
import json
import socket
import uuid
from pathlib import PurePath
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Blueprint, jsonify, request

bp = Blueprint("lessons", __name__)
WEBHOOK = "https://likeclockwork.app.n8n.cloud/webhook/reply2me/prepare-lesson"
MAX_FILE_BYTES = 10 * 1024 * 1024


def forward_document(content: bytes, extension: str, title: str):
    # Use a generated filename to prevent multipart header injection. Keep bytes intact.
    boundary = uuid.uuid4().hex
    mime = "application/pdf" if extension == ".pdf" else "text/plain"
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"title\"\r\n\r\n{title}\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"document{extension}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode()
    upstream = Request(WEBHOOK, data=body, headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Accept": "application/json",
    }, method="POST")
    with urlopen(upstream, timeout=120) as response:
        return response.status, response.read(64 * 1024)


@bp.post("/lessons/prepare")
def prepare_lesson():
    # Leave room for multipart headers without changing limits on other endpoints.
    if request.content_length and request.content_length > MAX_FILE_BYTES + 64 * 1024:
        return jsonify(error="Document exceeds the 10 MB limit."), 413
    if request.mimetype != "multipart/form-data":
        return jsonify(error="Send multipart/form-data with one document and title."), 400
    files = list(request.files.items(multi=True))
    if len(files) != 1 or files[0][0] != "document" or not files[0][1].filename:
        return jsonify(error="Choose exactly one document."), 400
    if set(request.form) != {"title"} or len(request.form.getlist("title")) != 1:
        return jsonify(error="Send only document and title. Exam/rubric uploads are disabled."), 400
    title = request.form["title"].strip()
    if not title or len(title) > 200:
        return jsonify(error="Title must contain 1 to 200 characters."), 400
    file = files[0][1]
    extension = PurePath(file.filename).suffix.lower()
    if extension not in {".pdf", ".txt", ".md"}:
        return jsonify(error="Only PDF, TXT and MD files are accepted."), 415
    content = file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        return jsonify(error="Document exceeds the 10 MB limit."), 413
    if not content:
        return jsonify(error="The document is empty."), 400
    if extension == ".pdf":
        if not content.startswith(b"%PDF-"):
            return jsonify(error="This file does not contain a PDF document."), 415
    else:
        try:
            decoded = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            return jsonify(error="Save text documents as UTF-8 TXT or MD."), 415
        if "\x00" in decoded or not decoded.strip():
            return jsonify(error="The document must contain readable text."), 415

    try:
        status, raw = forward_document(content, extension, title)
    except HTTPError as error:
        if error.code == 404:
            return jsonify(error="The n8n production webhook is unavailable. Publish the Prepare Lesson workflow and check its URL."), 503
        try:
            payload = json.loads(error.read(64 * 1024))
        except (ValueError, OSError):
            payload = {}
        message = payload.get("error") if isinstance(payload, dict) else None
        return jsonify(error=message if isinstance(message, str) else f"n8n rejected the upload (HTTP {error.code}). Check its execution log."), error.code if error.code in {400, 413, 415, 422, 429} else 502
    except (TimeoutError, socket.timeout):
        return jsonify(error="Timed out waiting for n8n. Processing may still finish; check n8n executions before retrying to avoid duplicates."), 504
    except (URLError, OSError):
        return jsonify(error="Cannot reach n8n. Completion is unknown; check connectivity and n8n executions before retrying."), 502

    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        payload = {}
    if isinstance(payload, dict) and payload.get("status") == "failed":
        message = payload.get("error")
        return jsonify(error=message if isinstance(message, str) else "n8n could not generate or save the lesson. Check its execution log."), 502
    if (status != 202 and isinstance(payload, dict)
            and isinstance(payload.get("lesson_id"), str) and payload["lesson_id"].strip()
            and payload.get("status") == "draft"):
        return jsonify(lesson_id=payload["lesson_id"], status="draft"), 201
    # Includes default n8n {message: 'Workflow was started'} acknowledgements.
    return jsonify(status="unconfirmed", message="n8n acknowledged the request, but did not confirm a saved draft. Check its execution log before retrying."), 202
