#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。检查六张真实RGBA表情层与清单。"""
from pathlib import Path
import hashlib,json
try:
    from PIL import Image
except ModuleNotFoundError as exc:
    if exc.name not in ('PIL', 'PIL.Image'):
        raise
    print(json.dumps({'status':'SKIP','checks':0,'reason':'Pillow missing; install with: python -m pip install Pillow. SKIP is not PASS.'}))
    raise SystemExit(0)
ROOT=Path(__file__).resolve().parents[2]
manifest=json.loads((ROOT/'docs/raid/art/faces/manifest.json').read_text())
checks=0
for entry in manifest:
    path=ROOT/entry['file']; image=Image.open(path).convert('RGBA');alpha=image.getchannel('A')
    assert image.size==(768,768);checks+=1
    assert 0<path.stat().st_size<=40000;checks+=1
    assert all(alpha.getpixel(xy)==0 for xy in ((0,0),(767,0),(0,767),(767,767)));checks+=1
    assert alpha.getextrema()==(0,255);checks+=1
    bounds=alpha.getbbox();assert bounds and bounds[0]>150 and bounds[1]>30 and bounds[2]<580 and bounds[3]<440;checks+=1
    assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'];checks+=1
assert len(manifest)==6;checks+=1
print(json.dumps({'status':'PASS','checks':checks,'scope':'real image geometry/alpha/budget/hash; alignment also visually reviewed'}))
