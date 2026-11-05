#!/usr/bin/env python3
"""作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。
Inspect existing candidate pixels/contracts and optional independent rerun; never edit assets.
Pillow composites below are opaque inspection evidence, not replacement art.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'docs/aquarium/art/firefly-v1'
APPROVED_BG = '3a03ea65936631d580dcbc651f1d8ca6b28a49ccf5e1d7141dc780f4cff51222'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inspect(candidate, rerun, evidence):
    manifest = json.loads((candidate / 'manifest.json').read_text(encoding='utf-8'))
    sources = json.loads((ART / 'manifest.json').read_text(encoding='utf-8'))
    for source in sources['items']:
        assert sha(ART / source['file']) == source['sha256'], source['id'] + ': mother changed'
    assert sha(ART / 'mothers/tank_firefly_grove-v01.png') == APPROVED_BG
    expected_ids = {'building_shell_house', 'building_tide_mill', 'building_star_clock',
                    'building_wreck_cafe', 'tank_firefly_grove'}
    assert {x['id'] for x in manifest['items']} == expected_ids
    assert manifest['status'] == 'inactive-export-candidate-not-installed'
    assert manifest['runtime_config_changed'] is False
    listed = {f['file'] for item in manifest['items'] for f in item['files']}
    assert listed == {p.relative_to(candidate).as_posix() for p in candidate.rglob('*.webp')}
    assert len(listed) == manifest['files'] == 11
    assert sum((candidate / f).stat().st_size for f in listed) == manifest['bytes'] == 494500
    rows = []
    main_sheet = Image.new('RGB', (2048, 4 * 548), '#ddd9cf')
    thumb_sheet = Image.new('RGB', (768, 4 * 176), '#ddd9cf')
    md, td = ImageDraw.Draw(main_sheet), ImageDraw.Draw(thumb_sheet)
    building_index = 0
    for item in manifest['items']:
        assert sha(ROOT / item['source']) == item['source_sha256']
        for file in item['files']:
            path = candidate / file['file']
            assert sha(path) == file['sha256'], file['file'] + ': hash'
            assert path.stat().st_size == file['bytes']
            if rerun:
                assert path.read_bytes() == (rerun / file['file']).read_bytes(), file['file'] + ': rerun'
            with Image.open(str(path)) as image:
                image.load()
                assert image.format == 'WEBP'
                assert list(image.size) == file['size'] and image.mode == file['mode']
                rgba = image.convert('RGBA')
            alpha = rgba.getchannel('A')
            bbox = alpha.point(lambda a: 255 if a >= 16 else 0).getbbox()
            assert list(alpha.getextrema()) == file['alpha_range']
            assert list(bbox) == file['visible_bbox_alpha16']
            row = {'file': file['file'], 'sha256': file['sha256'], 'bytes': file['bytes'],
                   'size': file['size'], 'alpha_range': file['alpha_range']}
            if item['kind'] == 'building':
                assert alpha.getextrema() == (0, 255)
                # Hidden RGB may be nonzero; only RGBA compositing determines visible pixels.
                hidden = [(i, p) for i, p in enumerate(rgba.getdata()) if p[3] == 0]
                row['transparent_pixels'] = len(hidden)
                row['transparent_pixels_with_nonzero_rgb'] = sum(any(p[:3]) for _, p in hidden)
                for color in [(247, 245, 237), (24, 59, 83)]:
                    comp = Image.alpha_composite(Image.new('RGBA', rgba.size, color + (255,)), rgba).convert('RGB')
                    flat = list(comp.getdata())
                    assert all(flat[i] == color for i, _ in hidden), file['file'] + ': visible hidden RGB'
                    if file['role'] == 'main':
                        col = 0 if color[0] == 247 else 1
                        x = col * 1024 + (1024 - rgba.width) // 2
                        y = building_index * 548 + 30
                        main_sheet.paste(Image.new('RGB', (1024, 512), color), (col * 1024, y))
                        main_sheet.paste(comp, (x, y))
                        md.text((col * 1024 + 10, y - 22), item['id'] + ' / 1:1 / ' + ('light' if col == 0 else 'dark'), fill='#142f36')
                        foot = round(rgba.height * item['anchor'][1])
                        md.line((x, y + foot, x + rgba.width - 1, y + foot), fill='#5caa98')
                        md.line((x + rgba.width // 2, y + foot - 6, x + rgba.width // 2, y + foot + 6), fill='#e29b30', width=2)
                    else:
                        assert rgba.size == (128, 128)
                        col = 0 if color[0] == 247 else 1
                        y = building_index * 176 + 30
                        thumb_sheet.paste(comp, (col * 192 + 20, y))
                        thumb_sheet.paste(comp.resize((64, 64), Image.LANCZOS), (col * 192 + 400, y + 30))
                if file['role'] == 'main':
                    assert item['anchor'] == [.5, .9]
                    assert item['preview_geometry']['source_size'] == file['size']
                    assert item['preview_geometry']['source_visible_bbox'] == list(bbox)
                    assert abs(bbox[3] - rgba.height * .9) <= 1, 'foot outside 1px tolerance'
                    assert bbox[0] > 0 and bbox[1] > 0 and bbox[2] < rgba.width and bbox[3] < rgba.height
                    row['foot_error_px'] = bbox[3] - rgba.height * .9
            else:
                assert alpha.getextrema() == (255, 255)
                assert rgba.width * 10 == rgba.height * 16
                assert file['size'] == {'main': [1536, 960], 'mobile': [768, 480], 'thumb': [240, 150]}[file['role']]
            rows.append(row)
        if item['kind'] == 'building':
            td.text((10, building_index * 176 + 6), item['id'] + ' / 128px light + dark / 64px light + dark', fill='#142f36')
            building_index += 1
    if rerun:
        assert json.loads((rerun / 'manifest.json').read_text(encoding='utf-8')) == manifest, 'rerun manifest'
    evidence.mkdir(parents=True, exist_ok=True)
    main_sheet.save(str(evidence / 'edges-light-dark.png'))
    thumb_sheet.save(str(evidence / 'thumbs-128-64.png'))
    bg_sheet = Image.new('RGB', (1536, 960 + 480), '#ddd9cf')
    bg_sheet.paste(Image.open(str(candidate / 'background/tank_firefly_grove.webp')), (0, 0))
    bg_sheet.paste(Image.open(str(candidate / 'background/tank_firefly_grove_mobile.webp')), (0, 960))
    bg_sheet.paste(Image.open(str(candidate / 'background/tank_firefly_grove_thumb.webp')), (900, 1000))
    bg_sheet.save(str(evidence / 'background-sizes.png'))
    report = {'status': 'PASS', 'scope': 'file contracts and opaque alpha composites; not owner approval or runtime forum testing',
              'files': len(rows), 'bytes': manifest['bytes'], 'source_png_hashes_unchanged': len(sources['items']),
              'approved_background_sha256': APPROVED_BG, 'independent_rerun_byte_identical': bool(rerun),
              'composite_backgrounds': ['#f7f5ed', '#183b53'], 'main_anchor': [.5, .9],
              'main_foot_tolerance_px': 1, 'results': rows}
    (evidence / 'asset-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'results'}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate', type=Path, default=ART / 'runtime-candidate')
    parser.add_argument('--rerun', type=Path)
    parser.add_argument('--evidence', type=Path, required=True)
    args = parser.parse_args()
    inspect(args.candidate, args.rerun, args.evidence)
