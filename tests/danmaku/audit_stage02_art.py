"""(C) 2026 Carinoasd. PNG inspection, not image editing: 小典 / Codex."""
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT/'docs/danmaku/art/stage02-production-v1'


def paeth(a, b, c):
    p = a+b-c
    x, y, z = abs(p-a), abs(p-b), abs(p-c)
    return a if x <= y and x <= z else b if y <= z else c


def inspect(file):
    payload = file.read_bytes()
    assert payload[:8] == b'\x89PNG\r\n\x1a\n'
    at = 8
    compressed = []
    while at < len(payload):
        size = struct.unpack('>I', payload[at:at+4])[0]
        kind = payload[at+4:at+8]
        content = payload[at+8:at+8+size]
        crc = struct.unpack('>I', payload[at+8+size:at+12+size])[0]
        assert zlib.crc32(kind+content) & 0xffffffff == crc
        if kind == b'IHDR':
            w, h, depth, color, compression, filtering, interlace = struct.unpack('>IIBBBBB', content)
        elif kind == b'IDAT':
            compressed.append(content)
        at += size+12
        if kind == b'IEND':
            break
    assert at == len(payload)
    assert depth == 8 and color in (2, 6) and (compression, filtering, interlace) == (0, 0, 0)
    channels = 4 if color == 6 else 3
    stride = w*channels
    raw = zlib.decompress(b''.join(compressed))
    assert len(raw) == h*(stride+1)
    old = bytearray(stride)
    alpha_hist = [0]*256
    bounds = [w, h, -1, -1]
    corners = []
    for y in range(h):
        offset = y*(stride+1)
        mode = raw[offset]
        row = bytearray(raw[offset+1:offset+1+stride])
        assert 0 <= mode <= 4
        if mode:
            for x in range(stride):
                a = row[x-channels] if x >= channels else 0
                b = old[x]
                c = old[x-channels] if x >= channels else 0
                predictor = a if mode == 1 else b if mode == 2 else (a+b)//2 if mode == 3 else paeth(a, b, c)
                row[x] = (row[x]+predictor) & 255
        values = row[3::4] if channels == 4 else bytes([255])*w
        if y in (0, h-1):
            corners.extend([values[0], values[-1]])
        visible = []
        for x, a in enumerate(values):
            alpha_hist[a] += 1
            if a >= 128:
                visible.append(x)
        if visible:
            bounds = [min(bounds[0], visible[0]), min(bounds[1], y), max(bounds[2], visible[-1]), y]
        old = row
    return {'file': file.name, 'dimensions': [w, h], 'bytes': len(payload),
        'sha256': hashlib.sha256(payload).hexdigest(), 'colorType': color,
        'transparentPixels': alpha_hist[0], 'partialAlphaPixels': sum(alpha_hist[1:255]),
        'alphaMin': next(i for i, n in enumerate(alpha_hist) if n),
        'alphaMax': max(i for i, n in enumerate(alpha_hist) if n),
        'cornerAlpha': corners, 'visibleBoundsAlpha128': bounds,
        'generatedPixelsPreserved': True}


def main():
    names = {'portrait': 'lingyu-portrait-v1.png', 'battle': 'lingyu-battle-source-v1.png',
             'garden': 'garden-scroll-source-v1.png'}
    report = {key: inspect(FOLDER/name) for key, name in names.items()}
    for key in ('portrait', 'battle'):
        r = report[key]
        assert r['colorType'] == 6 and r['transparentPixels'] > r['dimensions'][0]*r['dimensions'][1]*.1
        # Allow a single quantization unit in a generated alpha corner.
        assert max(r['cornerAlpha']) <= 1 and r['alphaMax'] >= 240
    assert report['garden']['alphaMin'] >= 250
    assert report['garden']['dimensions'][1] / report['garden']['dimensions'][0] >= 2.5
    (FOLDER/'source-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'assets': report}, ensure_ascii=False))


if __name__ == '__main__':
    main()
