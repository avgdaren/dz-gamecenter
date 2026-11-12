"""(C) 2026 Carinoasd. Private friend-playtest package: 小典 / Codex."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT.parent/'output'


def sha(data):return hashlib.sha256(data).hexdigest()


def main():
    baseline=json.loads((ROOT/'docs/danmaku/PLAYTEST-BASELINE-r3.json').read_text(encoding='utf-8'))
    game=OUTPUT/baseline['standalone']['file']
    data=game.read_bytes()
    assert len(data)==baseline['standalone']['bytes'] and sha(data)==baseline['standalone']['sha256']
    target=OUTPUT/'天使弹幕祭-demo-好友试玩-r3.zip'
    assert not target.exists(),'Refusing to overwrite an existing friend package'
    readme='''天使弹幕祭 · 星穹回廊 Demo

一关弹幕射击：72秒道中＋三阶段Boss。当前为r3好友私下试玩版。

开始：
1. 将压缩包保存到电脑并解压。
2. 双击“开始游戏.html”，在电脑浏览器中打开。
3. 点击“开始第一关”。游戏和音乐已全部包含，断网也能玩，无需安装环境。

操作：
方向键／WASD移动；自动射击。
按住Shift：低速集中射击，显示红白判定点。
X／空格：大招；Esc：暂停。
P强化火力，B补充大招。设置中的“首领练习”可直接看Boss。
想先熟悉路线可开启“辅助练习”；“简化动态效果”可减少演出。
音乐与音效可分别调节，音效默认关闭；点击开始后才播放音乐。
切换窗口会自动暂停，继续后有恢复倒计时。

如果发现问题，告诉avg达人在哪个阶段、出现什么现象即可。
终局可以“保存本局回放”，有需要时把JSON一并发给他。

原型 (C) 2026 Carinoasd；实现、素材接入与整理：小典 / Codex。
方向与试玩：avg达人；两首主BGM由avg达人以HappyShrimp配合提示词工程制作。
人物与场景沿用内置imagegen生成的既有素材。
仅用于好友私下试玩。本包不连接论坛账号、积分或排行榜。
'''.encode('utf-8')
    entries={'开始游戏.html':data,'试玩说明.txt':readme}
    manifest={'version':'friend-demo-r3','scope':'private-friend-playtest','gameRule':'danmaku-stage01-r3',
              'files':{n:{'bytes':len(d),'sha256':sha(d)} for n,d in entries.items()}}
    entries['FRIEND-DEMO-MANIFEST.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name,content in entries.items():z.writestr(name,content)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert set(z.namelist())==set(entries)
        assert all(z.read(n)==d for n,d in entries.items())
        assert z.read('开始游戏.html')==game.read_bytes()
    report={'status':'PASS','file':target.name,'zipBytes':target.stat().st_size,'zipSha256':sha(target.read_bytes()),
            'files':list(entries),'gameMatchesAcceptedR3':True,'sourceUnchanged':sha(game.read_bytes())==baseline['standalone']['sha256'],
            'browserLaunched':False,'gameRun':False}
    out=ROOT/'tmp/danmaku/friend-demo-r3'
    out.mkdir(parents=True,exist_ok=True)
    (out/'package-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':main()
