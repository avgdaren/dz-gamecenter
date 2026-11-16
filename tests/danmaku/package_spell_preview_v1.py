"""(C) 2026 Carinoasd. Independent, offline presentation study: 小典 / Codex."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
CAMPAIGN = ROOT / 'source/plugin/gamecenter/games/_danmaku_campaign_draft'
ASSETS = {
    'observerPortrait': 'source/plugin/gamecenter/games/_danmaku_proto/assets/boss-portrait-v1.png',
    'lingyuPortrait': 'docs/danmaku/art/stage02-production-v1/lingyu-portrait-v1.png',
    'observerBackground': 'docs/danmaku/art/stage01-starroad-v2/stage01-starroad-source-v2.png',
    'lingyuBackground': 'docs/danmaku/art/stage02-production-v1/garden-scroll-source-v1.png',
    'observerBody': 'source/plugin/gamecenter/games/_danmaku_proto/assets/boss-body-atlas-v1.png',
    'lingyuBody': 'docs/danmaku/art/stage02-unity-v1/lingyu-idle-source-v1.png',
    'player': 'source/plugin/gamecenter/games/_danmaku_proto/assets/player-motion-v1.png',
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', type=Path, default=ROOT.parent / 'output/天使弹幕祭/演出短样')
    args = parser.parse_args()
    template = ROOT / 'docs/danmaku/review/BOSS-SPELL-PREVIEW-v1.html'
    html = template.read_text(encoding='utf-8')
    data = {key: 'data:image/png;base64,' + base64.b64encode((ROOT / name).read_bytes()).decode() for key, name in ASSETS.items()}
    font_dir = ROOT / 'docs/danmaku/fonts/spell-serif-v7'
    font = font_dir / 'danmaku-spell-serif-500.woff2'
    css = '@font-face{font-family:"Danmaku Spell Serif";font-weight:500;font-style:normal;font-display:block;src:url(data:font/woff2;base64,' + base64.b64encode(font.read_bytes()).decode() + ') format("woff2");}'
    notice = (font_dir / 'OFL.txt').read_text(encoding='utf-8').replace('--', '—')
    html = html.replace('<head>', '<!-- Noto Serif SC. Copyright 2017–2023 Adobe.\n' + notice + '\n-->\n<head>', 1)
    # Keep the full font notice inside the single offline artifact.
    assert notice in html
    sources = [CAMPAIGN / 'spell-preview-v1.js', CAMPAIGN / 'spell-preview-app-v1.js']
    html = html.replace('/* __FONT__ */', css).replace('/* __DATA__ */', 'window.SpellPreviewAssets=' + json.dumps(data, separators=(',', ':')) + ';')
    for tag, source in zip(['RENDERER', 'APP'], sources):
        html = html.replace('/* __' + tag + '__ */', source.read_text(encoding='utf-8').replace('</script', '<\\/script'))
    assert not re.search(r'/\* __[A-Z]+__ \*/', html)
    assert not re.search(r'<(?:script|img)[^>]+src=["\']https?:', html)
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    subprocess.run(['node', '-e', 'const vm=require("node:vm"),fs=require("node:fs");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'], input=json.dumps(scripts), text=True, capture_output=True, check=True)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / 'Boss符卡演出短样.html'
    output.write_text(html, encoding='utf-8')
    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    manifest = {'kind': 'independent-presentation-preview', 'revision': 1, 'introFrames': 120, 'landingDemoFrames': 120, 'defaultHeldFrame': 62,
                'battleIntegrated': False, 'audioIncluded': False, 'networkRequired': False, 'file': output.name, 'bytes': output.stat().st_size, 'sha256': sha(output),
                'assets': {key: {'source': name, 'sha256': sha(ROOT / name)} for key, name in ASSETS.items()},
                'sources': {str(p.relative_to(ROOT)).replace('\\', '/'): sha(p) for p in [template, *sources, font]}, 'copyright': '(C) 2026 Carinoasd; presentation 小典 / Codex; Noto Serif SC under OFL'}
    (args.output_dir / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'bytes': output.stat().st_size, 'sha256': sha(output)}, ensure_ascii=True))


if __name__ == '__main__':
    main()
