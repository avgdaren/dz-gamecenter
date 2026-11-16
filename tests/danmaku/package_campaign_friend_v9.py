"""(C) 2026 Carinoasd. User-authorized v9 offline peer playtest: 小典 / Codex."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'tmp/danmaku/campaign-friend-v9'
OUT = ROOT.parent / 'output/天使弹幕祭'
EXPECTED = '082205fae9f90313a2f6dfea667adbc5498da73bd82725b8dc152a2d45c6e93c'
sha = lambda data: hashlib.sha256(data).hexdigest()


def txt(text):
    return text.replace('\n', '\r\n').encode('utf-8-sig')


def main():
    source = OUT / '当前试玩/danmaku-campaign-easy-v9-offline.html'
    baseline = json.loads((source.parent / 'danmaku-campaign-easy-v9-MANIFEST.json').read_text(encoding='utf-8'))
    validation = json.loads((ROOT / 'docs/danmaku/assets-optimization-v1-validation.json').read_text(encoding='utf-8'))
    game = source.read_bytes()
    assert sha(game) == baseline['sha256'] == validation['currentHtmlSha256'] == EXPECTED
    assert len(game) == baseline['bytes'] == 47666849
    assert validation['browser']['status'] == 'PASS'
    assert all(sha((ROOT / name).read_bytes()) == digest for name, digest in baseline['sourceHashes'].items())

    class Offline(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for key, value in attrs:
                if key in ('src', 'href'):
                    assert value.startswith(('data:', '#')), value

    Offline().feed(game.decode('utf-8'))
    readme = '''天使弹幕祭 · 两关 Easy 网友测试版
版本：v9 / 2026-11-16

当前内容：第一关「星穹回廊」→ 第二关「风铃花庭」，每关三阶段Boss。
包含完整开场、战前、战后剧情，以及关间祈祷过场。
本版采用新的Boss立绘／法阵／符纹演出，保留自机大招反馈，优化素材体积和音乐准备。
目前两关连战仅为Easy，手感与难度仍在收集反馈；不计排行榜。

【开始】
1. 把ZIP解压到电脑上的一个文件夹。
2. 双击“开始游戏.html”，用浏览器打开。
3. 点击“从第一关启程”。音乐在首次交互后准备，不消耗关卡时间。
游戏、图像、字体和音乐全部内置，无需安装、登录或联网。
本轮验证电脑Chrome；其他浏览器与手机尚未全面验证。

【操作】
方向键 / WASD：移动；自动射击，不需要按住Z。
按住Shift：低速集中，显示红白判定点；右侧可更改集中键。
X / 空格：释放大招，消耗1B，用于清弹、伤害敌人并短暂无敌。
Esc：暂停。也可点击画布下方按钮；切换窗口自动暂停，回来点“继续”。
对白时Enter / 空格 / Z继续，也可点击“跳过本段”。
阅读对白时战斗和音乐冻结；标题页可关闭剧情，单段练习直接开始战斗。

【资源与练习】
正常连续开局：3命、2B、1级火力。P强化火力，最高5级；B补充大招，库存上限3。
掉命后可捡回掉落的强化，复活时大招库存回到2。
靠近左上或右上区域可以吸收掉落。进入第二关时生命、火力和B按实际继承。
右侧可单关 / Boss练习，也可选择起始资源；失败后可用已抵达的检查点重试。
练习、重试和测试无敌会有标记。反馈连续挑战时，请注明是否开启了辅助。
音乐、音效、音量、静音和“简化动态”均在右侧，音效默认关闭。
“演出回看”可直接看登场、换式和收尾；支持暂停、慢放，结束后停住。

【反馈】
欢迎按平时玩东方的习惯体验，没通关也可以反馈，不必每项都答。
重点看看：Easy压力与两关递进、道中节奏、敌人与弹幕辨识、Boss换招和招名阅读、
大招用途是否清楚，以及启动、音乐准备或切关时是否出现长等待 / 卡顿 / 缺声。
若遇异常，请注明版本v9、第几关 / Boss第几式、当时命 / 火力 / B、入口与是否重试，
以及浏览器、设备和大概等待时间；方便的话附截图或录屏。
“试玩反馈模板.txt”可直接填写，反馈给avg达人即可，不会自动发送或上传。
本版没有回放导出，不用找JSON。最终分数是本地试玩分，第二关计分仍为临时方案。

原型 (C) 2026 Carinoasd。
方向与试玩：avg达人；音乐：avg达人提供。
实现、美术与素材接入：小典 / Codex；沿用已有生成素材。
本包按avg达人要求提供网友试玩，不连接论坛账号、积分或排行榜。
'''
    feedback = '''天使弹幕祭 · 两关 Easy 网友测试反馈
版本：v9 / 2026-11-16。自由填写，没通关也欢迎反馈。

1. 东方 / 弹幕游戏经验（常玩作品、难度，是否常打1CC）：

2. 浏览器与设备：
   从双击HTML到标题大约多久？点击开始后等待声音大约多久？
   过程中是否卡顿、缺图、缺声，或切关后音乐迟到？请注明位置：

3. 入口（两关连续 / 单关 / Boss练习）：
   是否检查点重试、开启测试无敌或简化动态：
   玩到哪里 / 是否完成两关：

4. 作为Easy，偏易 / 适中 / 偏难？最明显的过松或压力突刺在哪里？

5. 两关难度与节奏衔接如何？抵达第二关时大约几命、几级火力、几B？

6. 道中长度、出敌编队、重复感、空档和音乐配合如何？

7. 哪些敌人、子弹、自机弹或判定看不清？注明关卡 / Boss第几式：

8. Boss招数是否有区别，是否能读懂并合理反应？
   登场 / 换招是否顺畅，招名是否可读，演出是否遮挡危险信息？

9. 移动、散射 / 集中、大招用途与掉命后的恢复是否顺手？

10. 剧情、说话者和对白节奏是否清楚？

11. 最喜欢的部分 / 最想先改的一个问题：

12. 其他异常：发生位置、操作步骤、当时资源和入口，可附截图或录屏。

发给avg达人即可。不会收集账号信息或自动发送。
'''
    version = '''天使弹幕祭 · 两关 Easy 网友测试版 v9
打包日期：2026-11-16

游戏本体与当前两关离线v9逐字节一致，仅重命名为“开始游戏.html”。
包含两关剧情、共同Boss新演出、自机大招反馈、资源继承、练习与检查点重试。
本版压缩发行图片、按需准备音频；BGM保留当前运行音乐原码流，原画尺寸与Alpha保留。
没有调整攻击、HP、碰撞、等待时长或补给。此次打包不另做平衡变更。

这是电脑浏览器的离线测试包，不是论坛安装包；不包含线上接入候选或独立Normal / Hard。
尚未完成：第二关Normal / Hard、第三关、正式计分 / 排行榜与真实手机完整验证。
打包检查只核对完整性、断网解压启动、声音与暂停，不自动跑整关通关。

原型 (C) 2026 Carinoasd；新增实现与打包：小典 / Codex。
校验信息见FRIEND-DEMO-MANIFEST.json，通常无需打开。
'''
    entries = {'开始游戏.html': game, '试玩说明.txt': txt(readme), '试玩反馈模板.txt': txt(feedback), '版本说明.txt': txt(version)}
    manifest = {'version': 'campaign-easy-friend-v9', 'date': '2026-11-16', 'scope': 'user-authorized-peer-playtest',
                'gameRule': baseline['rule'], 'presentationRevision': 8, 'assetLoadingRevision': 9, 'difficulty': 'easy', 'stageCount': 2,
                'gameUnchanged': True, 'sourceFile': source.name, 'ranked': False, 'prototypeCopyright': '(C) 2026 Carinoasd', 'author': '小典 / Codex',
                'files': {name: {'bytes': len(content), 'sha256': sha(content)} for name, content in entries.items()}}
    entries['FRIEND-DEMO-MANIFEST.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    HERE.mkdir(parents=True, exist_ok=True)
    target = OUT / '网友试玩包/天使弹幕祭-demo-两关Easy-网友试玩-v9.zip'
    candidate = HERE / target.name
    with zipfile.ZipFile(candidate, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in entries.items():
            info = zipfile.ZipInfo(name, date_time=(2026, 11, 16, 12, 0, 0))
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    assert not target.exists() or target.read_bytes() == candidate.read_bytes(), 'Refusing to overwrite a different package'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(candidate.read_bytes())
    extracted = HERE / 'extracted-1'
    extracted.mkdir(exist_ok=True)
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(entries)
        for name, data in entries.items():
            assert '/' not in name and '\\' not in name and ':' not in name
            assert archive.read(name) == data
            (extracted / name).write_bytes(archive.read(name))
            if not name.isascii():
                assert archive.getinfo(name).flag_bits & 0x800
    assert sha(source.read_bytes()) == EXPECTED
    report = {'status': 'PASS', 'file': target.name, 'zipBytes': target.stat().st_size, 'zipSha256': sha(target.read_bytes()), 'files': list(entries),
              'gameBytes': len(game), 'gameSha256': EXPECTED, 'gameMatchesCurrentV9': True, 'sourceHashesMatched': len(baseline['sourceHashes']),
              'zipCrcVerified': True, 'utf8FilenamesVerified': True, 'textEncoding': 'UTF-8 BOM / CRLF', 'extractedHtmlByteIdentical': True,
              'externalResources': 0, 'naturalFullClearTested': False}
    (HERE / 'package-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True))


if __name__ == '__main__':
    main()
