# 吃食音效 v4：短促、柔和的“咻”

作者 GPT / Codex；原插件 (C) 2026 Carinoasd。仅私有项目使用。

用户裁决：上一轮A/B/C全部不好，太硬。**三组都未被选中，不要把A组视为默认通过。** 本轮按用户要求试短促的“咻”，用气流和滑音重新合成，取消敲击、咬合冲击和硬起音。

| 编号 | 方向 | 内容长度 |
| --- | --- | --- |
| 咻01 `whoosh_01` | 轻气流 | 92ms |
| 咻02 `whoosh_02` | 柔滑音 | 108ms |
| 咻03 `whoosh_03` | 轻上扬 | 82ms |
| 咻04 `whoosh_04` | 圆润下滑 | 118ms |

4个WAV母版和8个MP3/OGG导出齐全；单声道44.1kHz，母版峰值-10dBFS，14ms平滑起音和25ms收尾。峰值降低是辅助，主要变化为连续气流频带扫动，不含旧版本的冲击层。程序合成的不同随机种子可复现。音色是否合适仍需用户试听，不以信号检查替代主观验收。

- [在线试听](https://angel-aquarium-sound-audition.woollyrat17.chatgpt.site)（用户本人私有入口，小蓝可用下列仓库离线页）。
- `preview.html` / `aquarium-sound-offline.html` 都内嵌4段MP3，无外链、无服务器依赖；下载后用浏览器打开。可单次或连听三次，换段/停止/切后台会取消剩余播放。
- `set-preview.mp3` 是按01→04、每段三次的顺序对比，间隔留白，无BGM。
- `masters/*.wav` 是母版；运行候选在 `source/plugin/gamecenter/games/aquarium/assets/feeding/whoosh-v4/`。
- `QA.json` / 运行manifest记录母版与实际编码解码的时长、峰值、RMS、削波数和SHA256。部分OGG有编码尾部填充，不把容器时长误记为发声长度。

复现：仓库根执行 `python tools/render_aquarium_whoosh_v4.py` 后执行 `python tools/build_aquarium_whoosh_preview.py`；离线处理机需NumPy、SciPy和ffmpeg。游戏运行不增加任何依赖。

给小蓝：当前仅候选试听，不自动替换现有bite，不增加经济行为；drop/pop/BGM不动。选定后再决定最终轮换组及BGM混音。仍仅在确认消费时触发，140ms间隔，所有喂食声共用最多2并发，忙时跳过不补播；音效开关、后台与静音规则不变。本轮不改game.js，不改用户鱼缸。

已验证：8个编码文件实际解码正常、无削波；4个WAV首尾归零，母版82–118ms；全部JSON有效，制作源码及页面JS语法通过。未验证：当前环境无法启动浏览器，实际浏览器播放、扬声器/耳机听感、手机音频回退及BGM混听待用户/小蓝确认。无数据库升级，不合并、不部署论坛。
