#!/usr/bin/env python3
# (C) 2026 Carinoasd. Offline art preparation: 小典 / Codex.
"""Prepare approved generated player art using only Python's standard library.

This is an offline asset utility, not a game runtime dependency. Original PNGs
are read only. The output directory must be new so source/previous versions
cannot be overwritten accidentally.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import struct
import zlib

PALETTE_HEX = [
    '#1A2440', '#28345D', '#3D497B', '#53639D', '#6476AF',
    '#F9E0AB', '#ECC38A', '#C99864', '#966A48', '#6B4937',
    '#F4F0E8', '#DCD9E7', '#B9B8D2', '#8E96BA', '#E5B94F',
    '#B98632', '#FAD2BA', '#ECAE96', '#477ED0', '#76B2E3',
    '#284F9F', '#1C1F32', '#FFF2D1', '#737A98',
]
PALETTE = [tuple(bytes.fromhex(c[1:])) for c in PALETTE_HEX]
ALPHA_CUTOFF = 192
FRAME_SIZE = 48
ANCHOR = (24, 28)
MODES = ('idle', 'left', 'right')


def read_png(path):
    data = Path(path).read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Not a PNG: ' + str(path))
    pos, compressed, header = 8, bytearray(), None
    while pos < len(data):
        size = struct.unpack('>I', data[pos:pos + 4])[0]
        kind, chunk = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + size]
        crc = struct.unpack('>I', data[pos + 8 + size:pos + 12 + size])[0]
        if zlib.crc32(kind + chunk) & 0xffffffff != crc:
            raise ValueError('PNG CRC mismatch')
        if kind == b'IHDR':
            header = struct.unpack('>IIBBBBB', chunk)
        elif kind == b'IDAT':
            compressed.extend(chunk)
        pos += size + 12
    w, h, depth, color, compression, filtering, interlace = header
    if depth != 8 or color not in (2, 6) or interlace or compression or filtering:
        raise ValueError('Expected non-interlaced 8-bit RGB/RGBA PNG')
    bpp, decoded = (4 if color == 6 else 3), zlib.decompress(compressed)
    stride, previous, offset, pixels = w * bpp, bytearray(w * bpp), 0, bytearray()
    if len(decoded) != h * (stride + 1):
        raise ValueError('Unexpected PNG scanline length')
    for _ in range(h):
        method = decoded[offset]
        row = bytearray(decoded[offset + 1:offset + 1 + stride])
        offset += stride + 1
        for x in range(stride):
            a, b = (row[x - bpp] if x >= bpp else 0), previous[x]
            c = previous[x - bpp] if x >= bpp else 0
            if method == 0:
                value = 0
            elif method == 1:
                value = a
            elif method == 2:
                value = b
            elif method == 3:
                value = (a + b) // 2
            elif method == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                value = a if pa <= pb and pa <= pc else b if pb <= pc else c
            else:
                raise ValueError('Unknown PNG filter')
            row[x] = (row[x] + value) & 255
        previous = row
        if bpp == 4:
            pixels.extend(row)
        else:
            for x in range(0, stride, 3):
                pixels.extend(row[x:x + 3] + b'\xff')
    return w, h, pixels


def png_chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)


def write_png(path, w, h, pixels):
    assert len(pixels) == w * h * 4
    scanlines = b''.join(b'\0' + bytes(pixels[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    data = b'\x89PNG\r\n\x1a\n'
    data += png_chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    data += png_chunk(b'IDAT', zlib.compress(scanlines, 9)) + png_chunk(b'IEND', b'')
    Path(path).write_bytes(data)


def solid_mask(w, h, pixels, minimum_component=16):
    mask = bytearray(pixels[i + 3] >= ALPHA_CUTOFF for i in range(0, len(pixels), 4))
    visited, removed = bytearray(w * h), 0
    for start in range(w * h):
        if not mask[start] or visited[start]:
            continue
        visited[start], todo, component = 1, [start], []
        while todo:
            p = todo.pop()
            component.append(p)
            x, y = p % w, p // w
            for ny in range(max(0, y - 1), min(h, y + 2)):
                for nx in range(max(0, x - 1), min(w, x + 2)):
                    q = ny * w + nx
                    if mask[q] and not visited[q]:
                        visited[q] = 1
                        todo.append(q)
        if len(component) < minimum_component:
            removed += len(component)
            for p in component:
                mask[p] = 0
    return mask, removed


def bounding_box(w, h, mask):
    points = [i for i, solid in enumerate(mask) if solid]
    if not points:
        raise ValueError('Empty character')
    return [min(i % w for i in points), min(i // w for i in points),
            max(i % w for i in points), max(i // w for i in points)]


def cell_pixels(w, pixels, x, y, width, height):
    return bytearray().join(pixels[((y + yy) * w + x) * 4:((y + yy) * w + x + width) * 4] for yy in range(height))


def waist_anchor(w, h, pixels, mask, box):
    center = (box[0] + box[2]) / 2
    candidates = []
    for y in range(round(h * .46), round(h * .61)):
        for x in range(max(0, round(center - w * .06)), min(w, round(center + w * .06))):
            i = y * w + x
            r, g, b = pixels[i * 4:i * 4 + 3]
            if mask[i] and r >= 150 and g >= 105 and r - g >= 28 and g - b >= 45 and b <= 155:
                candidates.append((x, y))
    if len(candidates) < 8:
        raise ValueError('Cannot locate waist gold trim; inspect source rather than guessing')
    x = statistics.median(p[0] for p in candidates)
    y = max(p[1] for p in candidates) + 5
    return (x, y), len(candidates)


def nearest_color(rgb, cache):
    if rgb not in cache:
        cache[rgb] = min(PALETTE, key=lambda p: 3 * (rgb[0] - p[0]) ** 2 +
                         4 * (rgb[1] - p[1]) ** 2 + 2 * (rgb[2] - p[2]) ** 2)
    return cache[rgb]


def resample(w, h, pixels, mask, out_w, out_h, source_anchor, destination_anchor, scale, cache):
    result = bytearray(out_w * out_h * 4)
    for y in range(out_h):
        sy = math.floor(source_anchor[1] + (y + .5 - destination_anchor[1]) / scale)
        for x in range(out_w):
            sx = math.floor(source_anchor[0] + (x + .5 - destination_anchor[0]) / scale)
            if 0 <= sx < w and 0 <= sy < h and mask[sy * w + sx]:
                rgb = tuple(pixels[(sy * w + sx) * 4:(sy * w + sx) * 4 + 3])
                p = (y * out_w + x) * 4
                result[p:p + 4] = bytes(nearest_color(rgb, cache)) + b'\xff'
    final_mask, removed = solid_mask(out_w, out_h, result, minimum_component=2)
    for i, solid in enumerate(final_mask):
        if not solid:
            result[i * 4:i * 4 + 4] = b'\0\0\0\0'
    return result, removed


def inspect_native(w, h, pixels):
    alpha = set(pixels[3::4])
    colors = {tuple(pixels[i:i + 3]) for i in range(0, len(pixels), 4) if pixels[i + 3]}
    assert alpha <= {0, 255} and colors <= set(PALETTE)
    assert all(pixels[i:i + 3] == b'\0\0\0' for i in range(0, len(pixels), 4) if pixels[i + 3] == 0)
    mask = bytearray(a == 255 for a in pixels[3::4])
    box = bounding_box(w, h, mask)
    assert box[0] > 0 and box[1] > 0 and box[2] < w - 1 and box[3] < h - 1
    return {'size': [w, h], 'alpha_values': sorted(alpha), 'opaque_colors': len(colors),
            'opaque_pixels': sum(mask), 'bbox': box, 'rgba_sha256': hashlib.sha256(pixels).hexdigest()}


def enlarge(w, h, pixels, factor):
    result = bytearray(w * factor * h * factor * 4)
    out_w = w * factor
    for y in range(h * factor):
        for x in range(out_w):
            start, end = ((y // factor) * w + x // factor) * 4, (y * out_w + x) * 4
            result[end:end + 4] = pixels[start:start + 4]
    return out_w, h * factor, result


def write_apng(path, w, h, frames, fps=8):
    # PNG Third Edition, acTL/fcTL/fdAT: https://www.w3.org/TR/png-3/
    data = b'\x89PNG\r\n\x1a\n'
    data += png_chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    data += png_chunk(b'acTL', struct.pack('>II', len(frames), 0))
    sequence = 0
    for index, pixels in enumerate(frames):
        control = struct.pack('>IIIIIHHBB', sequence, w, h, 0, 0, 1, fps, 0, 0)
        data += png_chunk(b'fcTL', control)
        sequence += 1
        scanlines = b''.join(b'\0' + bytes(pixels[y * w * 4:(y + 1) * w * 4]) for y in range(h))
        compressed = zlib.compress(scanlines, 9)
        if index == 0:
            data += png_chunk(b'IDAT', compressed)
        else:
            data += png_chunk(b'fdAT', struct.pack('>I', sequence) + compressed)
            sequence += 1
    data += png_chunk(b'IEND', b'')
    Path(path).write_bytes(data)


def write_animation_previews(output):
    targets = [output / (mode + '-preview-2x.png') for mode in MODES]
    if any(target.exists() for target in targets):
        raise ValueError('Animation previews already exist')
    for mode, target in zip(MODES, targets):
        frames = []
        for index in range(4):
            w, h, pixels = read_png(output / 'frames' / (mode + '-' + str(index) + '.png'))
            assert (w, h) == (48, 48)
            ew, eh, frame = enlarge(w, h, pixels, 2)
            frames.append(frame)
        write_apng(target, ew, eh, frames)


def build(source_directory, output):
    if output.exists():
        raise ValueError('Output directory already exists; select a new version')
    atlas_path = source_directory / 'player-motion-atlas-source-v1.png'
    portrait_path = source_directory / 'player-front-display-source-v1.png'
    originals = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in source_directory.glob('*source*.png')}
    w, h, pixels = read_png(atlas_path)
    assert w % 4 == 0 and h % 3 == 0 and w // 4 == h // 3
    cell, prepared = w // 4, []
    for row in range(3):
        for column in range(4):
            part = cell_pixels(w, pixels, column * cell, row * cell, cell, cell)
            mask, removed = solid_mask(cell, cell, part)
            box = bounding_box(cell, cell, mask)
            anchor, candidates = waist_anchor(cell, cell, part, mask, box)
            prepared.append({'row': row, 'column': column, 'pixels': part, 'mask': mask,
                             'bbox': box, 'anchor': anchor, 'anchor_gold_pixels': candidates,
                             'removed_source_speck_pixels': removed})
    scale = 40 / max(item['bbox'][3] - item['bbox'][1] + 1 for item in prepared)
    cache, frames, atlas = {}, [], bytearray(192 * 144 * 4)
    native_frames = []
    for item in prepared:
        native, specks = resample(cell, cell, item['pixels'], item['mask'], 48, 48,
                                 item['anchor'], ANCHOR, scale, cache)
        meta = inspect_native(48, 48, native)
        assert native[(ANCHOR[1] * 48 + ANCHOR[0]) * 4 + 3] == 255
        star = [(x, y) for y in range(22) for x in range(48)
                if tuple(native[(y * 48 + x) * 4:(y * 48 + x) * 4 + 3]) in set(PALETTE[18:21])
                and native[(y * 48 + x) * 4 + 3]]
        assert len(star) >= 2 and statistics.mean(x for x, y in star) < ANCHOR[0]
        meta.update({'mode': MODES[item['row']], 'index': item['column'],
                     'source_waist_anchor': list(item['anchor']), 'anchor_gold_pixels': item['anchor_gold_pixels'],
                     'destination_anchor': list(ANCHOR), 'star_centroid': [statistics.mean(p[0] for p in star),
                                                                         statistics.mean(p[1] for p in star)],
                     'removed_source_speck_pixels': item['removed_source_speck_pixels'],
                     'removed_native_speck_pixels': specks})
        frames.append(meta)
        native_frames.append(native)
        for yy in range(48):
            dest = ((item['row'] * 48 + yy) * 192 + item['column'] * 48) * 4
            atlas[dest:dest + 48 * 4] = native[yy * 48 * 4:(yy + 1) * 48 * 4]
    distinct = [len({frames[r * 4 + c]['rgba_sha256'] for c in range(4)}) for r in range(3)]
    assert all(count >= 2 for count in distinct)
    pw, ph, portrait = read_png(portrait_path)
    mask, removed = solid_mask(pw, ph, portrait)
    box = bounding_box(pw, ph, mask)
    portrait_scale = 192 / (box[3] - box[1] + 1)
    front, front_specks = resample(pw, ph, portrait, mask, 160, 224,
                                  ((box[0] + box[2] + 1) / 2, box[1]), (80, 16), portrait_scale, cache)
    front_meta = inspect_native(160, 224, front)
    front_meta.update({'removed_source_speck_pixels': removed, 'removed_native_speck_pixels': front_specks})
    assert originals == {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in source_directory.glob('*source*.png')}
    output.mkdir(parents=True)
    (output / 'frames').mkdir()
    write_png(output / 'player-motion-v1.png', 192, 144, atlas)
    write_png(output / 'player-back-idle-v1.png', 48, 48, native_frames[0])
    write_png(output / 'player-front-display-v1.png', 160, 224, front)
    for meta, data in zip(frames, native_frames):
        write_png(output / 'frames' / (meta['mode'] + '-' + str(meta['index']) + '.png'), 48, 48, data)
    write_animation_previews(output)
    ew, eh, enlarged = enlarge(192, 144, atlas, 4)
    write_png(output / 'player-motion-contact-4x.png', ew, eh, enlarged)
    manifest = {'author': '小典 / Codex', 'source_generator': 'built-in image_gen', 'version': 1,
                'image': 'player-motion-v1.png', 'sourceWidth': 192, 'sourceHeight': 144,
                'frameWidth': 48, 'frameHeight': 48, 'columns': 4,
                'rows': [{'id': mode, 'name': name} for mode, name in zip(MODES, ('悬浮', '左移', '右移'))],
                'logicalSize': 48, 'anchor': list(ANCHOR), 'fps': 8, 'nativePixelFrames': True,
                'portrait': 'player-front-display-v1.png', 'palette': PALETTE_HEX,
                'animationPreviews': {mode: mode + '-preview-2x.png' for mode in MODES},
                'sourceFilesSha256': originals,
                'frames': [{'mode': f['mode'], 'index': f['index'],
                            'rect': [f['index'] * 48, MODES.index(f['mode']) * 48, 48, 48],
                            'anchor': list(ANCHOR), 'durationMs': 125} for f in frames]}
    audit = {'author': '小典 / Codex', 'alpha_cutoff': ALPHA_CUTOFF, 'uniform_scale': scale,
             'source_files_unchanged': True, 'palette_opaque_colors': len(PALETTE),
             'distinct_frames_per_mode': dict(zip(MODES, distinct)), 'frames': frames, 'portrait': front_meta}
    for name, data in (('manifest.json', manifest), ('audit.json', audit)):
        (output / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).resolve().parents[2]
    parser.add_argument('--source', type=Path, default=root / 'docs/danmaku/art/player-production-v1')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--previews-only', action='store_true', help='Add APNG previews to an existing prepared directory')
    args = parser.parse_args()
    if args.previews_only:
        write_animation_previews(args.output.resolve())
        print(json.dumps({'animation_previews': 3, 'output': str(args.output.resolve())}, ensure_ascii=False))
        return
    audit = build(args.source.resolve(), args.output.resolve())
    print(json.dumps({'output': str(args.output.resolve()), 'frames': len(audit['frames']),
                      'distinct_frames_per_mode': audit['distinct_frames_per_mode'],
                      'source_files_unchanged': audit['source_files_unchanged']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
