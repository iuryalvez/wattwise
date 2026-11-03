"""Loopback HTTP server and routes for the local web application."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json

from .advisor.ollama import advise, ollama_status
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
            return self.send(403, {"error": "Use o endereço local do aplicativo."})
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
            return self.send(404, {"error": "Página não encontrada."})
        name, content_type = files[self.path]
        return self.send(200, (WEB_DIR / name).read_bytes(), content_type)

    def do_POST(self):
        if not self.valid_host():
            return self.send(403, {"error": "Origem inválida."})
        origin = self.headers.get("Origin")
        if origin and origin not in {f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"}:
            return self.send(403, {"error": "Origem inválida."})
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send(415, {"error": "Envie application/json."})
        if self.path not in {"/api/analyze", "/api/advise"}:
            return self.send(404, {"error": "Operação não encontrada."})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 65536:
                return self.send(413, {"error": "Envie até 64 KB de dados."})
            data = json.loads(self.rfile.read(size))
            report = analyze(data)
        except (ValueError, TypeError, KeyError, AttributeError):
            return self.send(400, {"error": "Dados inválidos. Confira nomes, potências, horários e uso essencial."})
        if self.path == "/api/analyze":
            return self.send(200, report)
        try:
            return self.send(200, advise(data))
        except ValueError as exc:
            return self.send(502, {"error": str(exc)})
        except (TypeError, KeyError, AttributeError):
            return self.send(502, {"error": "Ollama retornou uma resposta inesperada. Tente novamente."})


def serve(port=8765):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"WattWise: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
