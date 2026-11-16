"""(C) 2026 Carinoasd. Inspect unmodified generated PNGs: 小典 / Codex."""
import json
from audit_stage02_art import ROOT, inspect

FOLDER = ROOT/'docs/danmaku/art/stage02-garden-v2'
NAMES = {'sky': 'garden-sky-v2.png', 'paving': 'garden-paving-v2.png',
         'rail': 'garden-rail-v2.png', 'arch': 'garden-arch-v2.png'}


def main():
    report = {key: inspect(FOLDER/name) for key, name in NAMES.items()}
    for key in ('rail', 'arch'):
        r = report[key]
        assert r['colorType'] == 6 and r['transparentPixels'] > r['dimensions'][0]*r['dimensions'][1]*.1
        assert max(r['cornerAlpha']) <= 1 and r['alphaMax'] >= 240
    for key in ('sky', 'paving'):
        assert report[key]['alphaMin'] >= 250
    (FOLDER/'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'assets': report}, ensure_ascii=False))


if __name__ == '__main__':
    main()
