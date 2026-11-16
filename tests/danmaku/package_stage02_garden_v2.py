"""(C) 2026 Carinoasd. Self-contained Stage 2 art/music preview: 小典 / Codex."""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT/'source/plugin/gamecenter/games/_danmaku_proto'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', type=Path, default=ROOT.parent/'output')
    args = parser.parse_args()
    art = ROOT/'docs/danmaku/art/stage02-production-v1'
    garden = ROOT/'docs/danmaku/art/stage02-garden-v2'
    garden_audit = json.loads((garden/'source-audit.json').read_text(encoding='utf-8'))
    music = ROOT/'docs/danmaku/audio/stage02-user-v1'
    review = ROOT/'docs/danmaku/review'
    audit = json.loads((art/'source-audit.json').read_text(encoding='utf-8'))
    music_manifest = json.loads((music/'manifest.json').read_text(encoding='utf-8'))
    files = {'portrait': art/'lingyu-portrait-v1.png', 'battle': art/'lingyu-battle-source-v1.png',
             'player': RUNTIME/'assets/player-motion-v1.png',
             'bullets': RUNTIME/'assets/projectile-atlas-v1.png'}
    for key in ('portrait', 'battle'):
        assert sha(files[key].read_bytes()) == audit[key]['sha256']
    audit = {key: audit[key] for key in ('portrait', 'battle')}
    for key, entry in garden_audit.items():
        files[key] = garden/entry['file']
        assert sha(files[key].read_bytes()) == entry['sha256']
        audit[key] = entry
    assets = {key: 'data:image/png;base64,'+base64.b64encode(file.read_bytes()).decode('ascii')
              for key, file in files.items()}
    entries = {}
    for key, target in [('stage', 'stage'), ('boss', 'bossCore')]:
        meta = music_manifest['entries'][key]
        payload = (music/meta['file']).read_bytes()
        assert sha(payload) == meta['sha256']
        entries[target] = {'kind': 'music', 'mime': 'audio/mpeg', 'loop': False,
            'seconds': meta['decodedPcm']['seconds'], 'data': base64.b64encode(payload).decode('ascii')}
    data = {'assets': assets, 'layout': {key: garden_audit[key]['visibleBoundsAlpha128'] for key in ('rail', 'arch')}, 'bank': {'v': 1, 'format': 'recorded-user-stage02', 'entries': entries},
            'seconds': {'tour': entries['stage']['seconds'], 'boss': entries['bossCore']['seconds']}}
    modules = ['audio.js', 'player-view.js', 'bullet-materials.js']
    runtime = '\n'.join((RUNTIME/name).read_text(encoding='utf-8') for name in modules)
    runtime += '\n'+(review/'stage02-garden-v2.js').read_text(encoding='utf-8')
    html = (review/'STAGE-02-SHOW-v2.html').read_text(encoding='utf-8')
    html = html.replace('/* __RUNTIME__ */', runtime.replace('</script', '<\\/script'))
    html = html.replace('/* __DATA__ */', 'window.Stage02ShowData='+json.dumps(data, ensure_ascii=False, separators=(',', ':'))+';')
    html = html.replace('/* __PREVIEW__ */', (review/'stage02-show-v2.js').read_text(encoding='utf-8').replace('</script', '<\\/script'))
    assert not re.search(r'/\* __(RUNTIME|DATA|PREVIEW)__ \*/', html)
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S)
    assert len(scripts) == 2
    subprocess.run(['node', '-e', 'const vm=require("node:vm"),fs=require("node:fs");for(const s of JSON.parse(fs.readFileSync(0,"utf8")))new vm.Script(s);'],
                   input=json.dumps(scripts), text=True, capture_output=True, check=True)
    class Links(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for name, value in attrs:
                if name in ('src', 'href'):
                    assert value.startswith(('data:', '#')), value
    Links().feed(html)
    ids = re.findall(r'\bid="([^"]+)"', html)
    assert len(ids) == len(set(ids))
    assert set(re.findall(r"\$\('([^']+)'\)", (review/'stage02-show-v2.js').read_text(encoding='utf-8'))) <= set(ids)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    name = 'danmaku-stage02-show-v2-offline.html'
    payload = html.encode('utf-8')
    target = args.output_dir/name
    assert not target.exists() or target.read_bytes() == payload, 'Use a new candidate directory'
    target.write_bytes(payload)
    manifest = {'version': 2, 'date': '2026-11-14', 'author': '小典 / Codex',
        'prototypeCopyright': '(C) 2026 Carinoasd', 'type': 'perspective-garden-art-and-music-preview',
        'gameplayIntegrated': False, 'gardenScene': 'bright winding path, depth-scaled railings and wind-bell arches', 'stageLengthChosen': False, 'musicLoopChosen': False,
        'battleTexture': 'single-pose source, not a native production atlas', 'assets': audit,
        'music': {key: {'sha256': v['sha256'], 'seconds': v['decodedPcm']['seconds']}
                  for key, v in music_manifest['entries'].items()},
        'output': {'file': name, 'bytes': len(payload), 'sha256': sha(payload)}}
    browser = ROOT/'tmp/danmaku/stage02-show-v2/browser/checks.json'
    manifest['browserVerification'] = False
    if browser.exists():
        report = json.loads(browser.read_text(encoding='utf-8'))
        if report.get('status') == 'PASS' and report.get('sha256') == sha(payload):
            manifest['browserVerification'] = report
    (args.output_dir/'danmaku-stage02-show-v2-MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', **manifest['output']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
