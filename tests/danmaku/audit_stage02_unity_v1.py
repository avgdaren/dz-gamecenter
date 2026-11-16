"""(C) 2026 Carinoasd. Inspect unchanged same-game reference sources: 小典 / Codex."""
import json
from audit_stage02_art import ROOT, inspect

FOLDER = ROOT/'docs/danmaku/art/stage02-unity-v1'
NAMES = {'fairySource': 'garden-fairy-idle-source-v1.png',
         'attendantSource': 'bell-attendant-idle-source-v1.png',
         'lingyuSource': 'lingyu-idle-source-v1.png'}


def main():
    report = {key: inspect(FOLDER/name) for key, name in NAMES.items()}
    for item in report.values():
        assert item['colorType'] == 6 and item['alphaMin'] == 0 and item['alphaMax'] == 255
        assert max(item['cornerAlpha']) <= 1 and item['generatedPixelsPreserved']
    prompts = json.loads((FOLDER/'generation-prompts.json').read_text(encoding='utf-8'))
    assert len(prompts['requests']) == 3
    assert all(len(row['referenceImages']) == 2 and row['prompt'] for row in prompts['requests'])
    (FOLDER/'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'unmodifiedTransparentSources': len(report)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
