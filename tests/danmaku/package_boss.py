"""(C) 2026 Carinoasd. Compact Boss-art-v1 delivery: 小典 / Codex."""
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


def main():
    target=OUTPUT/'danmaku-stage01-boss-art-v1.zip'
    html=OUTPUT/'danmaku-stage01-boss-art-v1-offline.html'
    assert not target.exists(), 'Refusing to overwrite delivery'
    assert html.read_text(encoding='utf-8')==package_preview.standalone_html(package_preview.bundled_rules())
    prefix='source/plugin/gamecenter/games/_danmaku_proto/'
    changed=[]
    with zipfile.ZipFile(OUTPUT/'danmaku-stage01-ui-v1.zip') as old:
        baseline={n[len(prefix):]:old.read(n) for n in old.namelist() if n.startswith(prefix) and not n.endswith('/')}
    current={p.relative_to(SOURCE).as_posix():p.read_bytes() for p in SOURCE.rglob('*') if p.is_file()}
    assert not set(baseline)-set(current)
    changed=[n for n in baseline if baseline[n]!=current[n]]
    assert set(changed)=={'index.html','style.css','ui.js'}
    added=set(current)-set(baseline)
    assert added=={'boss-view.js','assets/boss-body-atlas-v1.png','assets/boss-ring-back-v1.png','assets/boss-ring-front-v1.png','assets/boss-face-v1.png'},added
    entries={'START.html':html.read_bytes(),**{prefix+n:data for n,data in current.items()}}
    for name in ['docs/danmaku/STAGE-01-BOSS-ART-v1.md','docs/danmaku/art/boss-production-v1/native-v1/manifest.json','docs/danmaku/art/boss-production-v1/PROMPTS.md']:
        entries[name]=(ROOT/name).read_bytes()
    entries['README.md']='''# 天使弹幕祭 · 第一关 Boss 美术 v1

双击 START.html 离线试玩。第一版仍只有一关，新Boss素材待人物观感反馈。
正式战斗形象替换几何占位：16帧主体、前后星仪、血条头像。设置中“首领练习”可直接看Boss。
暂停与恢复倒计时冻结动画，“简化动态效果”使用静帧；敌弹和判定点保持清楚。
UI和两首HappyShrimp成品BGM沿用已确认版；玩法规则、数值和回放格式不变。

原型 (C) 2026 Carinoasd；素材制作、原生整理、接入与验证：小典 / Codex。
图像来自内置imagegen，音乐由avg达人使用HappyShrimp与提示词工程完成。仅本地私用，不公开发布。
source/plugin/gamecenter/games/_danmaku_proto/ 是完整运行源码与素材，也可直接打开index.html。
docs/danmaku/STAGE-01-BOSS-ART-v1.md 记录实现、验证和未验项；素材清单和提示词同时保留。
源绘图与历史制作文件留在原工作区，不重复放进本包；旧版交付仍可回退。
DELIVERY-MANIFEST.json 包含每个文件SHA256。本包无浏览器配置、日志、用户回放或凭据。
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
            'changed':changed,'added':sorted(added),'allArchiveBytesMatch':True,'standaloneMatchesSource':True,
            'simulationReplayMusicAndPriorArtworkUnchanged':True,'noExpandedDuplicateDelivery':True,
            'zipSha256':sha(target.read_bytes()),'standaloneSha256':sha(html.read_bytes())}
    out=ROOT/'tmp/danmaku/stage01-boss-art-v1/delivery-checks.json'
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))


if __name__=='__main__':main()
