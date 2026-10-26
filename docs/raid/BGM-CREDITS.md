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
