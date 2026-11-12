"""(C) 2026 Carinoasd. Boss r3 offline candidate: 小典 / Codex."""
import hashlib
import json
from pathlib import Path
import zipfile
import package_preview

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
OUTPUT=ROOT.parent/'output'


def sha(data):return hashlib.sha256(data).hexdigest()


def main():
    target=OUTPUT/'danmaku-stage01-boss-r3.zip'
    html=OUTPUT/'danmaku-stage01-boss-r3-offline.html'
    assert not target.exists(),'Refusing to overwrite an earlier candidate'
    assert html.read_text(encoding='utf-8')==package_preview.standalone_html(package_preview.bundled_rules())
    prefix='source/plugin/gamecenter/games/_danmaku_proto/'
    with zipfile.ZipFile(OUTPUT/'danmaku-stage01-show-v1.zip') as z:
        old={n[len(prefix):]:z.read(n) for n in z.namelist() if n.startswith(prefix)}
    current={p.relative_to(SOURCE).as_posix():p.read_bytes() for p in SOURCE.rglob('*') if p.is_file()}
    assert not set(old)-set(current)
    changed={n for n in old if old[n]!=current[n]}
    assert changed=={'battle.js','battle.php','stage.js','stage.php','rules.json','rules-data.js','boss-view.js','index.html','ui.js'},changed
    assert set(current)-set(old)=={'boss-patterns.js','boss-patterns.php'}
    for n in old:
        if n.endswith('.png') or n in ['audio.js','audio-bank.js','bgm-bank.js','midi.js','midi-bank.js','engine.js','engine.php','stage-replay.js','battle-replay.js','replay.js']:
            assert old[n]==current[n],n
    old_rules=json.loads(old['rules.json']);new_rules=json.loads(current['rules.json'])
    assert {k:v for k,v in new_rules.items() if k!='bossPatternsR3'}==old_rules
    entries={'START.html':html.read_bytes(),**{prefix+n:d for n,d in current.items()}}
    for name in ['docs/danmaku/BOSS-FIX-r3.md','docs/danmaku/CREDITS-v1.md','docs/danmaku/review/BOSS-r3.html']:
        entries[name]=(ROOT/name).read_bytes()
    entries['README.md']='''# 天使弹幕祭 · Boss r3试玩修正版

双击START.html离线试玩，第一版仍一关。设置中的“首领练习”可直接看Boss。
身体增加发梢、袖口、裙摆与轻微呼吸动态；三阶段改为青色双层花环、紫色锁定针雨、金色星门。
新开局为danmaku-stage01-r3，首领练习danmaku-p1-r3；旧r1/r2回放继续可复验。
音乐、HP、生命、强化、大招、计分和时长不变；简化模式保持静态身体。
本轮按定点检查交付，没有自动整关通关，难度与手感由avg达人试玩反馈。

原型 (C) 2026 Carinoasd；修正与实现：小典 / Codex。
图像沿用内置imagegen生成的既有素材，本轮没有重画或更换图片；音乐由avg达人以HappyShrimp和提示词工程完成。
完整当前运行文件在source/plugin/gamecenter/games/_danmaku_proto/。制作记录和未验项见docs/danmaku/BOSS-FIX-r3.md。
仅本地私用，不公开发布。没有浏览器资料、日志、玩家回放或凭据；文件SHA256见DELIVERY-MANIFEST.json。
'''.encode('utf-8')
    manifest={n:{'bytes':len(d),'sha256':sha(d)} for n,d in entries.items()}
    entries['DELIVERY-MANIFEST.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for n,d in entries.items():z.writestr(n,d)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert all(z.read(n)==d for n,d in entries.items())
    report={'status':'PASS','files':len(entries),'runtimeFiles':len(current),'changed':sorted(changed),
            'oldRuleValuesUnchanged':True,'allImagesAndAudioUnchanged':True,'legacyReplayCodePreserved':True,
            'standaloneMatchesSource':True,'archiveAllBytesMatch':True,'noExpandedDuplicateDelivery':True,
            'htmlBytes':html.stat().st_size,'zipBytes':target.stat().st_size,
            'htmlSha256':sha(html.read_bytes()),'zipSha256':sha(target.read_bytes())}
    p=ROOT/'tmp/danmaku/boss-r3/delivery-checks.json'
    p.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))


if __name__=='__main__':main()
