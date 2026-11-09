#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。内容美术文件/alpha/尺寸/ID/哈希验收，不是界面或实站验收。"""
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
from PIL import Image

root = Path(__file__).resolve().parents[2]
out = root/'source/plugin/gamecenter/games/aquarium/assets'
art = root/'docs/aquarium/art'
m = json.loads((out/'manifest.json').read_text())
registry = json.loads((art/'asset-map-v0.1.json').read_text())
candidate = json.loads((out.parent/'data/content-v1-candidate.json').read_text())
checks = 0


def ck(ok, message):
    global checks
    checks += 1
    assert ok, message


ck(Counter(x['kind'] for x in m['items']) == {'fish': 12, 'decor': 24, 'background': 2, 'water': 2, 'icon': 1}, '41 items')
ck(m['decor_slot_count'] is None, 'decor slots not frozen')
ck(len({(x['kind'], x['id']) for x in m['items']}) == 41, 'unique kind/id')
for kind in ['fish', 'decor']:
    ids = [x['id'] for x in m['items'] if x['kind'] == kind]
    ck(ids == [x['id'] for x in registry[kind]], 'registry order '+kind)
    ck(set(ids) == set(candidate[kind]), 'candidate IDs '+kind)
seen = set()
for item in m['items']:
    master = root/item['master']
    ck(hashlib.sha256(master.read_bytes()).hexdigest() == item['source_sha256'], 'source '+item['id'])
    for f in item['files']:
        ck(bool(re.fullmatch(r'[a-z0-9_/.-]+', f['file'])) and '..' not in Path(f['file']).parts, 'safe ASCII path')
        ck(f['file'] not in seen, 'no duplicate file')
        seen.add(f['file'])
        path = out/f['file']
        raw = path.read_bytes()
        ck(len(raw) == f['bytes'] and hashlib.sha256(raw).hexdigest() == f['sha256'], 'file sha256')
        ck(hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest() == f['git_blob'], 'Git blob')
        with Image.open(path) as im:
            ck(im.format == 'WEBP' and list(im.size) == f['size'], 'WebP and dimensions')
            kind, role = item['kind'], f['role']
            if kind in ['fish', 'decor', 'icon']:
                expected = [128, 128] if role == 'thumb' else [256, 256] if kind == 'icon' else next(x['target_px'] for x in registry[kind] if x['id'] == item['id'])
                ck(list(im.size) == expected, 'sprite size')
                ck('A' in im.getbands(), 'actual alpha')
                a = im.getchannel('A')
                lo, hi = a.getextrema()
                ck(lo == 0 and hi >= 240, 'transparent outside / visible subject')
                box = a.getbbox()
                ck(box and box[0] > 0 and box[1] > 0 and box[2] < im.width and box[3] < im.height, 'non-clipped frame')
                if item['id'] == 'building_moon_gate' and role == 'main':
                    ck(a.getpixel((im.width//2, im.height//2)) == 0, 'moon gate empty opening')
            else:
                expected = [480, 270] if kind == 'water' else [960, 720] if role == 'mobile' else [1600, 900]
                ck(list(im.size) == expected, 'scene dimensions')
for old in json.loads((art/'samples/manifest-v02.json').read_text())['samples']:
    ck(hashlib.sha256((root/old['path']).read_bytes()).hexdigest() == old['sha256'], 'approved master unchanged '+old['id'])
ck(len(seen) == 79, '79 runtime images')
extra = set()
motion = json.loads((out/'fish-motion/v1/manifest.json').read_text(encoding='utf-8'))
extra.update('fish-motion/v1/'+x['file'] for x in motion['items'])
next_fish = json.loads((out/'fish-next/v1/manifest.json').read_text(encoding='utf-8'))
for x in next_fish['items']:
    extra.update('fish-next/v1/'+f['file'] for f in x['files'].values() if f['file'].endswith('.webp'))
    extra.update(folder+'/'+x['id']+'.webp' for folder in ['fish','thumbs/fish'])
feeding = json.loads((out/'feeding/v1/manifest.json').read_text(encoding='utf-8'))
extra.update('feeding/v1/'+f['file'] for f in feeding['files'] if f['file'].endswith('.webp'))
scenery = json.loads((out/'background/expansion-v1/catalog.json').read_text(encoding='utf-8'))
for x in scenery['items']:
    extra.update(x[k] for k in ['background','mobile','thumbnail'])
actual = {str(p.relative_to(out)).replace('\\','/') for p in out.rglob('*.webp')}
ck(seen | extra == actual, 'all WebP files belong to an explicit pack or compatibility alias')
print(json.dumps(dict(status='PASS', checks=checks, items=41, runtime_images=len(seen), bytes=sum(f['bytes'] for x in m['items'] for f in x['files']), scope='asset files only; not player UI/mobile/performance/forum acceptance')))
