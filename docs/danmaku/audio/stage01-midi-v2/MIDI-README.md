# 天使弹幕祭 · 电子乐 MIDI v2

原创作曲、编曲及音色：小典 / Codex，2026-11-11；原型 `(C) 2026 Carinoasd`。按avg达人要求制作，本地私用，未公开发布。没有引用现成歌曲、MIDI或采样。

两首主题偏西洋旋律电子／硬派Trance：150 BPM小怪曲《霓光回廊》（72秒），168 BPM Boss曲《星仪超频》（约40秒循环）。强底鼓、切分贝斯、锯齿主奏、十六分琶音与军鼓推进。

- `stage.mid`：完整小怪曲，45小节。
- `boss.mid`：完整Boss曲，28小节。
- `bossCore.mid`、`bossDrive.mid`：游戏内同步播放的两层；完整曲已合并两层，不需要再额外叠加。
- `intro.mid`：3秒《引燃》，Boss登场。
- `clear.mid`：约4秒《冲破天际》，通关。
- `defeat.mid`：2.4秒《重启》，失败。
- `score.json`：原始曲式、和弦、动机、音色及节奏。
- `manifest.json`：每份文件的速度、长度、音符数、SHA256。

文件是真正的SMF Type 1，多轨、PPQ480、4/4拍，可导入支持标准MIDI的编辑器。GM程序从1计数：40 Synth Bass 2、81 Lead 1 Square、82 Lead 2 Sawtooth、91 Pad 3 Polysynth；第10通道为鼓组。代码从0计数对应39／80／81／90。

游戏直接读取这些MIDI事件，并用内置Web Audio电子合成器发声；不请求MIDI硬件权限。外部播放器使用自身GM音源，因此音色可能与游戏不同。完整包另有游戏同款合成器渲染的16秒试听WAV，试听文件与实际演奏MIDI分开保存。168 BPM的整数微秒速度使Boss循环实际为40.000016秒，两层速度完全一致。
