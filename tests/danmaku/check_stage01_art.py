#!/usr/bin/env python3
# (C) 2026 Carinoasd. Stage asset validation: 小典 / Codex.
import hashlib
import json
from pathlib import Path
from build_player_art import read_png

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/danmaku/art/stage01-production-v1'
NATIVE = SOURCE / 'native-v1'
RUNTIME = ROOT / 'source/plugin/gamecenter/games/_danmaku_proto/assets'
manifest = json.loads((NATIVE / 'manifest.json').read_text(encoding='utf-8'))
for name, digest in manifest['sourceHashes'].items():
    assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == digest
palette = {tuple(bytes.fromhex(v[1:])) for v in manifest['palette']}
frame_count = 0
for name, spec in manifest['sprites'].items():
    w, h = spec['size']
    assert read_png(NATIVE / (name + '-v1.png'))[:2] == (w * 4, h * 3)
    assert (NATIVE / (name + '-v1.png')).read_bytes() == (RUNTIME / ('stage01-' + name + '-v1.png')).read_bytes()
    for i, audit in enumerate(spec['frames']):
        fw, fh, p = read_png(NATIVE / 'frames' / (name + '-' + str(i) + '.png'))
        assert (fw, fh) == (w, h)
        assert all(a in (0, 255) for a in p[3::4])
        assert all(tuple(p[n:n + 3]) in palette for n in range(0, len(p), 4) if p[n + 3])
        assert audit['coreCoverage'] >= .95
        frame_count += 1
w, h, data = read_png(NATIVE / 'corridor-v1.png')
assert (w, h) == (480, 1440)
assert (NATIVE / 'corridor-v1.png').read_bytes() == (RUNTIME / 'stage01-corridor-v1.png').read_bytes()
assert all(a == 255 for a in data[3::4])
central = []
for y in range(h):
    for x in range(80, 400, 4):
        p = (y * w + x) * 4
        central.append((.2126 * data[p] + .7152 * data[p + 1] + .0722 * data[p + 2]) * .78)
central.sort()
assert central[int(len(central) * .99)] < 70
out = ROOT / 'tmp/danmaku/stage01-art'
out.mkdir(parents=True, exist_ok=True)
report = {'status': 'PASS', 'frames': frame_count, 'paletteColors': len(palette), 'binaryAlpha': True,
          'background': [w, h], 'centralLuminanceP99WithShade': round(central[int(len(central) * .99)], 2),
          'runtimeMatchesPreparedArt': True, 'originalHashesPreserved': True}
(out / 'asset-checks.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
