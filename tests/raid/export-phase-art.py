#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。
开发阶段导出二阶段素材；依赖开发机Pillow，不加入论坛运行依赖。
本轮无执行环境，脚本未实跑。运行后审阅git diff并回归，再提交。
"""
from pathlib import Path
import hashlib
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "source/plugin/gamecenter/games/raid/assets"
SOURCE = ASSETS / "boss-phase2.png"
TARGET = ASSETS / "boss-phase2.webp"
ARCHIVE = ROOT / "docs/raid/art/youyue-phase2-source.png"
LIMIT = 250_000

def main():
    if not SOURCE.is_file():
        raise SystemExit("Missing source PNG; export already completed or source unavailable.")
    if TARGET.exists() or ARCHIVE.exists():
        raise SystemExit("Output exists; inspect it before replacing.")
    with Image.open(SOURCE) as source:
        image = source.convert("RGB").resize((768, 768), Image.Resampling.LANCZOS)
        for quality in (88, 84, 80, 76, 72, 68, 64, 60):
            image.save(TARGET, "WEBP", quality=quality, method=6)
            if TARGET.stat().st_size <= LIMIT:
                break
        else:
            TARGET.unlink()
            raise SystemExit("Could not meet 250KB; source left intact.")
    for relative in ("source/plugin/gamecenter/games/raid/game.js", "tests/raid/experience-check.mjs"):
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        if "assets/boss-phase2.png" not in text:
            raise SystemExit("Unexpected reference in " + relative + "; inspect partial output.")
        path.write_text(text.replace("assets/boss-phase2.png", "assets/boss-phase2.webp"), encoding="utf-8")
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    SOURCE.rename(ARCHIVE)
    print("768x768 WebP", TARGET.stat().st_size, "bytes; SHA256", hashlib.sha256(TARGET.read_bytes()).hexdigest())
    print("Source archived outside runtime tree. Review diff, test and commit export changes.")

if __name__ == "__main__":
    main()
