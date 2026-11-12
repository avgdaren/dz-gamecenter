"""(C) 2026 Carinoasd. Compact presentation-v1 delivery: 小典 / Codex."""
import hashlib
import json
from pathlib import Path
import zipfile
import package_preview

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
OUTPUT=ROOT.parent/'output'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def check_runtime():
    prefix='source/plugin/gamecenter/games/_danmaku_proto/'
    with zipfile.ZipFile(OUTPUT/'danmaku-stage01-boss-art-v1.zip') as z:
        old={n[len(prefix):]:z.read(n) for n in z.namelist() if n.startswith(prefix) and not n.endswith('/')}
    current={p.relative_to(SOURCE).as_posix():p.read_bytes() for p in SOURCE.rglob('*') if p.is_file()}
    assert not set(old)-set(current)
    changed={n for n in old if old[n]!=current[n]}
    added=set(current)-set(old)
    assert changed=={'index.html','style.css','ui.js','boss-view.js'},changed
    assert added=={'stage-show.js','assets/boss-portrait-v1.png'},added
    original=ROOT/'docs/danmaku/art/production-candidates/boss-body-v1.png'
    assert current['assets/boss-portrait-v1.png']==original.read_bytes()
    assert sha(original.read_bytes())=='79fbf9c029691bfa41e9745e2dabd21add27d93e184fe3a8f4c25f98a0862cce'
    return prefix,current,changed,added


def main():
    target=OUTPUT/'danmaku-stage01-show-v1.zip'
    html=OUTPUT/'danmaku-stage01-show-v1-offline.html'
    assert not target.exists(), 'Refusing to overwrite delivery'
    assert html.read_text(encoding='utf-8')==package_preview.standalone_html(package_preview.bundled_rules())
    prefix,current,changed,added=check_runtime()
    entries={'START.html':html.read_bytes(),**{prefix+n:data for n,data in current.items()}}
    record='docs/danmaku/STAGE-01-SHOW-v1.md'
    entries[record]=(ROOT/record).read_bytes()
    entries['README.md']='''# 天使弹幕祭 · 第一关演出 v1

双击START.html即可离线试玩。设置的“首领练习”可直接看登场与Boss战。
原主立绘登场、两次阶段突破、星仪消散与通关收尾已接入；三个招式名是本轮文案初版。
移动使用稳定站姿与连续轻倾，暂停／后台／恢复倒计时冻结，简化模式减少动态效果。
登场仍3秒、阶段空档仍2秒；音乐、弹幕、命中判定、计分和回放格式沿用原版，仍一关。
通关后立即显示操作按钮，可保存回放；收尾动效不消耗游戏时间。

原型 (C) 2026 Carinoasd；演出设计、实现和验证：小典 / Codex。
人物图像沿用内置imagegen生成的旧素材；音乐由avg达人使用HappyShrimp与提示词工程制作。
仅本地私用，不公开发布。源码和全部运行素材位于source/plugin/gamecenter/games/_danmaku_proto/。
制作与未验项见docs/danmaku/STAGE-01-SHOW-v1.md。旧交付与素材源文件在原工作区保留。
所有文件的字节数及SHA256见DELIVERY-MANIFEST.json；没有浏览器配置、日志、用户回放或凭据。
'''.encode('utf-8')
    manifest={n:{'bytes':len(d),'sha256':sha(d)} for n,d in entries.items()}
    entries['DELIVERY-MANIFEST.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for n,d in entries.items():z.writestr(n,d)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert set(z.namelist())==set(entries)
        assert all(z.read(n)==d for n,d in entries.items())
    report={'status':'PASS','files':len(entries),'zipBytes':target.stat().st_size,'htmlBytes':html.stat().st_size,
            'changed':sorted(changed),'added':sorted(added),'allArchiveBytesMatch':True,'standaloneMatchesSource':True,
            'simulationReplayAudioAndExistingImagesUnchanged':True,'portraitMatchesOldOriginal':True,
            'zipSha256':sha(target.read_bytes()),'standaloneSha256':sha(html.read_bytes()),'noExpandedDuplicateDelivery':True}
    out=ROOT/'tmp/danmaku/stage01-show-v1/delivery-checks.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))


if __name__=='__main__':main()
