# 星穹回廊 · 电子乐 MIDI v2

2026-11-11（北京时间）。原创作曲／电子音色／接入：小典 / Codex；原型版权 `(C) 2026 Carinoasd`。本地私用候选，待用户试听确认。

后续记录：用户指定Boss参考《亡き王女の為のセプテット》、道中参考《幻視の夜 ～ Ghostly Eyes》，当前已改用[双参考MIDI v3](STAGE-01-MIDI-v3.md)。本页及v2原曲／试听／交付保留为历史，不代表用户已认可本版音乐。

用户明确要求改掉原版BGM，使用“动感、激烈的电子乐”“MIDI”“偏西洋风格”。本轮重新作曲，以150／168 BPM的四拍底鼓、切分合成贝斯、失谐锯齿主奏、十六分琶音、军鼓／拍手推进，方向为西洋旋律电子／硬派Trance。原版钟琴和轻柔配器不再用于当前游戏音乐；旧音频与旧交付保留为历史。第一版仍只有一关。

## 乐曲与真正的 MIDI 文件

| 乐曲 | 速度／长度 | 用途 |
|---|---|---|
| [《霓光回廊》stage.mid](audio/stage01-midi-v2/midi-v2/stage.mid) | 150 BPM／72秒 | 45小节，小怪段的起跑、主题、推进、强拍主段、短呼吸与末段 |
| [《星仪超频》boss.mid](audio/stage01-midi-v2/midi-v2/boss.mid) | 168 BPM／约40秒循环 | 可在MIDI编辑器独立打开的完整Boss曲 |
| [bossCore.mid](audio/stage01-midi-v2/midi-v2/bossCore.mid)／[bossDrive.mid](audio/stage01-midi-v2/midi-v2/bossDrive.mid) | 同步28小节 | 游戏使用的核心／推进两层，三阶段推进层为0／0.45／0.8，跨阶段音乐位置连续 |
| [《引燃》intro.mid](audio/stage01-midi-v2/midi-v2/intro.mid) | 160 BPM／3秒 | Boss准备段 |
| [《冲破天际》clear.mid](audio/stage01-midi-v2/midi-v2/clear.mid) | 180 BPM／约4秒 | 通关收尾，仅播一次 |
| [《重启》defeat.mid](audio/stage01-midi-v2/midi-v2/defeat.mid) | 150 BPM／2.4秒 | 失败收尾，仅播一次 |

交付共7份`.mid`，运行使用其中6份，完整Boss曲是便于编辑的合并版。[乐谱](audio/stage01-midi-v2/score.json)、[SMF清单／SHA256](audio/stage01-midi-v2/midi-v2/manifest.json)、每曲事件审计JSON及[标准库编曲脚本](../../tests/danmaku/build_stage01_midi.py)全部保留。没有借用现成MIDI、商业曲、采样包或外部生成服务。

文件为Standard MIDI File Type 1，PPQ480，含速度、4/4拍号、E小调调号、轨名、版权、音色、力度、控制器、音符开／关与轨道结束事件。SMF保存带时间的演奏事件，使用tempo和PPQ换算演奏时间，见[MIDI Association的SMF说明](https://midi.org/standard-midi-files)及[Microsoft时值说明](https://learn.microsoft.com/en-us/windows/win32/multimedia/timing-information)。168 BPM在整数微秒速度下实际循环为40.000016秒；两层使用同一速度与时钟。

## 游戏如何发声

游戏直接解析内嵌的SMF字节流，由新增`midi.js`调度到Web Audio电子合成器。运行BGM不使用WAV替代，不请求MIDI设备权限，不依赖CDN、SoundFont或额外安装。音符调度按[Web Audio规范](https://www.w3.org/TR/webaudio-1.0/)使用音频时钟，游戏规则仍由固定逻辑步计算。

音色程序采用GM编号：从1计数为40 Synth Bass 2、81 Lead 1 Square、82 Lead 2 Sawtooth、91 Pad 3 Polysynth；代码从0计数为39／80／81／90。第10通道为鼓组，使用36底鼓、38军鼓、39拍手、42闭镲、46开镲、49吊镲。游戏内实现这组自有电子音色和底鼓触发的旋律压低；这不是完整GM音源。外部MIDI播放器的实际音色取决于所用音源，GM并不规定统一的声音样本，参见[MIDI Association说明](https://midi.org/community/midi-software/trying-to-find-gm2-401)。

MIDI最多32个音符声部，提前80ms调度，每层每次最多处理64个事件；压力下优先保留底鼓、贝斯和主奏。静音推进层只走时间，不创建音源。暂停／重来取消已排程音符并断开各层音频节点；恢复重建当前仍持续的旋律音符，跳过过期鼓点，不补播旧事件。Boss两层共享循环起点，切阶段只平滑改层音量。

16种原战斗／菜单音效逐字节保留，继续使用PCM和独立6声部限制。音乐默认55%，音效默认关闭、启用后65%，本机已有设置优先。开始／继续／试听的真实交互解锁声音，6秒试听不推进关卡。暂停、失焦、后台和恢复倒计时保持安静；终局收尾仅播一次。声音设置、静音、取消异步试听和不支持音频时继续游戏的行为沿用v1。

## 试听与交付

- [独立试听页](audio/stage01-midi-v2/preview.html)：小怪段16秒、Boss段16秒，两段均由游戏同款MIDI合成器经浏览器OfflineAudioContext渲染；旁边提供原始MIDI下载。试听WAV用于方便播放，游戏BGM仍直接演奏MIDI。
- 单文件试玩：`E:\GPT工作区\output\danmaku-stage01-midi-v2-offline.html`。
- 完整包：`E:\GPT工作区\output\danmaku-stage01-midi-v2.zip`，根目录`START.html`可直接双击。
- 单独MIDI包：`E:\GPT工作区\output\danmaku-stage01-midi-v2-midi.zip`，含7份MIDI、乐谱、清单及音色说明。

原`stage01-v1/`的乐谱、22份WAV、原音库，以及`danmaku-stage01-audio-v1`交付均保留。新脚本拒绝覆盖已有生成目录；需要复现时指定新的`--output`目录，确认后才用`--install`更新运行音库。运行游戏不需要Python。

## 实际验证与边界

9项MIDI检查通过：7份真实SMF往返事件／哈希、速度与配器、运行6份MIDI字节一致、16种音效不变、损坏输入拒绝、循环／跳转／分层时钟、32声部上限、停止取消与节点断开，以及提前调度时短音符仍可被暂停取消。原14项声音生命周期检查通过；旧22份WAV及音效来源检查仍通过。

最终独立Chrome自然运行9621逻辑步通关，2枚大招、2个B、16点P、最高Ⅲ档；实际浏览器回放与JS／PHP全部快照一致。MIDI共排程4870个音符，观察峰值17声部，无迟到丢弃／抢占／丢音，6份SMF均解析。整关各阶段、终局一次性收尾、暂停恢复、静音、失焦和试听取消通过；HTTP请求0、JS／音频异常0、主运行追帧保护暂停0。测试包含后台自动暂停和评审截图前主动暂停，不等于全程未暂停；自动输入不是真人通关。此前9597步成功记录保留在`previous-pass/`，最终结论以本次停止与短音符清理修复后的结果为准。

最终增益下同款合成器全音乐音量渲染：小怪段峰值0.56785／RMS0.07253；Boss峰值0.54390／RMS0.07828；Boss循环边界4秒片段峰值0.48110。Boss叠加6个高优先级音效的压力混音峰值0.54390，均未削波。上述为所测片段数字检查，不是整曲主观听感验收。最终修复后，独立全新Chrome不先试听直接开始，第24步完成16份音效加载及6份SMF解析，运行至第327步无暂停／异常，音乐偏移正确。

1280×900与360×800交互、集中判定点与大招等既有表现回归通过，旧HTTP入口也能加载新增MIDI脚本。37份JS、12份PHP、22份JSON与10份Python语法通过；单文件15个脚本／6张PNG及MIDI／音效内嵌与源码一致，17份MIDI生成文件在新目录逐字节复现。规则仍为`danmaku-stage01-r2`；规则、JS／PHP模拟和回放10文件及全部美术资源与音频v1逐字节相同。PHP未改，未重跑或扩大历史474.91ms合法长局预算结论。报告和实际回放在忽略目录`tmp/danmaku/stage01-midi-v2/`，不进入交付。

真人听感、实际扬声器／耳机、真实手机硬件仍待用户测试。本轮只修改BGM，页面UI整体优化待新音乐方向确认后再继续；不扩关、不接平台、不公开发布。

```powershell
node tests/danmaku/test-midi.cjs
node tests/danmaku/test-audio.cjs
python tests/danmaku/check_stage01_audio.py
node tests/danmaku/browser-stage01.cjs --midi
node tests/danmaku/browser-stage01.cjs --midi --cold-audio
node tests/danmaku/check-export-stage01.cjs '回放绝对路径.json'
node tests/danmaku/browser-focus.cjs --ui-only --out=tmp/danmaku/stage01-midi-v2/legacy-http
python tests/danmaku/package_preview.py --check
```
