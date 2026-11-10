"""(C) 2026 Carinoasd. Local-only prototype preview server: 小典 / Codex."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import mimetypes

ROOT = Path(__file__).resolve().parents[2] / "source/plugin/gamecenter/games/_danmaku_proto"
ALLOWED = {"index.html", "engine.js", "replay.js", "ui.js", "style.css", "rules.json"}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        name = urlsplit(self.path).path
        name = "index.html" if name == "/" else name.lstrip("/")
        if name not in ALLOWED:
            self.send_error(404)
            return
        data = (ROOT / name).read_bytes()
        mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime + "; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8876)
    args = parser.parse_args()
    print(f"Danmaku P0: http://127.0.0.1:{args.port}/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
