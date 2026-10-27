# 幽月战斗 BGM · 来源与处理

作者：GPT / Codex；核对日期2026-10-27。原插件版权 (C) 2026 Carinoasd。音乐版权/授权独立于插件代码。

- 曲名：Boss Battle #9 [Metal]。
- 作者：nene。
- 作者发布页：https://opengameart.org/content/boss-battle-9-metal 。页面明确列出作者nene、CC0以及opening/loop两份文件。
- 原始loop文件：https://opengameart.org/sites/default/files/boss_battle_9_metal_loop.wav 。
- 授权：CC0 1.0，https://creativecommons.org/publicdomain/zero/1.0/ 。即使无需署名，仍在本文件和样稿页脚保留作者与曲名。
- 使用范围：P1本机样稿的真实音乐候选，不是原创作曲或JavaScript合成旋律；P2搬入游戏本地assets时同时保留本记录。

原loop为42.477868秒，重复两次形成约84.96秒的循环单位，编码为44.1kHz、64kbit/s MP3。文件位于`tests/raid/prototype/assets/battle.mp3`，**680272字节**（约664KiB，小于800KB）。源WAV不进入仓库；该MP3不从CDN加载。

处理命令（下载的原WAV作为输入）：

```sh
ffmpeg -hide_banner -loglevel error -y -stream_loop 1 -i boss_battle_9_metal_loop.wav -map_metadata -1 -c:a libmp3lame -b:a 64k -ar 44100 battle.mp3
```

MP3 SHA-256：`892ca3de2453a615facdef8ba31bbacb03efdd99c98a1cc9d73e46e611d43365`。

默认关闭、独立记忆、低音量、首次交互后播放，隐藏/终局/同页其他音频播放时暂停。HTMLAudio与Range请求有离线测试；实际循环衔接、音质、设备响度和浏览器自动播放仍需试听。作者提供可循环源片段不等于本项目已经完成压缩后实机无缝验收。

## 二阶段曲目 · 2026-10-27

- 曲名：Boss Battle 10 [Metal]；作者nene。
- 作者发布页：https://opengameart.org/content/boss-battle-10-metal
- 直接下载：https://opengameart.org/sites/default/files/boss_battle_10_metal.wav
- 发布页列明CC0；本轮已打开发布页核对。音乐与原插件授权分别记录，不改原作者Carinoasd署名。
- 源WAV 44.1kHz双声道，42.673605秒。开发阶段以首尾80ms圆形交叉混合减轻循环接缝，实际PCM循环42.593605秒；再使用FFmpeg loudnorm I=-18:TP=-2:LRA=9、96kbit/s MP3/44.1kHz编码。
- 本地文件：source/plugin/gamecenter/games/raid/assets/battle-phase2.mp3；511940字节；MP3报告时长42.631837秒（含编码帧填充）。
- SHA256：ff8bde20ea9c56acb61162764eb721e523cc7ebc196e90fa8e361c77b615f5d6。
- 解码测得均值约-20.9dBFS、峰值-6.5dBFS；这不是人耳音量/音质验收，也不能据此声称无缝音乐乐句。
- 一阶段继续原曲不变；二阶段切到此独立文件。单HTMLAudio元素先暂停、换src并从0播放，避免双曲重叠；BGM默认关闭/与音效开关独立，静音、隐藏与同页其它媒体仲裁沿用。
- 已在HTMLAudio替身验证阶段切换与拒播；真实浏览器的切歌延迟、循环音乐性、手机扬声器与人耳试听仍需小蓝/用户复验。
