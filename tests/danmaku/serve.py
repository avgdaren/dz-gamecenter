"""(C) 2026 Carinoasd. Local-only prototype preview server: 小典 / Codex."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import mimetypes

ROOT = Path(__file__).resolve().parents[2] / "source/plugin/gamecenter/games/_danmaku_proto"
ALLOWED = {"index.html", "controls.js", "engine.js", "replay.js", "battle.js", "battle-replay.js", "stage.js", "stage-replay.js", "stage-view.js", "player-view.js", "ui.js", "style.css", "rules.json", "rules-data.js",
           "assets/player-motion-v1.png", "assets/player-front-display-v1.png", "stage-art-view.js", "audio.js", "audio-bank.js", "bgm-bank.js", "midi.js", "midi-bank.js",
           "assets/stage01-corridor-v1.png", "assets/stage01-fairy-v1.png", "assets/stage01-attendant-v1.png", "assets/stage01-guardian-v1.png",
           "boss-view.js", "boss-patterns.js", "stage-show.js", "assets/boss-body-atlas-v1.png", "assets/boss-ring-back-v1.png", "assets/boss-ring-front-v1.png", "assets/boss-face-v1.png", "assets/boss-portrait-v1.png"}


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
        self.send_header("Content-Type", mime + ("; charset=utf-8" if mime.startswith("text/") or mime in {"application/javascript", "application/json"} else ""))
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
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Danmaku local: http://127.0.0.1:{server.server_address[1]}/", flush=True)
    server.serve_forever()
