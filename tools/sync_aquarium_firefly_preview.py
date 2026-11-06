#!/usr/bin/env python3
"""作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。
Keep the offline preview's embedded JSON identical to the reviewed manifests.
"""
import json
import re
from pathlib import Path

ART = Path(__file__).resolve().parents[1] / 'docs/aquarium/art/firefly-v1'


def sync():
    page = ART / 'index.html'
    html = page.read_text(encoding='utf-8')
    for element, file in [('art-data', 'manifest.json'), ('export-data', 'runtime-candidate/manifest.json'),
                          ('commerce-data', 'commerce-proposal.json')]:
        data = json.loads((ART / file).read_text(encoding='utf-8'))
        encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
        tag = '<script id="{}" type="application/json">{}</script>'.format(element, encoded)
        html, count = re.subn(r'<script id="' + element + r'" type="application/json">.*?</script>', lambda _: tag, html, flags=re.S)
        if count != 1:
            raise ValueError('Expected one JSON block: ' + element)
    page.write_text(html, encoding='utf-8')
    print('PASS: three preview JSON blocks synchronized')


if __name__ == '__main__':
    sync()
