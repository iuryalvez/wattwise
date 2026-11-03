"""Regression checks for expected API failures (no running model required)."""

import copy
from http.client import HTTPConnection, RemoteDisconnected
from http.server import ThreadingHTTPServer
from io import BytesIO
import json
import threading
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError

from wattwise.samples import SAMPLE
from wattwise.server import Handler


class ReliabilityTests(unittest.TestCase):
    def handler(self, path, data=None):
        handler = Handler.__new__(Handler)
        handler.server = SimpleNamespace(server_port=8765)
        raw = json.dumps(data).encode()
        handler.headers = {"Host": "127.0.0.1:8765", "Content-Type": "application/json",
                           "Content-Length": str(len(raw))}
        handler.path, handler.rfile, handler.send = path, BytesIO(raw), Mock()
        return handler

    def test_invalid_configuration_is_json_on_both_endpoints(self):
        with patch.dict("os.environ", {"OLLAMA_MODEL": "gemma4:cloud"}):
            status = self.handler("/api/status")
            status.do_GET()
            self.assertFalse(status.send.call_args.args[1]["available"])
            self.assertEqual(status.send.call_args.args[1]["code"], "invalid_model_config")
            advisor = self.handler("/api/advise", SAMPLE)
            advisor.do_POST()
            self.assertEqual(advisor.send.call_args.args[0], 503)
            self.assertEqual(advisor.send.call_args.args[1]["field"], "OLLAMA_MODEL")

    def test_field_errors_preserve_useful_messages(self):
        cases = [("rate", -1, "rate"), ("days", 367, "days"),
                 ("context", [], "context"), ("advisorAnswers", [None], "advisorAnswers[0]")]
        for key, value, field in cases:
            for path in ("/api/analyze", "/api/advise"):
                with self.subTest(key=key, path=path):
                    config = {**copy.deepcopy(SAMPLE), key: value}
                    handler = self.handler(path, config)
                    handler.do_POST()
                    status, body = handler.send.call_args.args
                    self.assertEqual(status, 400)
                    self.assertEqual(body["code"], "invalid_input")
                    self.assertEqual(body["field"], field)
                    self.assertNotIn("Dados inválidos", body["error"])
        config = copy.deepcopy(SAMPLE)
        config["devices"][0]["hours"] = 25
        handler = self.handler("/api/analyze", config)
        handler.do_POST()
        self.assertEqual(handler.send.call_args.args[1]["field"], "devices[0].hours")

    def test_ollama_transport_errors_on_status_and_advisor(self):
        failures = [(TimeoutError(), "ollama_timeout", 504),
                    (URLError(TimeoutError()), "ollama_timeout", 504),
                    (ConnectionResetError(), "ollama_unavailable", 503),
                    (RemoteDisconnected(), "ollama_unavailable", 503),
                    (URLError("refused"), "ollama_unavailable", 503),
                    (HTTPError("url", 404, "missing", {}, None), "model_unavailable", 503),
                    (HTTPError("url", 500, "failure", {}, None), "ollama_http_error", 502)]
        for failure, code, expected_status in failures:
            for path in ("/api/status", "/api/advise"):
                with self.subTest(failure=type(failure), path=path), patch(
                        "wattwise.advisor.ollama.request.urlopen", side_effect=failure):
                    handler = self.handler(path, SAMPLE)
                    handler.do_GET() if path.endswith("status") else handler.do_POST()
                    status, body = handler.send.call_args.args
                    self.assertEqual(status, 200 if path.endswith("status") else expected_status)
                    self.assertEqual(body["code"], code)
                    self.assertIsInstance(body["error"], str)

    def test_malformed_ollama_responses_never_escape(self):
        bodies = [b"not json", b"\xff", b"[]", b"null", b'{"models":null}',
                  b'{"message":null}', b'{"message":{"content":4}}']
        for path in ("/api/status", "/api/advise"):
            for raw in bodies:
                with self.subTest(path=path, raw=raw), patch(
                        "wattwise.advisor.ollama.request.urlopen", return_value=BytesIO(raw)):
                    handler = self.handler(path, SAMPLE)
                    handler.do_GET() if path.endswith("status") else handler.do_POST()
                    status, body = handler.send.call_args.args
                    self.assertEqual(status, 200 if path.endswith("status") else 502)
                    self.assertEqual(body["code"], "invalid_ollama_response")

    def test_missing_model_status_and_bad_followup_fields(self):
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=BytesIO(b'{"models":[]}')):
            handler = self.handler("/api/status")
            handler.do_GET()
            self.assertEqual(handler.send.call_args.args[1]["code"], "model_unavailable")
        for answers, field in [([{"question": "Q", "answer": ""}], "advisorAnswers[0].answer"),
                               ([{}] * 5, "advisorAnswers")]:
            with patch("wattwise.advisor.ollama.request.urlopen") as upstream:
                handler = self.handler("/api/advise", {**SAMPLE, "advisorAnswers": answers})
                handler.do_POST()
                self.assertEqual(handler.send.call_args.args[0], 400)
                self.assertEqual(handler.send.call_args.args[1]["field"], field)
                upstream.assert_not_called()

    def test_malformed_model_content_and_truncation(self):
        for content in ["not json", "null", "[]", '{}', json.dumps({
                "decision": "recommend", "candidate_id": "work", "reason": "R",
                "next_step": "N", "question": "Q"})]:
            with self.subTest(content=content), patch("wattwise.advisor.ollama.request.urlopen",
                    return_value=BytesIO(json.dumps({"message": {"content": content}}).encode())):
                handler = self.handler("/api/advise", SAMPLE)
                handler.do_POST()
                self.assertEqual(handler.send.call_args.args[0], 502)
                self.assertEqual(handler.send.call_args.args[1]["code"], "invalid_ollama_response")
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=BytesIO(
                b'{"done_reason":"length","message":{"content":""}}')):
            handler = self.handler("/api/advise", SAMPLE)
            handler.do_POST()
            self.assertEqual(handler.send.call_args.args[1]["code"], "ollama_response_truncated")

    def test_valid_status_and_failure_during_response_read(self):
        with patch.dict("os.environ", {"OLLAMA_MODEL": "gemma4"}), patch(
                "wattwise.advisor.ollama.request.urlopen", return_value=BytesIO(
                    b'{"models":[{"name":"gemma4:latest"}]}')):
            handler = self.handler("/api/status")
            handler.do_GET()
            self.assertEqual(handler.send.call_args.args, (200, {
                "available": True, "running": True, "model": "gemma4"}))
        response = Mock()
        response.read.side_effect = ConnectionResetError()
        opened = Mock()
        opened.__enter__ = Mock(return_value=response)
        opened.__exit__ = Mock(return_value=False)
        with patch("wattwise.advisor.ollama.request.urlopen", return_value=opened):
            handler = self.handler("/api/advise", SAMPLE)
            handler.do_POST()
            self.assertEqual(handler.send.call_args.args[1]["code"], "ollama_unavailable")

    def test_invalid_numbers_and_request_envelopes(self):
        for value in [True, None, "1", float("nan"), float("inf"), 10 ** 1000]:
            handler = self.handler("/api/analyze", {**SAMPLE, "rate": value})
            handler.do_POST()
            self.assertEqual(handler.send.call_args.args[0], 400)
            self.assertEqual(handler.send.call_args.args[1]["field"], "rate")
        for raw in [b"{broken", b"\xff"]:
            handler = self.handler("/api/analyze")
            handler.rfile = BytesIO(raw)
            handler.headers["Content-Length"] = str(len(raw))
            handler.do_POST()
            self.assertEqual(handler.send.call_args.args, (400, {
                "error": "Envie um documento JSON válido em UTF-8.", "code": "invalid_json"}))
        handler = self.handler("/api/analyze", SAMPLE)
        handler.headers["Content-Length"] = "invalid"
        handler.do_POST()
        self.assertEqual(handler.send.call_args.args[1]["code"], "invalid_request")

    def test_real_http_failure_keeps_calculator_available(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        thread.start()
        connection = HTTPConnection("127.0.0.1", server.server_port, timeout=2)
        try:
            with patch.dict("os.environ", {"OLLAMA_MODEL": "invalid"}), patch.object(Handler, "log_message"):
                for method, path, expected in [("GET", "/api/status", 200),
                                               ("POST", "/api/advise", 503),
                                               ("POST", "/api/analyze", 200)]:
                    connection.request(method, path, json.dumps(SAMPLE) if method == "POST" else None,
                                       {"Content-Type": "application/json"})
                    response = connection.getresponse()
                    body = json.loads(response.read())
                    self.assertEqual(response.status, expected)
                    self.assertIn("application/json", response.getheader("Content-Type"))
                    if path == "/api/analyze":
                        self.assertEqual(body["evidence"], "manual_estimate")
                        self.assertEqual(body["total"]["baseline_kwh"], 480.24)
                    else:
                        self.assertEqual(body["code"], "invalid_model_config")
        finally:
            connection.close()
            server.shutdown()
            thread.join(timeout=2)
            server.server_close()


if __name__ == "__main__":
    unittest.main()
