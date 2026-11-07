"""Standalone: python -m unittest discover -s tests -p test_lesson_upload.py"""
import importlib.util
import io
import json
import unittest
from email.parser import BytesParser
from email.policy import default
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from flask import Flask

# Keep forwarding tests independent of AI credentials and unrelated agent imports.
spec = importlib.util.spec_from_file_location("lesson_upload", Path(__file__).parents[1] / "app/routes/lessons.py")
lessons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lessons)


class LessonUploadTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, MAX_CONTENT_LENGTH=25 * 1024 * 1024)
        app.register_blueprint(lessons.bp, url_prefix="/api")
        self.client = app.test_client()
        self.forward = patch.object(lessons, "forward_document", return_value=(200, b'{"lesson_id":"lesson-123","status":"draft"}'))
        self.mock = self.forward.start()
        self.addCleanup(self.forward.stop)

    def post(self, content=b"Bubble sort compares adjacent elements and swaps them if out of order.", name="notes.txt", title="Bubble sort", extra=None):
        data = {"document": (io.BytesIO(content), name), "title": title}
        data.update(extra or {})
        return self.client.post("/api/lessons/prepare", data=data, content_type="multipart/form-data")

    def test_actual_file_and_trimmed_title_are_forwarded(self):
        content = b"# Synthetic lesson\nBubble sort compares adjacent elements."
        result = self.post(content, "lesson.md", "  Bubble sort  ")
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.json, {"lesson_id": "lesson-123", "status": "draft"})
        self.mock.assert_called_once_with(content, ".md", "Bubble sort")

    def test_rejects_invalid_inputs_before_network(self):
        for content, name, title, status in [
            (b"text", "slides.pptx", "Title", 415),
            (b"demo", "fake.pdf", "Title", 415),
            (b"", "empty.txt", "Title", 400),
            (b"abc", "notes.txt", " ", 400),
            (b"abc", "notes.txt", "x" * 201, 400),
            (b"\xff", "notes.txt", "Title", 415),
            (b"a\x00b", "notes.md", "Title", 415),
            (b"x" * (lessons.MAX_FILE_BYTES + 1), "large.txt", "Title", 413),
        ]:
            with self.subTest(name=name, status=status):
                self.assertEqual(self.post(content, name, title).status_code, status)
        self.mock.assert_not_called()

    def test_exact_size_limit_and_pdf_signature(self):
        self.assertEqual(self.post(b"x" * lessons.MAX_FILE_BYTES).status_code, 201)
        self.assertEqual(self.post(b"%PDF-1.4\nsynthetic signature", "notes.pdf").status_code, 201)

    def test_rejects_extra_file_and_category(self):
        self.assertEqual(self.post(extra={"other": (io.BytesIO(b"extra"), "extra.txt")}).status_code, 400)
        self.assertEqual(self.post(extra={"kind": "rubric"}).status_code, 400)
        result = self.client.post("/api/lessons/prepare", data={"title": "Title", "document": [(io.BytesIO(b"one"), "one.txt"), (io.BytesIO(b"two"), "two.txt")]})
        self.assertEqual(result.status_code, 400)
        self.mock.assert_not_called()

    def test_acknowledgements_never_mean_success(self):
        for status, raw in [(200, b'{"message":"Workflow was started"}'), (202, b'{"lesson_id":"123","status":"draft"}'), (200, b'not json'), (200, b'{"status":"draft"}'), (200, b'null'), (200, b'{"lesson_id":"123","status":"processing"}')]:
            self.mock.return_value = status, raw
            result = self.post()
            self.assertEqual(result.status_code, 202)
            self.assertEqual(result.json["status"], "unconfirmed")

    def test_failed_generation_is_an_error(self):
        self.mock.return_value = 200, b'{"status":"failed","error":"Generation failed"}'
        self.assertEqual(self.post().json["error"], "Generation failed")
        self.assertEqual(self.post().status_code, 502)

    def test_network_errors_and_unpublished_workflow(self):
        for error, status in [(TimeoutError(), 504), (URLError("DNS"), 502), (HTTPError(lessons.WEBHOOK, 404, "Not found", {}, io.BytesIO(b"{}")), 503), (HTTPError(lessons.WEBHOOK, 415, "Invalid", {}, io.BytesIO(b'{"error":"Invalid document"}')), 415)]:
            self.mock.side_effect = error
            self.assertEqual(self.post().status_code, status)

    def test_multipart_wire_format_preserves_bytes(self):
        self.forward.stop()
        with patch.object(lessons, "urlopen") as transport:
            transport.return_value.__enter__.return_value.status = 200
            transport.return_value.__enter__.return_value.read.return_value = b'{}'
            content = b"# Bubble sort\nCompare, swap, repeat.\n"
            lessons.forward_document(content, ".md", "Synthetic lesson")
            req = transport.call_args.args[0]
            message = BytesParser(policy=default).parsebytes(("Content-Type: " + req.get_header("Content-type") + "\r\n\r\n").encode() + req.data)
            parts = list(message.iter_parts())
            self.assertEqual(len(parts), 2)
            self.assertEqual(parts[0].get_param("name", header="content-disposition"), "title")
            self.assertEqual(parts[0].get_payload(decode=True), b"Synthetic lesson")
            self.assertEqual(parts[1].get_param("name", header="content-disposition"), "document")
            self.assertEqual(parts[1].get_filename(), "document.md")
            self.assertEqual(parts[1].get_payload(decode=True), content)
            self.assertEqual(req.full_url, lessons.WEBHOOK)


if __name__ == "__main__":
    unittest.main()
