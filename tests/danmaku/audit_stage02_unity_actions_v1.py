"""(C) 2026 Carinoasd. Unmodified generated action-source audit: 小典 / Codex."""
import json
from audit_stage02_art import ROOT, inspect

FOLDER = ROOT/'docs/danmaku/art/stage02-unity-actions-v1'
NAMES = {'fairyActions': 'garden-fairy-actions-v1.png',
         'attendantActions': 'bell-attendant-actions-v1.png',
         'lingyuActions': 'lingyu-actions-v1.png'}


def main():
    report = {key: inspect(FOLDER/name) for key, name in NAMES.items()}
    for v in report.values():
        assert v['colorType'] == 6 and v['alphaMin'] == 0 and v['alphaMax'] == 255
        assert max(v['cornerAlpha']) <= 1
        # Generated sheets can have odd dimensions; Canvas samples equal half
        # rectangles without modifying/resaving the source PNG.
        v['cellRectSize'] = [n/2 for n in v['dimensions']]
    prompts = json.loads((FOLDER/'generation-prompts.json').read_text(encoding='utf-8'))
    assert len(prompts['requests']) == 3
    assert all(len(v['referenceImages']) == 2 for v in prompts['requests'])
    (FOLDER/'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'unmodifiedSources': len(report)}))


if __name__ == '__main__':
    main()
