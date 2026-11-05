#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。离线机械导出；ImageMagick几何整理，Pillow分析/编码，不重绘原画。"""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import io
import uuid
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT/'docs/aquarium/art'
OUT = ROOT/'source/plugin/gamecenter/games/aquarium/assets'


def run(args):
    # 使用独立PNG中间文件和原子替换，避免本环境ImageMagick WebP写入异常。
    target = Path(args[-1])
    if target.suffix.lower() != '.webp':
        subprocess.run(args, check=True, capture_output=True)
        return
    temp = ROOT.parent/('aq-export-'+uuid.uuid4().hex+'.png')
    try:
        r = subprocess.run(args[:-1]+[str(temp)], capture_output=True)
        if r.returncode:
            raise RuntimeError(r.stderr.decode('utf-8', errors='replace'))
        quality = int(args[args.index('-quality')+1]) if '-quality' in args else 92
        with Image.open(temp) as im:
            data = io.BytesIO()
            im.save(data, 'WEBP', quality=quality, method=4, lossless='thumbs' in target.parts)
        part = target.with_suffix('.writing')
        part.write_bytes(data.getvalue())
        part.replace(target)
    finally:
        temp.unlink(missing_ok=True)


def file_info(path, role):
    raw = path.read_bytes()
    with Image.open(path) as im:
        size, mode = im.size, im.mode
        alpha = list(im.getchannel('A').getextrema()) if 'A' in im.getbands() else None
    return dict(role=role, file=str(path.relative_to(OUT)), size=list(size), mode=mode,
                alpha=alpha, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
                git_blob=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest())


def sprite(master, dest, size, anchor_y):
    """alpha>=16仅定位可见边界，原边界内alpha保留；母版不变。"""
    with Image.open(master) as im:
        if 'A' not in im.getbands():
            raise ValueError(f'No true alpha: {master}')
        a = im.getchannel('A')
        low, high = a.getextrema()
        if low != 0 or high < 240:
            raise ValueError(f'Invalid alpha: {master}: {low},{high}')
        box = a.point(lambda p: 255 if p >= 16 else 0).getbbox()
    if not box:
        raise ValueError(f'Empty sprite: {master}')
    left, top, right, bottom = box
    cw, ch = size
    room_w, room_h = cw-64, int(ch*.84)
    scale = min(room_w/(right-left), room_h/(bottom-top))
    rw, rh = round((right-left)*scale), round((bottom-top)*scale)
    x = (cw-rw)//2
    y = round(ch*anchor_y)-rh if anchor_y == .9 else (ch-rh)//2
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(['convert', '-size', f'{cw}x{ch}', 'xc:none', '(',
         str(master), '-crop', f'{right-left}x{bottom-top}+{left}+{top}',
         '+repage', '-resize', f'{rw}x{rh}!', ')', '-geometry', f'+{x}+{y}',
         '-compose', 'Over', '-composite', '-define', 'webp:lossless=true', str(dest)])
    return list(box), [x, y, x+rw, y+rh]


def background(master, dest, size):
    dest.parent.mkdir(parents=True, exist_ok=True)
    w, h = size
    run(['convert', str(master), '-resize', f'{w}x{h}^', '-gravity', 'center',
         '-extent', f'{w}x{h}', '-alpha', 'off', '-quality', '88', str(dest)])


def thumb(source, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    run(['convert', str(source), '-thumbnail', '128x128', '-gravity', 'center',
         '-background', 'none', '-extent', '128x128', '-define', 'webp:lossless=true', str(dest)])


def main():
    registry = json.loads((ART/'asset-map-v0.1.json').read_text())
    progress = json.loads((ART/'generation-progress.json').read_text())
    if len(progress['completed']) != 34 or progress['failed']:
        raise ValueError('Generation is not complete')
    sources = {x['id']: ROOT/x['master'] for x in progress['completed']}
    approved = json.loads((ART/'samples/manifest-v02.json').read_text())
    approved_ids = set()
    for x in approved['samples']:
        sources[x['id']] = ROOT/x['path']
        approved_ids.add(x['id'])
    entries = []
    for kind in ['fish', 'decor']:
        for item in registry[kind]:
            mid = item['id']
            master, dest = sources[mid], OUT/item['file']
            anchor = [.5, .5 if kind == 'fish' else .9]
            box, bounds = sprite(master, dest, tuple(item['target_px']), anchor[1])
            small = OUT/item['thumb']
            thumb(dest, small)
            entries.append(dict(id=mid, name=item['name'], kind=kind, index=item['index'],
                                master=str(master.relative_to(ROOT)),
                                source_sha256=hashlib.sha256(master.read_bytes()).hexdigest(),
                                review='user-approved-style' if mid in approved_ids else 'generated-art-candidate',
                                anchor=anchor, source_visible_bbox=box, exported_content_bounds=bounds,
                                facing='right' if kind == 'fish' else None,
                                layers=item.get('layers'), files=[file_info(dest, 'main'), file_info(small, 'thumb')]))
    for item in registry['backgrounds']:
        mid = item['id']
        master = sources[mid]
        desktop, mobile = OUT/item['desktop'], OUT/item['mobile']
        background(master, desktop, item['desktop_px'])
        background(master, mobile, item['mobile_px'])
        entries.append(dict(id=mid, name=item['name'], kind='background',
                            master=str(master.relative_to(ROOT)),
                            source_sha256=hashlib.sha256(master.read_bytes()).hexdigest(),
                            review='user-approved-style' if mid in approved_ids else 'generated-art-candidate',
                            files=[file_info(desktop, 'main'), file_info(mobile, 'mobile')]))
    for item in registry['water_thumbs']:
        master = sources['water_'+item['id']]
        dest = OUT/item['file']
        background(master, dest, item['target_px'])
        entries.append(dict(id=item['id'], name=item['name'], kind='water',
                            master=str(master.relative_to(ROOT)),
                            source_sha256=hashlib.sha256(master.read_bytes()).hexdigest(),
                            review='generated-art-candidate', files=[file_info(dest, 'main')]))
    master = sources['rod']
    dest = OUT/'icons/rod.webp'
    box, bounds = sprite(master, dest, (256, 256), .5)
    entries.append(dict(id='rod', name='鱼竿', kind='icon',
                        master=str(master.relative_to(ROOT)),
                        source_sha256=hashlib.sha256(master.read_bytes()).hexdigest(),
                        review='generated-art-candidate', anchor=[.5, .5],
                        source_visible_bbox=box, exported_content_bounds=bounds, files=[file_info(dest, 'main')]))
    data = dict(schema='aquarium-assets-v1', author='GPT / Codex; original plugin (C) 2026 Carinoasd',
                version='art-candidate-v1', status='content-art-complete-awaiting-integration',
                export='ImageMagick geometric packing; Pillow WebP encoding; originals unchanged; alpha>=16 used only for bbox',
                decor_slot_count=None, items=entries,
                counts={k: sum(x['kind'] == k for x in entries) for k in ['fish', 'decor', 'background', 'water', 'icon']})
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT/'manifest.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    board_folder = ART/'boards'
    board_folder.mkdir(exist_ok=True)
    for kind, tile, geometry in [('fish', '4x3', '220x160+10+16'), ('decor', '6x4', '180x160+8+16')]:
        cmd = ['montage', '-font', 'DejaVu-Sans', '-pointsize', '12', '-fill', '#183e5d']
        for x in entries:
            if x['kind'] == kind:
                cmd += ['-label', x['id'], str(OUT/x['files'][0]['file'])]
        cmd += ['-background', '#c7eaf1', '-geometry', geometry, '-tile', tile,
                '-quality', '90', str(board_folder/(kind+'-atlas.webp'))]
        run(cmd)
    scenes = [x for x in entries if x['kind'] in ['background', 'water']]
    cmd = ['montage', '-font', 'DejaVu-Sans', '-pointsize', '14', '-fill', '#183e5d']
    for x in scenes:
        cmd += ['-label', x['id'], str(OUT/x['files'][0]['file'])]
    cmd += ['-background', '#e6f3f6', '-geometry', '580x326+10+20', '-tile', '2x2',
            '-quality', '90', str(board_folder/'scenes-atlas.webp')]
    run(cmd)
    # 从真实128px缩略图缩小作可读性检查，不改变独立资源。
    cmd = ['montage', '-font', 'DejaVu-Sans', '-pointsize', '10', '-fill', '#183e5d']
    for x in entries:
        if x['kind'] in ['fish', 'decor']:
            cmd += ['-label', x['id'], str(OUT/x['files'][1]['file'])]
    cmd += ['-background', '#c7eaf1', '-geometry', '96x96+10+14', '-tile', '6x6',
            '-quality', '90', str(board_folder/'small-size-proof.webp')]
    run(cmd)
    ref = ROOT.parent/'generated_images/exec-61e9103d-7f93-40dd-aa2c-6719f7d3d117.png'
    if ref.exists():
        (ART/'reference').mkdir(exist_ok=True)
        shutil.copyfile(ref, ART/'reference/approved-acg-concept.png')
    print(json.dumps(dict(items=len(entries), runtime_files=sum(len(x['files']) for x in entries),
                          runtime_bytes=sum(f['bytes'] for x in entries for f in x['files']), counts=data['counts'])))


if __name__ == '__main__':
    main()

