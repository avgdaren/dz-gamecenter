"""(C) 2026 Carinoasd. Inspect unmodified garden action sources: 小典 / Codex."""
import json
from audit_stage02_art import ROOT, inspect

FOLDER = ROOT/'docs/danmaku/art/stage02-battle-v2'
NAMES = {'fairyActions': 'garden-fairy-actions-v2.png',
         'attendantActions': 'bell-attendant-actions-v2.png',
         'lingyuActions': 'lingyu-actions-v2.png'}


def main():
    report = {key: inspect(FOLDER/name) for key, name in NAMES.items()}
    for entry in report.values():
        w, h = entry['dimensions']
        assert w == h and w % 2 == 0
        assert entry['colorType'] == 6 and entry['alphaMin'] == 0 and entry['alphaMax'] == 255
        assert max(entry['cornerAlpha']) <= 1
        assert entry['transparentPixels'] > w*h*.3
    prompts = json.loads((FOLDER/'generation-prompts.json').read_text(encoding='utf-8'))
    assert len(prompts['requests']) == 3 and all(row['prompt'] for row in prompts['requests'])
    (FOLDER/'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'unmodifiedTransparentPngs': len(report)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
