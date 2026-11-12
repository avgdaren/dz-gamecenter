#!/usr/bin/env python3
# (C) 2026 Carinoasd. Exported asset validation: 小典 / Codex.
"""Validate exported player assets, source preservation, atlas order and APNGs."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

from build_player_art import read_png, PALETTE


def check(output, source_directory=None):
    source_directory = source_directory or output.parent
    manifest = json.loads((output / 'manifest.json').read_text(encoding='utf-8'))
    assert (manifest['frameWidth'], manifest['frameHeight'], manifest['anchor']) == (48, 48, [24, 28])
    w, h, atlas = read_png(output / manifest['image'])
    assert (w, h) == (192, 144) and len(manifest['frames']) == 12
    hashes, palette_used, reports = {}, set(), []
    for record in manifest['frames']:
        mode, index = record['mode'], record['index']
        fw, fh, pixels = read_png(output / 'frames' / (mode + '-' + str(index) + '.png'))
        assert (fw, fh) == (48, 48)
        assert set(pixels[3::4]) == {0, 255}
        for pos in range(0, len(pixels), 4):
            if pixels[pos + 3]:
                palette_used.add(tuple(pixels[pos:pos + 3]))
            else:
                assert pixels[pos:pos + 3] == b'\0\0\0'
        assert pixels[(28 * 48 + 24) * 4 + 3] == 255
        x, y, rw, rh = record['rect']
        assert rw == rh == 48 and 0 <= x <= w - 48 and 0 <= y <= h - 48
        tile = b''.join(atlas[((y + yy) * w + x) * 4:((y + yy) * w + x + 48) * 4] for yy in range(48))
        assert tile == pixels
        edges = [pixels[(yy * 48 + xx) * 4 + 3] for yy in range(48) for xx in range(48)
                 if xx in (0, 47) or yy in (0, 47)]
        assert not any(edges)
        hashes.setdefault(mode, set()).add(hashlib.sha256(pixels).digest())
        reports.append({'mode': mode, 'index': index, 'size': [fw, fh], 'atlas_match': True})
    assert palette_used <= set(PALETTE)
    assert all(len(values) == 4 for values in hashes.values()) and len(hashes) == 3
    pw, ph, portrait = read_png(output / manifest['portrait'])
    assert (pw, ph) == (160, 224) and set(portrait[3::4]) == {0, 255}
    portrait_colors = {tuple(portrait[i:i + 3]) for i in range(0, len(portrait), 4) if portrait[i + 3]}
    assert portrait_colors <= set(PALETTE)
    for name, expected in manifest['sourceFilesSha256'].items():
        assert hashlib.sha256((source_directory / name).read_bytes()).hexdigest() == expected
    animation_checks = []
    for mode, name in manifest['animationPreviews'].items():
        data, pos, sequence, frames, streams, current = (output / name).read_bytes(), 8, [], [], [], bytearray()
        while pos < len(data):
            length = struct.unpack('>I', data[pos:pos + 4])[0]
            kind, chunk = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
            assert zlib.crc32(kind + chunk) & 0xffffffff == struct.unpack('>I', data[pos + 8 + length:pos + 12 + length])[0]
            if kind == b'acTL':
                assert struct.unpack('>II', chunk) == (4, 0)
            elif kind == b'fcTL':
                if current:
                    streams.append(bytes(current)); current.clear()
                values = struct.unpack('>IIIIIHHBB', chunk)
                sequence.append(values[0]); frames.append(values)
                assert values[1:] == (96, 96, 0, 0, 1, 8, 0, 0)
            elif kind == b'IDAT':
                current.extend(chunk)
            elif kind == b'fdAT':
                sequence.append(struct.unpack('>I', chunk[:4])[0])
                current.extend(chunk[4:])
            pos += length + 12
        streams.append(bytes(current))
        assert len(frames) == len(streams) == 4 and sequence == list(range(7))
        for index, compressed in enumerate(streams):
            decoded = zlib.decompress(compressed)
            assert len(decoded) == 96 * (96 * 4 + 1)
            _, _, native = read_png(output / 'frames' / (mode + '-' + str(index) + '.png'))
            for yy in range(96):
                row = decoded[yy * 385:(yy + 1) * 385]
                assert row[0] == 0
                for xx in range(96):
                    assert row[1 + xx * 4:5 + xx * 4] == native[((yy // 2) * 48 + xx // 2) * 4:((yy // 2) * 48 + xx // 2) * 4 + 4]
        animation_checks.append({'mode': mode, 'frames': 4, 'size': [96, 96], 'fps': 8, 'pixel_match': True})
    assert len(animation_checks) == 3
    return {'author': '小典 / Codex', 'frames_checked': len(reports), 'all_native_frames_distinct': True,
            'atlas_matches_individual_frames': True, 'alpha_binary': True,
            'frame_edges_clear': True, 'source_hashes_unchanged': True,
            'shared_palette_opaque_colors': len(palette_used | portrait_colors),
            'portrait_size': [pw, ph], 'animation_checks': animation_checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--source', type=Path, help='Source directory, defaults to the prepared directory parent')
    args = parser.parse_args()
    result = check(args.output.resolve(), args.source.resolve() if args.source else None)
    (args.output / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
