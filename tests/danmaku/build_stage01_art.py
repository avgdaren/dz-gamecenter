#!/usr/bin/env python3
# (C) 2026 Carinoasd. Optional generated-art preparation: 小典 / Codex.
"""Crop, align, nearest-neighbor resize and palette generated stage assets.

Standard library only; originals are read-only. Uses the previously authorized
sprite preparation workflow. It changes no gameplay or replay rules.
"""
import argparse
import hashlib
import json
from pathlib import Path
from collections import deque
from build_player_art import read_png, write_png, PALETTE_HEX

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/danmaku/art/stage01-production-v1'
COLORS = PALETTE_HEX + ['#8FBDE5', '#A8D2EE', '#A49BC4', '#6D648E', '#D9C191', '#8CAACB', '#32485E', '#C3AC7F']
PALETTE = [tuple(bytes.fromhex(v[1:])) for v in COLORS]
SPECS = {
    'fairy': {'size': (48, 48), 'anchor': (24, 24), 'box': (42, 40), 'radius': 8, 'rows': ['hover', 'left', 'right']},
    'attendant': {'size': (48, 64), 'anchor': (24, 32), 'box': (38, 54), 'radius': 10, 'rows': ['hover', 'charge', 'fire']},
    'guardian': {'size': (80, 80), 'anchor': (40, 40), 'box': (74, 74), 'radius': 22, 'rows': ['idle', 'charge', 'fire']},
}


def component(data, width, height, cell):
    left, top, right, bottom = cell
    opaque = {(x, y) for y in range(top, bottom) for x in range(left, right) if data[(y * width + x) * 4 + 3] >= 192}
    biggest = set()
    while opaque:
        start = opaque.pop()
        found, todo = {start}, deque([start])
        while todo:
            x, y = todo.popleft()
            for p in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if p in opaque:
                    opaque.remove(p)
                    found.add(p)
                    todo.append(p)
        if len(found) > len(biggest):
            biggest = found
    assert len(biggest) > 1000, 'No solid sprite found'
    xs, ys = zip(*biggest)
    box = min(xs), min(ys), max(xs) + 1, max(ys) + 1
    return biggest, box


def sprite_set(name, spec, destination):
    path = SOURCE / (name + '-source-v1.png')
    width, height, data = read_png(path)
    assert width * 3 == height * 4, 'Expected regular 4 by 3 sheet'
    frames = []
    for row in range(3):
        for col in range(4):
            cell = round(col * width / 4), round(row * height / 3), round((col + 1) * width / 4), round((row + 1) * height / 3)
            mask, box = component(data, width, height, cell)
            l, t, r, b = box
            if name == 'guardian':
                anchor = ((l + r) / 2, (t + b) / 2)
            else:
                # Head center is stable when wings or the staff move.
                head = [x for x, y in mask if y < t + (b - t) * .35]
                anchor = (sum(head) / len(head), t + (b - t) * .60)
            frames.append((mask, box, anchor))
    w, h = spec['size']
    ax, ay = spec['anchor']
    scale = min(min(spec['box'][0] / (b[2] - b[0]), spec['box'][1] / (b[3] - b[1]),
                    (ax - 2) / (a[0] - b[0]), (w - ax - 2) / (b[2] - a[0]),
                    (ay - 2) / (a[1] - b[1]), (h - ay - 2) / (b[3] - a[1])) for _, b, a in frames)
    atlas = bytearray(w * 4 * h * 3 * 4)
    audit = []
    cache = {}
    for i, (mask, box, a) in enumerate(frames):
        pixels = bytearray(w * h * 4)
        for y in range(h):
            sy = int(a[1] + (y - ay + .5) / scale)
            for x in range(w):
                sx = int(a[0] + (x - ax + .5) / scale)
                if (sx, sy) not in mask:
                    continue
                source = (sy * width + sx) * 4
                color = tuple(data[source:source + 3])
                if color not in cache:
                    cache[color] = min(PALETTE, key=lambda c: sum((c[j] - color[j]) ** 2 for j in range(3)))
                p = (y * w + x) * 4
                pixels[p:p + 4] = bytes((*cache[color], 255))
        occupied = [(x, y) for y in range(h) for x in range(w) if pixels[(y * w + x) * 4 + 3]]
        assert occupied
        xs, ys = zip(*occupied)
        assert min(xs) >= 1 and max(xs) < w - 1 and min(ys) >= 1 and max(ys) < h - 1, 'Clipped sprite'
        core = [(x, y) for y in range(h) for x in range(w) if (x + .5 - ax) ** 2 + (y + .5 - ay) ** 2 <= spec['radius'] ** 2]
        coverage = sum(pixels[(y * w + x) * 4 + 3] == 255 for x, y in core) / len(core)
        audit.append({'frame': i, 'sourceBounds': box, 'sourceAnchor': a, 'opaque': len(occupied), 'coreCoverage': round(coverage, 4)})
        frame_path = destination / 'frames' / (name + '-' + str(i) + '.png')
        write_png(frame_path, w, h, pixels)
        col, row = i % 4, i // 4
        for y in range(h):
            start = ((row * h + y) * (w * 4) + col * w) * 4
            atlas[start:start + w * 4] = pixels[y * w * 4:(y + 1) * w * 4]
    write_png(destination / (name + '-v1.png'), w * 4, h * 3, atlas)
    return {**spec, 'scale': scale, 'sourceSize': [width, height], 'frames': audit}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=SOURCE / 'native-v1')
    args = parser.parse_args()
    dest = args.output.resolve()
    if dest.exists():
        raise SystemExit('Output directory already exists; use a new version/path')
    (dest / 'frames').mkdir(parents=True)
    sources = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCE.glob('*-source-v1.png')}
    manifest = {'author': '小典 / Codex', 'copyright': '(C) 2026 Carinoasd', 'sourceHashes': sources,
                'palette': COLORS, 'alpha': [0, 255], 'sprites': {}}
    for name, spec in SPECS.items():
        manifest['sprites'][name] = sprite_set(name, spec, dest)
    width, height, data = read_png(SOURCE / 'corridor-source-v1.png')
    assert height == width * 3
    w, h = 480, 1440
    pixels = bytearray(w * h * 4)
    for y in range(h):
        sy = min(height - 1, int((y + .5) * height / h))
        for x in range(w):
            sx = min(width - 1, int((x + .5) * width / w))
            p, s = (y * w + x) * 4, (sy * width + sx) * 4
            pixels[p:p + 4] = data[s:s + 4]
    write_png(dest / 'corridor-v1.png', w, h, pixels)
    manifest['background'] = {'size': [w, h], 'sourceSize': [width, height], 'travelPixels': h - 640, 'repeat': False}
    for name, digest in sources.items():
        assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == digest
    (dest / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'status': 'PASS', 'frames': 36, 'background': [w, h], 'minimumCoreCoverage': {name: min(f['coreCoverage'] for f in v['frames']) for name, v in manifest['sprites'].items()}, 'sourceHashesPreserved': True}))


if __name__ == '__main__':
    main()
