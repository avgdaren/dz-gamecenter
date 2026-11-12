"""(C) 2026 Carinoasd. Reviewable Xiaolan handoff: 小典 / Codex."""
import hashlib
import json
from pathlib import Path
import zipfile
ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT.parent/'output'
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    baseline=json.loads((ROOT/'docs/danmaku/PLAYTEST-BASELINE-r3.json').read_text(encoding='utf-8'))
    html=OUTPUT/baseline['standalone']['file'];assert sha(html.read_bytes())==baseline['standalone']['sha256']
    target=OUTPUT/'danmaku-xiaolan-handoff-r3.zip';assert not target.exists(),'Refusing overwrite'
    entries={'START.html':html.read_bytes()}
    for folder in ['source/plugin/gamecenter/games/_danmaku_proto','docs/danmaku/handoff-v1','docs/danmaku/art/game-icon-v1','tests/danmaku']:
        for p in sorted((ROOT/folder).rglob('*')):
            if not p.is_file() or '__pycache__' in p.parts:continue
            assert p.suffix in {'.html','.js','.cjs','.php','.css','.json','.png','.md','.txt','.py'},p
            entries[p.relative_to(ROOT).as_posix()]=p.read_bytes()
    for name in ['docs/danmaku/BOSS-FIX-r3.md','docs/danmaku/CREDITS-v1.md','docs/danmaku/PLAYTEST-BASELINE-r3.json']:
        entries[name]=(ROOT/name).read_bytes()
    entries['README.md']='''# 天使弹幕祭 r3 · 小蓝交接资料

START.html为用户确认的离线Demo，双击可玩。
先读docs/danmaku/handoff-v1/XIAOLAN-HANDOFF.md；图标与榜单示意见同目录review.html。
小典准备游戏源码、128／512／64／32图标、登记候选、榜单口径和提交字段桥接。
小蓝负责当前平台适配、本地论坛验证及最后的线上部署包。本包不是论坛安装包，勿整目录覆盖站点。
新条目angel_danmaku，保留旧danmaku。日／周／总榜复用平台，标准完整关卡自然终局入榜，辅助／专项练习不入榜，奖励先0。
原型PHP有CLI保护，前端为整页原型，需按说明完成IN_DISCUZ模块边界与stage容器适配。

运行内容与用户认可的r3不变。本轮图标／字段转换／文件检查不冒充论坛登录、提交、榜单验收。
tests/danmaku/fixtures为匿名自动输入测试夹具，不是真实玩家资料。没有凭据、DB、浏览器配置、日志或站点配置。
原型(C) 2026 Carinoasd；制作与交付：小典 / Codex；方向和试玩：avg达人。
主BGM由avg达人以HappyShrimp和提示词工程制作。图标母图、提示词、来源记录随附。
主人已明确允许本次源码、图像和音乐交接到现有公开GitHub仓库；实际Issue／PR链接见交接目录GITHUB.json。
小蓝负责后续论坛验证与线上包，本包不是安装包，也不代表已合并或部署。
所有条目大小和SHA256见HANDOFF-MANIFEST.json。
'''.encode('utf-8')
    meta={n:{'bytes':len(d),'sha256':sha(d)} for n,d in entries.items()}
    github_file=ROOT/'docs/danmaku/handoff-v1/GITHUB.json'
    github=json.loads(github_file.read_text(encoding='utf-8')) if github_file.exists() else {}
    entries['HANDOFF-MANIFEST.json']=(json.dumps({'version':'xiaolan-handoff-r3','forumInstalled':False,'github':github,
        'acceptedDemoSha256':baseline['standalone']['sha256'],'files':meta},ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for n,d in entries.items():z.writestr(n,d)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None and set(z.namelist())==set(entries)
        assert all(z.read(n)==d for n,d in entries.items())
        assert z.read('START.html')==html.read_bytes()
    report={'status':'PASS','files':len(entries),'bytes':target.stat().st_size,'sha256':sha(target.read_bytes()),
            'demoUnchanged':True,'allArchiveBytesMatch':True,'forumInstalled':False,'github':github}
    out=ROOT/'tmp/danmaku/handoff-v1';out.mkdir(parents=True,exist_ok=True)
    (out/'package-checks.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
if __name__=='__main__':main()
