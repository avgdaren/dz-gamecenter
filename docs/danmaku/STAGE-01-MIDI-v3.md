# 星穹回廊 · 双参考 MIDI v3

2026-11-12（北京时间）。作曲、电子音色与接入：小典 / Codex；原型 `(C) 2026 Carinoasd`。本地私用候选，待用户试听。

后续用户反馈：风格没问题，但精细度低于期望；这是非商业个人作品，不要求严格对标东方原曲。用户已接受尝试Suno等成熟音乐模型，并会自行注册、尝试接入。当前v3作为可玩基线保留，尚无Suno生成结果或新音乐接入；最新续作安排见[NEXT-CHAT-HANDOFF](NEXT-CHAT-HANDOFF.md)顶部。本文下面保留v3制作与技术验证经过，不等于音乐成品已验收。

用户指定Boss参考《亡き王女の為のセプテット》，道中参考《幻視の夜 ～ Ghostly Eyes》。本轮分别重写旋律、和声与段落，并保留此前的动感电子乐、真正MIDI、一关范围。参考情绪、旋律组织与配器方向，两首使用独立新写的主题；没有导入参考曲的乐谱、MIDI、录音或采样。

## 两首的编排区别

| 用途 | 新曲与结构 | 编排 |
|---|---|---|
| 道中 | 《星穹夜航》，D小调，150 BPM，45小节／72秒 | 暗色但轻快；合成笛主奏、钢琴琶音、切分贝斯、电子鼓；引子→主题A→应答变奏→悬疑桥段→主题B→回归→短呼吸→Boss连接 |
| Boss | 《星冠终奏》，G小调，168 BPM，28小节／约40秒循环 | 钢琴开场→铜管长主题A→上行主题B→主题再现；弦乐垫底、合成应答与更强节拍，形成明暗和强弱起伏 |

两首分别写有8小节A／B旋律，带留白、长短句和收尾。Boss核心层第一阶段就有完整主奏，第二／三阶段加入0.45／0.8推进层；跨阶段保持同一音乐位置。道中有独立和声、旋律与断拍底鼓，Boss使用另一套主题、调性和四拍脉冲。

参考依据已核对曲目资料及作者Music Room评论的转录：[《Septette》的曲评转录](https://www.vgmpf.com/Wiki/index.php/Septette_for_a_Dead_Princess)强调最终战的收束感、易记旋律与融合取向；[《Ghostly Eyes》的曲评转录](https://w.atwiki.jp/tohomusicdb/pages/120.html)强调一面轻快节奏与夜色的暗调。上述钢琴／铜管与暗夜配器为本轮创作选择；本轮未以实际扬声器／耳机试听参考原录音。

## MIDI与音色

[原始乐谱](audio/stage01-midi-v3/score.json)包含全部新主题音符、节奏、和声与段落。[编曲脚本](../../tests/danmaku/build_stage01_midi_v3.py)使用Python标准库，复用向后兼容的SMF写入器，拒绝覆盖既有生成目录。原v2默认参数与字节输出保留；v1／v2所有源文件、试玩和压缩包均保留。

交付7份SMF Type 1／PPQ480原曲：`stage.mid`、`boss.mid`完整曲，`bossCore.mid`／`bossDrive.mid`游戏分层，以及3秒《星门启封》、约4秒《破晓星冠》、2.4秒《夜航再启》。运行使用6份SMF，Boss完整曲为便于独立编辑的合并版。168 BPM整数微秒速度使Boss实际循环为40.000016秒。每份音符事件、GM程序、时值与SHA256见[清单](audio/stage01-midi-v3/midi-v3/manifest.json)及同目录事件JSON。

游戏直接解析MIDI并由原生Web Audio发声。本轮新增自制合成钢琴、铜管、笛音与弦乐，GM从0计数为0／56／73／48；贝斯39、垫音90、合成应答81沿用现有程序。钢琴采用衰减泛音，铜管和长笛音有轻微振音，Boss弦乐慢起音；这组音色为合成近似，不使用外部采样或音源。MIDI v3底鼓触发的旋律瞬时增益最低值调为0.52，保留主旋律轮廓；旧v2仍使用0.28。

32个MIDI音符声部、80ms提前调度、循环时钟、跳转重建持续音符、暂停取消全部音符与节点清理沿用已验证框架。16种原音效与6声部限制逐字节不变；音乐默认55%，音效默认关闭／启用后65%，本机已有设置优先。没有CDN、SoundFont、MIDI设备权限或新增运行依赖。

## 交付与验证

- [16秒道中／Boss试听页](audio/stage01-midi-v3/preview.html)：由游戏同款合成器渲染的WAV，提供原始MIDI下载。游戏BGM仍直接演奏MIDI。
- 单文件：`E:\GPT工作区\output\danmaku-stage01-midi-v3-offline.html`。
- 完整制作包：`E:\GPT工作区\output\danmaku-stage01-midi-v3.zip`，根目录`START.html`。
- 7份原曲包：`E:\GPT工作区\output\danmaku-stage01-midi-v3-midi.zip`。

9项MIDI检查、14项音频生命周期检查通过：SMF逐音符／时间／力度／GM程序往返、损坏输入拒绝、分层循环与跳转、32声部上限、暂停清理短音符、原音效与规则／美术不变。自动检查按当前音库版本选择原曲，不会拿v2事件误核对v3。

最终浏览器整关、冷启动、混音与打包结果见本页末尾的本轮验证记录。数字检查不等于真人听感验收；真实扬声器／耳机、真人完整难度与真实手机仍待测试。第一版仍一关，规则`danmaku-stage01-r2`；不扩关、不接平台，不改Discuz公共契约或数据库。

```powershell
python tests/danmaku/build_stage01_midi_v3.py --output tmp/danmaku/stage01-midi-v3/rebuild
node tests/danmaku/test-midi.cjs
node tests/danmaku/test-audio.cjs
python tests/danmaku/check_stage01_audio.py
node tests/danmaku/browser-stage01.cjs --midi
node tests/danmaku/browser-stage01.cjs --midi --cold-audio
python tests/danmaku/package_preview.py --check
```

## 本轮最终验证记录

独立Chrome通过正常输入运行9688逻辑步自然通关，使用2枚大招、收集2个B和16点P、最高Ⅲ档；实际浏览器终点与JS／PHP全部快照一致。6份SMF均解析，共排程5127个音符，观察峰值19声部，无迟到丢弃／抢占／丢音。整关音乐与终局收尾、试听不推进游戏、静音、失焦、暂停恢复、阶段分层及原交互回归通过；HTTP0、JS／音频异常0，主运行追帧保护0。前置交互检查发生1次追帧保护暂停并恢复；另有后台自动暂停与评审截图前主动暂停，不包装为整份记录零暂停。运行报告与实际回放保存在`tmp/danmaku/stage01-midi-v3/browser/`，不随包交付。

全新Chrome不先试听直接开始，第19步完成16份音效加载和6份SMF解析，持续到第322步保持运行，音乐偏移正确，无异常／保护暂停。默认音效仍关闭。

实际浏览器使用同款合成器渲染：道中16秒峰值0.55543／RMS0.08491，Boss16秒峰值0.54217／RMS0.08117，Boss循环边界4秒峰值0.49930；Boss加6个高优先级音效压力混音峰值0.54217，所测片段无削波。没有把片段数字验证写成整曲听感验收。

38份JS、12份PHP、31份JSON与11份Python语法通过。15个内嵌脚本、6张PNG、6份MIDI和16份音效与源码一致；9项MIDI与14项音频生命周期检查通过。v3的16份生成文件、v2的17份文件在新目录逐字节复现。10份规则／JS-PHP模拟／回放及全部美术与已测音频v1逐字节相同；PHP未改，未重测或扩大历史474.91ms预算。
