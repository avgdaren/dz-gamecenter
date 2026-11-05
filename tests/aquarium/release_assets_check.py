#!/usr/bin/env python3
"""Author: GPT / Codex; original plugin (C) 2026 Carinoasd. Offline bytes/decoding, not UI acceptance."""
import hashlib
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
assets = root / 'source/plugin/gamecenter/games/aquarium/assets'
checks = 0

def check(ok, label):
    global checks
    checks += 1
    assert ok, label

def blob(raw):
    return hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()

def file_check(path, record, blob_key='git_blob_sha'):
    raw = path.read_bytes()
    check(len(raw) == record['bytes'], 'bytes ' + path.name)
    check(hashlib.sha256(raw).hexdigest() == record['sha256'], 'sha256 ' + path.name)
    check(blob(raw) == record[blob_key], 'Git blob ' + path.name)

# The original 41-item art manifest remains scoped to its own files; later packs are separate.
old = json.loads((assets / 'manifest.json').read_text(encoding='utf-8'))
for item in old['items']:
    for record in item['files']:
        path = assets / record['file'] if 'file' in record else root / record['path']
        file_check(path, record, 'git_blob')
        with Image.open(path) as im:
            im.load()
            check(list(im.size) == record['size'], 'decoded size ' + path.name)

motion = json.loads((assets / 'fish-motion/v1/manifest.json').read_text(encoding='utf-8'))
check(len(motion['items']) == 16, '16 motion species')
new_ids = ['pond_curl_seahorse', 'pond_bell_jelly', 'bay_gummy_octopus', 'bay_moon_mermaid']
frames = {}
for item in motion['items']:
    path = assets / 'fish-motion/v1' / item['file']
    file_check(path, item)
    with Image.open(path) as im:
        im.load()
        w, h = item['frame_size']
        check(im.size == (w * item['grid'][0], h * item['grid'][1]), 'sheet geometry ' + item['id'])
        check('A' in im.getbands(), 'sheet alpha ' + item['id'])
        if item['id'] in new_ids:
            cells = [im.crop((i*w, 0, (i+1)*w, h)).tobytes() for i in range(item['frame_count'])]
            check(len(set(cells)) == item['frame_count'], 'distinct new poses ' + item['id'])
            frames[item['id']] = item['frame_count']
check(sorted(frames.values()) == [4,4,4,8], '20 new frames')

new = json.loads((assets / 'fish-next/v1/manifest.json').read_text(encoding='utf-8'))
for item in new['items']:
    for record in item['files'].values():
        path = assets / 'fish-next/v1' / record['file']
        raw = path.read_bytes()
        check(len(raw) == record['bytes'] and hashlib.sha256(raw).hexdigest() == record['sha256'], 'new static ' + path.name)
        with Image.open(path) as im:
            im.load()
            check(im.size == (record['width'], record['height']), 'new static decoded size')
    for role, folder in [('sprite','fish'),('icon','thumbs/fish')]:
        check((assets / folder / (item['id']+'.webp')).read_bytes() == (assets / 'fish-next/v1' / item['files'][role]['file']).read_bytes(), 'compatibility alias ' + item['id'])

final = json.loads((assets / 'feeding/final-v1/manifest.json').read_text(encoding='utf-8'))
for record in final['sound']['files']:
    file_check(assets / 'feeding/final-v1' / record['file'], record)
check(final['selection']['id'] == 'whistle_03', 'selected third sound')
check(final['playback']['play_count_per_event'] == 1 and final['playback']['loop'] is False, 'single voice contract')

user_audio = ['audio/user/sfx_splash_user.mp3','audio/user/sfx_splash_user.ogg']
missing_optional = [name for name in user_audio if not (assets / name).is_file()]
print(json.dumps(dict(status='PASS', checks=checks, motion_species=16, new_frames=frames,
    missing_optional=missing_optional, scope='actual asset bytes and image decoding; optional splash has runtime fallback; NOT browser/audio listening/forum acceptance')))
