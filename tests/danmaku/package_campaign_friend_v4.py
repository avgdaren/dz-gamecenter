"""(C) 2026 Carinoasd. User-authorized two-stage peer playtest: 小典 / Codex."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT.parent/'output'
HERE=ROOT/'tmp/danmaku/campaign-friend-v4'
EXPECTED='5e44d8f38c84a6bae09d78f824314ca4a8446be3821f6bde1a42d796bcf5d584'
sha=lambda data:hashlib.sha256(data).hexdigest()


def txt(value):
    return value.replace('\n','\r\n').encode('utf-8-sig')


def main():
    baseline=json.loads((OUT/'danmaku-campaign-easy-v4-MANIFEST.json').read_text(encoding='utf-8'))
    source=OUT/baseline['output']['file'];game=source.read_bytes()
    assert sha(game)==baseline['output']['sha256']==EXPECTED
    assert len(game)==baseline['output']['bytes']
    assert baseline['browserVerification']['status']=='PASS'
    assert baseline['browserVerification']['sha256']==EXPECTED
    assert all(sha((ROOT/name).read_bytes())==digest for name,digest in baseline['sources'].items())
    class Offline(HTMLParser):
        def handle_starttag(self,tag,attrs):
            for key,value in attrs:
                if key in ('src','href'):
                    assert value.startswith(('data:','#')),value
    Offline().feed(game.decode('utf-8'))
    readme='''天使弹幕祭 · 两关 Easy 试玩
版本：两关剧情试玩 v4 / 2026-11-15

这是开发中的纵版弹幕射击游戏。目前可连续游玩：
第一关「星穹回廊」→ 第二关「风铃花庭」，每关有三阶段Boss。
本包提供两关Easy与完整开场、战前、战后对白；难度仍在收集反馈。
本版保留六段剧情，强化两关Boss换招：收招、蓄势、立绘宣告与释放。
右侧“换招回看”可直接查看四次切换，结束后停住，不会自动开始战斗。

【开始】
1. 下载压缩包，在电脑上解压。
2. 双击“开始游戏.html”，用电脑浏览器打开。
3. 点击“从第一关启程”。首次开始需要准备内置音乐，请等几秒。
游戏、图像和音乐已全部内置，断网可玩，无需安装运行环境或登录账号。
本轮在电脑Chrome中实测可打开；手机触控和其他浏览器尚未全面验证。

【操作】
方向键 / WASD：移动。游戏自动射击，无需按住Z。
对白时按Enter / 空格 / Z继续，也可点击“跳过本段”；正文长句会分成两行小页。
对白期间战斗和音乐暂停，读完后继续；标题页可关闭剧情，单段练习直接开始战斗。
按住Shift：低速集中射击，并显示红白判定点；集中键可在右侧更改。
X / 空格：大招（B）；Esc：暂停。
也可点击“保持低速”“大招”按钮。切换窗口会自动暂停，回来后点“继续”。

【资源与练习】
从第一关开始时为3命、2B、1级火力。
拾取P提升火力（最高5级），B补充大招（库存上限3）。
掉命后可捡回掉落的强化；复活时大招库存回到2。
靠近战场左上或右上区域可以吸收掉落。
第一关击破后自动进入第二关，生命、火力和B按实际保留。

右侧可单独练习两关或两位Boss；第二关及Boss练习有不同资源配置。
失败后可按已抵达的第二关 / Boss检查点重试；练习、重试和测试无敌会有标记。
想反馈正常连续流程时，请从第一关启程，先保持“测试无敌”关闭。
音乐、音效、静音和音乐音量均在右侧；音效默认关闭。

【希望听到你的体验】
可以按平常玩东方的方式体验，没通关也欢迎反馈。
重点看看：Easy定位是否合适；两关难度递进是否自然；哪些弹幕或判定难读；
道中是否拖沓、零碎或有明显空档；Boss招数是否有区别、是否有合理反应时间。

发现问题时，告诉avg达人“第几关、道中或Boss第几式、发生了什么”即可。
如果方便，补充当时火力 / 命 / B、是否练习或重试，以及截图或录屏。
包内“试玩反馈模板.txt”可直接填写；不必每项都答。
本版没有回放导出，不用找JSON；也不会自动上传试玩记录。

最终显示两关分项和累计试玩分，第二关计分仍为临时方案，不计排行榜。

原型 (C) 2026 Carinoasd。
方向与试玩：avg达人；音乐：avg达人提供。
实现、美术生成与素材接入：小典 / Codex；沿用既有内置imagegen素材。
本包按作者委托提供网友试玩，不连接论坛账号、积分或排行榜。
'''
    feedback='''天使弹幕祭 · 两关 Easy 试玩反馈
版本：两关剧情试玩 v4 / 2026-11-15
自由填写即可，不必每项都答；没通关也欢迎反馈。

1. 平常的东方经验（常玩作品 / 常玩难度 / 是否常打1CC）：

2. 本次入口（从第一关连续 / 单关 / Boss练习）：
   是否使用检查点重试或测试无敌：
   玩到哪里 / 是否完成两关：

3. 作为Easy，整体偏易、适中还是偏难？最明显的过松或突刺在哪一段？

4. 第一关接第二关，难度与节奏是否自然？进入第二关时大约几级火力、几命、几B？

5. 哪些敌人、弹幕、自机弹或判定看不清？请注明关卡与Boss第几式。

6. 道中长度、出敌密度、重复感、休息空档与音乐配合如何？

7. 两位Boss的招数是否有区分、能否读懂、是否有足够反应时间？

8. 操作、移动速度、散射 / 集中、大招、掉命后的恢复是否顺手？

9. 剧情是否易懂、说话者是否清楚？对白节奏、铃羽的立场和线索如何？

10. 最喜欢的部分 / 最想先改的一个问题：

11. 如遇异常：发生在哪关哪段、具体操作、浏览器和设备；可附截图或录屏。

反馈给avg达人即可。本模板不收集账号信息，也不会自动发送。
'''
    version='''天使弹幕祭 · 两关 Easy 网友试玩 v4
打包日期：2026-11-15
内容基线：两关剧情试玩 v4（沿用v3剧情与战斗，强化共同换招演出）。
游戏与本轮两关剧情离线版完全相同；保留v2杂兵、换招与背景修订。
旧版单关好友试玩r3保留，本包为新的两关入口。

范围：电脑浏览器离线试玩，两关Easy、三阶段Boss、资源继承、单段练习、检查点重试。
仍待制作或验证：后续关卡剧情、第二关Normal / Hard、正式计分与排行榜、真实手机体验。
本轮打包只核对文件完整性和解压后的短启动，不做自动整关通关。

校验信息见 FRIEND-DEMO-MANIFEST.json；通常无需打开。
'''
    entries={'开始游戏.html':game,'试玩说明.txt':txt(readme),'试玩反馈模板.txt':txt(feedback),'版本说明.txt':txt(version)}
    manifest={'version':'campaign-easy-friend-v4','date':'2026-11-15','scope':'user-authorized-peer-playtest','gameRule':'danmaku-campaign-easy-v3','presentationRevision':4,'difficulty':'easy','stageCount':2,'sourceFile':source.name,'gameUnchanged':True,'ranked':False,
              'prototypeCopyright':'(C) 2026 Carinoasd','author':'小典 / Codex','files':{name:{'bytes':len(content),'sha256':sha(content)} for name,content in entries.items()}}
    entries['FRIEND-DEMO-MANIFEST.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    target=OUT/'天使弹幕祭-demo-两关Easy-网友试玩-v4.zip';HERE.mkdir(parents=True,exist_ok=True)
    candidate=HERE/target.name
    with zipfile.ZipFile(candidate,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name,content in entries.items():
            info=zipfile.ZipInfo(name,date_time=(2026,11,15,12,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,content,compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
    assert not target.exists() or target.read_bytes()==candidate.read_bytes(),'Refusing to overwrite a different peer package'
    target.write_bytes(candidate.read_bytes())
    extracted=HERE/'extracted-1';extracted.mkdir(exist_ok=True)
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        assert set(z.namelist())==set(entries)
        for name,content in entries.items():
            assert '/' not in name and '\\' not in name and ':' not in name
            assert z.read(name)==content
            dest=extracted/name;assert not dest.exists() or dest.read_bytes()==content
            dest.write_bytes(z.read(name))
        assert all(z.getinfo(name).flag_bits&0x800 for name in entries if not name.isascii())
    assert (extracted/'开始游戏.html').read_bytes()==game
    assert sha(source.read_bytes())==EXPECTED
    report={'status':'PASS','file':target.name,'zipBytes':target.stat().st_size,'zipSha256':sha(target.read_bytes()),'files':list(entries),'gameBytes':len(game),'gameSha256':EXPECTED,
            'gameMatchesDeliveredCampaignV4':True,'sourceHashesMatched':len(baseline['sources']),'zipCrcVerified':True,'utf8FilenamesVerified':True,'textEncoding':'UTF-8 BOM / CRLF','extractedHtmlByteIdentical':True,'externalResources':0,'naturalFullClearTested':False}
    (HERE/'package-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':main()
