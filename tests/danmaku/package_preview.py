"""(C) 2026 Carinoasd. Optional offline preview packaging: 小典 / Codex.

Uses only Python's standard library. Runtime files need no build step or server.
rules.json remains canonical; --check detects a stale rules-data.js without edits.
"""
import argparse
import base64
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "source/plugin/gamecenter/games/_danmaku_proto"
RULE_SCRIPT = SOURCE / "rules-data.js"


def bundled_rules():
    rules = json.loads((SOURCE / "rules.json").read_text(encoding="utf-8"))
    data = json.dumps(rules, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    # Keep rule strings safe inside a classic script and an inline HTML script.
    data = data.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    return ("/* (C) 2026 Carinoasd. Offline rules bundle: 小典 / Codex.\n"
            " * Generated from rules.json by tests/danmaku/package_preview.py; do not edit. */\n"
            "window.DanmakuRules=" + data + ";\n")


def standalone_html(rule_script):
    html = (SOURCE / "index.html").read_text(encoding="utf-8")
    css = (SOURCE / "style.css").read_text(encoding="utf-8")
    html, count = re.subn(r'<link rel="stylesheet" href="style.css">', lambda _: "<style>\n" + css + "\n</style>", html)
    assert count == 1, "Expected one local stylesheet"
    scripts = re.findall(r'<script defer src="([^"<>]+)"></script>', html)
    assert scripts and scripts[0] == "rules-data.js" and scripts[-1] == "ui.js", "Unexpected script ordering"
    script_tags = []
    for name in scripts:
        assert Path(name).name == name and name.endswith(".js"), "Expected a local script filename"
        source = rule_script if name == "rules-data.js" else (SOURCE / name).read_text(encoding="utf-8")
        source = re.sub(r"</script", r"<\\/script", source, flags=re.IGNORECASE)
        script_tags.append("<script>\n" + source + "\n</script>")
    html = re.sub(r'\s*<script defer src="[^"<>]+"></script>', "", html)
    # Inline scripts execute after the DOM exists, preserving defer's runtime order.
    assert html.count("</body>") == 1
    html = html.replace("</body>", "\n".join(script_tags) + "\n</body>")
    required_images = ("player-motion-v1.png", "player-front-display-v1.png", "stage01-corridor-v1.png",
                 "stage01-fairy-v1.png", "stage01-attendant-v1.png", "stage01-guardian-v1.png",
                 "boss-body-atlas-v1.png", "boss-ring-back-v1.png", "boss-ring-front-v1.png", "boss-face-v1.png", "boss-portrait-v1.png")
    extra_images = sorted(set(re.findall(r'assets/([\w-]+\.png)', html)) - set(required_images))
    for name in required_images + tuple(extra_images):
        asset = "assets/" + name
        assert asset in html, "Missing image reference: " + asset
        data = base64.b64encode((SOURCE / asset).read_bytes()).decode("ascii")
        html = html.replace(asset, "data:image/png;base64," + data)
    html = html.replace('class="brand" href="./"', 'class="brand" href="#"')
    assert not re.search(r'<script\b[^>]*\bsrc=', html), "External script remained"
    assert not re.search(r'<link\b[^>]*rel="stylesheet"', html), "External stylesheet remained"
    assert "assets/" not in html, "External image remained"
    return html


def main():
    parser = argparse.ArgumentParser(description="Package the local preview for double-click offline play")
    parser.add_argument("--check", action="store_true", help="Check committed rule data without writing files")
    parser.add_argument("--output", type=Path, help="Write a self-contained HTML file to this path")
    args = parser.parse_args()
    script = bundled_rules()
    if args.check:
        if not RULE_SCRIPT.exists() or RULE_SCRIPT.read_text(encoding="utf-8") != script:
            raise SystemExit("rules-data.js is stale; run python tests/danmaku/package_preview.py")
        print("PASS: rules-data.js matches canonical rules.json")
        if args.output:
            raise SystemExit("--check cannot be combined with --output")
        return
    RULE_SCRIPT.write_text(script, encoding="utf-8", newline="\n")
    print("Updated " + str(RULE_SCRIPT.relative_to(ROOT)))
    if args.output:
        html = standalone_html(script)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(html, encoding="utf-8", newline="\n")
        print("Wrote offline preview: " + str(args.output))


if __name__ == "__main__":
    main()
