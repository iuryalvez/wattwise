"""Loopback HTTP server and routes for the local web application."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json

from .advisor.ollama import advise, ollama_status
from .advisor.skill import answer_history
from .errors import AppError
from .paths import WEB_DIR
from .planning import analyze
from .samples import HIGH_CONSUMPTION_SAMPLE, INDUSTRIAL_SAMPLE, SAMPLE


class Handler(BaseHTTPRequestHandler):
    server_version = "WattWise/0.1"

    def send(self, status, body, content_type="application/json; charset=utf-8"):
        data = json.dumps(body, ensure_ascii=False).encode() if content_type.startswith("application/json") else body
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.end_headers()
        self.wfile.write(data)

    def valid_host(self):
        return self.headers.get("Host") in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}

    def do_GET(self):
        if not self.valid_host():
            return self.send(403, {"error": "Use o endereço local do aplicativo.", "code": "invalid_origin"})
        if self.path == "/api/sample":
            return self.send(200, SAMPLE)
        if self.path == "/api/sample/high-consumption":
            return self.send(200, HIGH_CONSUMPTION_SAMPLE)
        if self.path == "/api/sample/industrial":
            return self.send(200, INDUSTRIAL_SAMPLE)
        if self.path == "/api/status":
            return self.send(200, ollama_status())
        files = {"/": ("index.html", "text/html; charset=utf-8"),
                 "/monitor": ("monitor.html", "text/html; charset=utf-8"),
                 "/monitor/": ("monitor.html", "text/html; charset=utf-8"),
                 "/app.js": ("app.js", "text/javascript; charset=utf-8"),
                 "/styles.css": ("styles.css", "text/css; charset=utf-8")}
        files.update({"/monitor.css": ("monitor.css", "text/css; charset=utf-8"),
                      "/monitor-core.js": ("monitor-core.js", "text/javascript; charset=utf-8"),
                      "/monitor.js": ("monitor.js", "text/javascript; charset=utf-8")})
        if self.path not in files:
            return self.send(404, {"error": "Página não encontrada.", "code": "not_found"})
        name, content_type = files[self.path]
        return self.send(200, (WEB_DIR / name).read_bytes(), content_type)

    def do_POST(self):
        if not self.valid_host():
            return self.send(403, {"error": "Origem inválida.", "code": "invalid_origin"})
        origin = self.headers.get("Origin")
        if origin and origin not in {f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"}:
            return self.send(403, {"error": "Origem inválida.", "code": "invalid_origin"})
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send(415, {"error": "Envie application/json.", "code": "unsupported_media_type"})
        if self.path not in {"/api/analyze", "/api/advise"}:
            return self.send(404, {"error": "Operação não encontrada.", "code": "not_found"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send(400, {"error": "Content-Length deve ser um número inteiro.",
                                   "code": "invalid_request", "field": "Content-Length"})
        if not 0 < size <= 65536:
            return self.send(413, {"error": "Envie até 64 KB de dados.", "code": "payload_too_large"})
        try:
            data = json.loads(self.rfile.read(size))
        except ValueError:
            return self.send(400, {"error": "Envie um documento JSON válido em UTF-8.", "code": "invalid_json"})
        try:
            report = analyze(data)
            answer_history(data)
            if self.path == "/api/analyze":
                return self.send(200, report)
            return self.send(200, advise(data))
        except AppError as exc:
            return self.send(exc.status, exc.as_dict())


def serve(port=8765):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"WattWise: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
