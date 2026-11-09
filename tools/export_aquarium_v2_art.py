# -*- coding: utf-8 -*-
"""作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。

将已选母图作机械运行导出；Pillow只读像素/元数据，FFmpeg负责几何整理和编码。
不修改母图，不写游戏实际assets目录，不填写经济配置。
"""
from pathlib import Path
import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / 'docs/aquarium/art/v2-release-selection'
FISH_WIDTHS = {'qingya_turtle': .16, 'qixia_guppy': .18, 'shanlan_butterfly': .15}
DECOR_WIDTHS = {
    'building_glowroot_cottage': .25, 'building_mosswheel_mill': .25,
    'building_mossstone_bridge': .27, 'building_root_archway': .14,
    'building_glowseed_beacon': .11, 'plant_spring_fern': .11,
    'plant_lavender_bells': .09, 'plant_fineleaf_ribbon': .09,
    'scape_moss_step_path': .14, 'scape_riverstone_cluster': .10,
    'trinket_honeyquartz_cluster': .09, 'trinket_glowseed_lantern': .045,
    'trinket_rootwood_bench': .13, 'trinket_leafway_sign': .06,
}
WIDE_STRUCTURES = {'building_glowroot_cottage', 'building_mosswheel_mill', 'building_mossstone_bridge'}
TARGET_PREFIX = 'source/plugin/gamecenter/games/aquarium/assets/'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def within(path, parent):
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def visible_box(path):
    with Image.open(path) as image:
        if 'A' not in image.getbands():
            raise ValueError('No alpha channel: ' + str(path))
        alpha = image.getchannel('A')
        lo, hi = alpha.getextrema()
        box = alpha.point(lambda a: 255 if a >= 16 else 0).getbbox()
        if lo != 0 or hi < 240 or box is None:
            raise ValueError('Invalid transparent source: ' + str(path))
        return list(box)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--ffmpeg', type=Path, required=True)
    args = parser.parse_args()
    source, out, ffmpeg = args.source.resolve(), args.out.resolve(), args.ffmpeg.resolve()
    if out.exists():
        raise ValueError('Output must be a new directory; existing content is preserved.')
    if within(out, (ROOT/'source/plugin/gamecenter/games/aquarium/assets').resolve()):
        raise ValueError('Export to a review/handoff directory, not active game assets.')
    if not ffmpeg.is_file():
        raise ValueError('An explicit FFmpeg executable is required.')
    selection = read_json(source/'manifest.json')
    motion = read_json(source/'motion/v1/manifest.json')
    presets = read_json(source/'presets.json')
    motion_by_id = {item['art_id']: item for item in motion['items']}
    all_sources = selection['creatures'] + selection['decor']
    source_hashes = {item['file']: sha256(source/item['file']) for item in all_sources}
    out.mkdir(parents=True)

    def run(command):
        result = subprocess.run([str(ffmpeg), '-hide_banner', '-loglevel', 'error', '-y'] + command, capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr.decode('utf-8', errors='replace'))

    def file_info(path, role, expected_size=None, require_alpha=True, target=None):
        with Image.open(path) as image:
            size = list(image.size)
            if expected_size and size != list(expected_size):
                raise ValueError('Unexpected export size: ' + str(path))
            alpha = list(image.getchannel('A').getextrema()) if 'A' in image.getbands() else None
            bounds = list(image.getchannel('A').point(lambda a: 255 if a >= 16 else 0).getbbox()) if alpha else [0, 0, size[0], size[1]]
            mode = image.mode
        if require_alpha and (not alpha or alpha[0] != 0 or alpha[1] < 240):
            raise ValueError('Transparent export lost alpha: ' + str(path))
        return {'role': role, 'file': path.relative_to(out).as_posix(), 'size': size,
                'mode': mode, 'alpha': alpha, 'content_bounds': bounds,
                'normalized_content_bounds': [round(bounds[i]/size[i % 2], 6) for i in range(4)],
                'bytes': path.stat().st_size, 'sha256': sha256(path),
                'recommended_target': TARGET_PREFIX + target if target else None}

    def export_sprite(master, relative, size, anchor_y, role, target, budget_kib=None):
        path = out/relative
        path.parent.mkdir(parents=True, exist_ok=True)
        left, top, right, bottom = visible_box(master)
        width, height = size
        scale = min(width*.875/(right-left), height*(.84 if anchor_y == .9 else .875)/(bottom-top))
        scaled_w, scaled_h = round((right-left)*scale), round((bottom-top)*scale)
        x = (width-scaled_w)//2
        y = round(height*anchor_y)-scaled_h if anchor_y == .9 else (height-scaled_h)//2
        filters = f'crop={right-left}:{bottom-top}:{left}:{top},scale={scaled_w}:{scaled_h}:flags=lanczos,format=rgba,pad={width}:{height}:{x}:{y}:color=0x00000000'
        qualities = [90, 86, 82] if budget_kib else [100]
        for quality in qualities:
            run(['-i', str(master), '-vf', filters, '-frames:v', '1', '-c:v', 'libwebp',
                 '-lossless', '0' if budget_kib else '1', '-quality', str(quality), '-compression_level', '6', str(path)])
            if not budget_kib or path.stat().st_size <= budget_kib*1024:
                break
        result = file_info(path, role, size, target=target)
        result.update({'quality': quality, 'source_visible_bbox': [left, top, right, bottom], 'packing_scale': scale})
        if budget_kib:
            result['budget_kib'] = budget_kib
            result['within_budget'] = result['bytes'] <= budget_kib*1024
        return result

    entries = []
    for creature in selection['creatures']:
        art_id = creature['art_id']
        slug = art_id[len('creature_'):] if art_id.startswith('creature_') else art_id
        if not re.fullmatch('[a-z0-9_]+', slug):
            raise ValueError('Unexpected resource key.')
        master = source/creature['file']
        files = [
            export_sprite(master, f'fish/{slug}.webp', (512,512), .5, 'main', f'fish/{slug}.webp', 60),
            export_sprite(master, f'fish-mobile/{slug}.webp', (256,256), .5, 'mobile', f'fish-next/v2/{slug}_mobile.webp', 35),
            export_sprite(master, f'thumbs/fish/{slug}.webp', (128,128), .5, 'thumb', f'thumbs/fish/{slug}.webp'),
        ]
        silhouette = out/f'silhouettes/fish/{slug}.webp'
        silhouette.parent.mkdir(parents=True, exist_ok=True)
        run(['-i', str(out/files[2]['file']), '-vf', 'format=rgba,lutrgb=r=78:g=98:b=110',
             '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', str(silhouette)])
        files.append(file_info(silhouette, 'silhouette', (128,128), target=f'fish-next/v2/{slug}_silhouette.webp'))
        motion_item = motion_by_id[art_id]
        atlas = out/f'fish-motion/{slug}.webp'
        atlas.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source/'motion/v1'/motion_item['file'], atlas)
        files.append(file_info(atlas, 'motion', (1024,256), target=f'fish-motion/v1/{slug}.webp'))
        preview = out/f'previews/{slug}-loop.gif'
        preview.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source/'motion/v1'/motion_item['preview_gif'], preview)
        entries.append({'art_id': art_id, 'name': creature['name'], 'kind': 'fish',
                        'source_master': creature['file'], 'source_sha256': source_hashes[creature['file']],
                        'suggested_runtime_id': slug, 'runtime_fish_id': None,
                        'anchor': [.5,.5], 'facing': 'right',
                        'suggested_display': {'size_axis': 'width', 'size_ratio': FISH_WIDTHS[slug], 'status': 'visual-default-to-adjust-in-game'},
                        'motion': {'frame_size':[256,256], 'grid':[4,1], 'frame_count':4, 'cycle_ms':motion_item['cycle_ms'], 'anchor':[.5,.5], 'neutral_frame':0, 'preview_gif':preview.relative_to(out).as_posix()},
                        'files':files})

    used_layers = {item['art_id']: set() for item in selection['decor']}
    for preset in presets['items']:
        for layer in ['back','front']:
            for art_id in preset[layer]:
                used_layers[art_id].add(layer)
    for decor in selection['decor']:
        art_id = decor['art_id']
        size = (1024,512) if art_id in WIDE_STRUCTURES else (512,512)
        files = [
            export_sprite(source/decor['file'], f'decor/{art_id}.webp', size, .9, 'main', f'decor/{art_id}.webp', 140 if art_id in WIDE_STRUCTURES else 90),
            export_sprite(source/decor['file'], f'thumbs/decor/{art_id}.webp', (128,128), .9, 'thumb', f'thumbs/decor/{art_id}.webp'),
        ]
        entries.append({'art_id':art_id, 'name':decor['name'], 'kind':'decor', 'category':decor['category'],
                        'source_master':decor['file'], 'source_sha256':source_hashes[decor['file']],
                        'anchor':[.5,.9], 'facing':None,
                        'suggested_display':{'width_ratio':DECOR_WIDTHS[art_id], 'layers':sorted(used_layers[art_id]), 'status':'visual-defaults-preserving-current-preset-layers'},
                        'files':files})

    bg = selection['background']
    bg_files = []
    for old in bg['runtime_exports']:
        name = Path(old['file']).name
        role = 'mobile' if '_mobile' in name else 'thumb' if '_thumb' in name else 'main'
        target = out/'background'/name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source/old['file'], target)
        bg_files.append(file_info(target, role, require_alpha=False, target='background/'+name))
    entries.append({'art_id':bg['art_id'], 'name':bg['name'], 'kind':'background',
                    'source_master':bg['file'], 'status':'existing-approved-background-export-reused', 'files':bg_files})

    for relative, old_hash in source_hashes.items():
        if sha256(source/relative) != old_hash:
            raise ValueError('Master changed during export: ' + relative)
    count = sum(len(item['files']) for item in entries)
    if count != 46:
        raise ValueError('Incomplete runtime export set.')
    over_budget = [{'art_id':item['art_id'], 'file':file['file'], 'bytes':file['bytes']} for item in entries for file in item['files'] if file.get('within_budget') is False]
    manifest = {'schema':'aquarium-v2-runtime-art-v1', 'author':'GPT / Codex（小典）；原插件 (C) 2026 Carinoasd',
                'date':'2026-11-08', 'status':'art-export-ready-awaiting-game-integration',
                'active_game_configuration':False, 'economic_values_included':False,
                'source_manifest':'../../manifest.json', 'runtime_fish_ids_finalized':False,
                'counts':{'fish':3,'decor':14,'background':1,'webp_files':count,'new_static_exports':40,'reused_motion_atlases':3,'reused_background_exports':3},
                'total_bytes':sum(file['bytes'] for item in entries for file in item['files']),
                'over_budget':over_budget, 'preview_files':[item['motion']['preview_gif'] for item in entries if item['kind']=='fish'], 'items':entries}
    write_json(out/'manifest.json', manifest)

    map_items=[]
    for item in entries:
        row={key:item[key] for key in ['art_id','name','kind']}
        row['files']={file['role']:file['file'] for file in item['files']}
        row['content_bounds']={file['role']:file['content_bounds'] for file in item['files']}
        for key in ['anchor','facing','suggested_runtime_id','runtime_fish_id','suggested_display','motion']:
            if key in item:
                row[key]=item[key]
        map_items.append(row)
    write_json(out/'runtime-map.json', {'schema':'aquarium-v2-art-integration-map-v1','active_game_configuration':False,
               'note':'art_id是稳定美术索引；suggested_runtime_id与显示比例是接入建议，不自动写入鱼池、商品或存档。','items':map_items})

    preset_export = dict(presets)
    preset_export['asset_manifest']='manifest.json'
    preset_export['guide']='README.md'
    preset_export['runtime_ready']=False
    preset_export['status']='exported-layout-data-awaiting-game-menu-integration'
    write_json(out/'presets.json', preset_export)
    write_json(out/'pending-rules.json', {'schema':'aquarium-v2-pending-decisions-v1','active_game_configuration':False,
               'fish':[{'art_id':item['art_id'],'suggested_runtime_id':item['suggested_runtime_id'],'runtime_fish_id':None,
                        'water':None,'rod_gate':None,'capture_weight':None,'catch_coin_reward':None,
                        'lifetime_cap':None,'sellable':None,'sell_price':None} for item in entries if item['kind']=='fish'],
               'theme_shop':{'individual_prices':None,'unlock_conditions':None,'bundle_discount':None,'missing_item_credit_rule':None},
               'fish_sale':{'minimum_kept':None,'displayed_fish_sale_rule':None},
               'instruction':'这些字段未定稿，不从美术名称、文件大小、旧报价或旧限量生物规则推断；由正式配置决策后再接入。'})

    copy_rows=['| 名称 | 用途 | 包内文件 | 建议目标路径 |','| --- | --- | --- | --- |']
    for item in entries:
        for file in item['files']:
            copy_rows.append(f"| {item['name']} | {file['role']} | `{file['file']}` | `{file['recommended_target']}` |")
    (out/'COPY-MAP.md').write_text('# 运行美术复制映射\n\n作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。\n\n这些是建议复制路径，不是已部署文件。实际鱼种 ID 定稿后统一映射；不必为改中文名改文件名。\n\n'+'\n'.join(copy_rows)+'\n',encoding='utf-8')

    cards=[]
    for item in entries:
        files={file['role']:file for file in item['files']}
        mini=''
        for role in ['thumb','silhouette']:
            if role in files:
                mini+=f'<figure><img width="128" height="128" src="{files[role]["file"]}" alt="{role}"><figcaption>{role} · 128px</figcaption></figure>'
        cards.append(f'<article><h2>{html.escape(item["name"])}</h2><div class="stage"><img src="{files["main"]["file"]}" alt="{html.escape(item["name"])}"></div><div class="mini">{mini}</div><p>{files["main"]["size"][0]}×{files["main"]["size"][1]} · {files["main"]["bytes"]//1024} KiB</p></article>')
    page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>v2.0运行美术交付目录</title><style>body{margin:0;background:#f4f1e9;color:#29413c;font:16px/1.6 "Microsoft YaHei",sans-serif}main{max-width:1250px;margin:auto;padding:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px}article{padding:18px;background:white;border:1px solid #dce5dd;border-radius:12px}h2{font-size:20px}.stage{height:240px;display:grid;place-items:center;background:#e3eee8;border-radius:8px}.stage img{max-height:95%;max-width:95%;object-fit:contain}.mini{display:flex;gap:10px}.mini figure{margin:12px 0}.mini img{background:#e8f1ec;object-fit:contain}figcaption{font-size:12px;color:#617b6c}a{color:#267c78}</style><main><h1>v2.0运行美术交付目录</h1><p>46个WebP：三种生物、十四件布景和一个背景的运行导出；未接入游戏。本页为交付目录，不代表游戏效果验收。</p><p><a href="runtime-map.json">接入映射</a> · <a href="manifest.json">文件清单</a> · <a href="COPY-MAP.md">复制路径</a> · <a href="../../motion/v1/preview.html">游动循环</a> · <a href="pending-rules.json">待定规则</a></p><section class="grid">'''+''.join(cards)+'</section></main></html>'
    page = page.replace('../../motion/v1/preview.html', 'swim.html')
    (out/'preview.html').write_text(page,encoding='utf-8')
    swim_cards = ''.join(f'<article><h2>{html.escape(item["name"])}</h2><img width="256" height="256" src="{item["motion"]["preview_gif"]}" alt="swim"><p>{item["motion"]["cycle_ms"]}ms / 4 frames</p></article>' for item in entries if item['kind']=='fish')
    (out/'swim.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Swim preview</title><style>body{font:16px/1.6 sans-serif;background:#edf3ed;color:#26443b;padding:24px}main{display:flex;flex-wrap:wrap;gap:24px}article{padding:20px;background:white;border-radius:12px}a{color:#267c78}</style><p><a href="preview.html">Runtime art catalog</a></p><main>'+swim_cards+'</main></html>',encoding='utf-8')
    readme='''# v2.0 运行美术交付 v1

作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。2026-11-08。

资源侧已完成本轮运行导出与规格整理，共 46 个 WebP：

- 三种生物：各一张 512 主图、256 手机版、128 图鉴图标、128 剪影、四帧游动图集，共 15 个文件。
- 十四件布景：512 主图或横向建筑 1024×512，另各有 128 缩略图，共 28 个文件。
- 萤光秘境：复用已有背景桌面、手机、缩略图，共 3 个文件；保留原有构图与尺寸。

[运行美术目录](preview.html) · [游动循环](swim.html) · [完整文件清单](manifest.json) · [接入映射](runtime-map.json) · [复制映射](COPY-MAP.md) · [四组预设](presets.json) · [待定规则](pending-rules.json)

## 统一口径

生物 anchor=(0.5,0.5)、面向右；布景 anchor=(0.5,0.9)，以完整可见轮廓接地。主图与缩略图均等比例整理，保留 alpha，原母图不变。content_bounds 与 normalized_content_bounds 可用于选框和点击区域。鱼使用 width 作为建议尺度轴，显示比例为视觉初值，待小蓝在真实缸体中调整；预设层位沿用已选方案，不改变容量或存档协议。

## 给小蓝的接入步骤

1. 从 runtime-map.json 按 art_id 取文件，结合正式配置确定三种新生物的运行 fish_id；suggested_runtime_id 只是 ASCII 命名建议。
2. 按 COPY-MAP.md 复制新资源并合并主美术清单。不要用本文件覆盖现有 assets/manifest.json。
3. 将三张游动图集登记到现有 fish-motion 清单：每帧256×256，4×1，4帧；周期沿用当前动作稿的1600/1000/1200ms，必要时只调播放节奏。
4. 接入图鉴主图/剪影与手机资源，登记14件布景、背景和四组预设。预设免费、独立拥有、缺件跳过，不自动购买/发物品。
5. 结合游戏实际显示处理必要的比例和遮挡调整，再完成游戏内接入确认。资源导出齐备不等于已上线。

## 尚未决定的业务规则

pending-rules.json 集中保留运行ID、水域、捕获门槛/概率/收益、限量与可售资格、售卖价格及保留数量、主题商品价格与套装规则。未定值均为 null；不从旧报价、旧生物或艺术命名推断。本目录不是活跃配置，不启用售卖、不改存档或正式玩家数据。

本次只进行机械导出与必要文件检查；没有重画或重跑整套美术评审，没有浏览器/游戏内验收。主图预算是既有规格的优化目标，实际字节和是否达标记录在清单。接入期间如出现实际显示问题，小典按具体问题配合调整资源。
'''
    (out/'README.md').write_text(readme,encoding='utf-8')
    print(json.dumps({'items':len(entries),'webp_files':count,'bytes':manifest['total_bytes'],'over_budget':over_budget,'output':str(out)},ensure_ascii=True))


if __name__ == '__main__':
    main()
