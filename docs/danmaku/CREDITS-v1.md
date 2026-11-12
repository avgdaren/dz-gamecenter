# 第一关素材与音乐来源

2026-11-12，小典 / Codex整理。主人已明确允许本次源码、图像和音乐提交到现有公开GitHub仓库作交接；保留以下作者与来源说明。原工作区保留`PLAYTEST-BASELINE-v1.json`和`PLAYTEST-BASELINE-r3.json`；离线包逐文件清单为包根目录`DELIVERY-MANIFEST.json`。下表链接指向原项目制作记录，精简包不重复历史制作目录。

| 内容 | 来源与署名 | 制作记录 |
|---|---|---|
| 游戏中心原型与保留的原始代码 | `(C) 2026 Carinoasd` | 仓库AGENTS与原文件头 |
| 单关玩法、原生JS／PHP模拟、界面、演出与素材接入 | 小典 / Codex；方向与验收由avg达人提供 | 各阶段实现记录及源码头部 |
| 少女自机、动作图集与场外正面图 | 内置imagegen生成，按用户确认方向制作；小典整理原生素材 | [自机制作](PLAYER-ART-PRODUCTION-v1.md)与[接入](PLAYER-INTEGRATION-r2.md) |
| 回廊／观测台背景、巡星妖精、引光侍从、星仪守卫 | 内置imagegen生成；小典整理与接入 | [场景与小怪](STAGE-01-ART-PRODUCTION-v1.md) |
| 星环观测者旧主体、头像、战斗主体与前后星仪 | 内置imagegen生成；沿用已确认旧稿，小典整理与接入 | [形象与规格](BOSS-BATTLE-DESIGN-v1.md)、[素材制作](STAGE-01-BOSS-ART-v1.md) |
| 道中《ヘクサフュージョン》 | avg达人提供，用户说明由HappyShrimp配合提示词工程作曲；运行使用开头72秒整理版 | [成品BGM接入](STAGE-01-HAPPYSHRIMP-v1.md)与`audio/stage01-happyshrimp-v1/manifest.json` |
| Boss《残响》 | avg达人提供，同上；从Boss登场连续播放，曲尾交叉淡化循环 | 同上；具体生成提示词未提供，不补写推测版本 |
| 16种战斗／菜单音效 | 小典编写合成与音频整理脚本，无外部采样曲库 | [音频v1](STAGE-01-AUDIO-v1.md)及`audio/stage01-v1/` |
| 当前通关／失败短曲 | 保留MIDI v3运行短曲；两首主BGM使用上述用户成品 | [MIDI v3](STAGE-01-MIDI-v3.md)及`audio/stage01-midi-v3/` |

生成源图、实际图像提示词、原生整理脚本与生产清单留在工作区。原始两首MP3保留在`E:\GPT工作区`根目录；运行音频是独立整理副本。旧MIDI／音频版本和历史交付保留，不把已替换的旧BGM列为当前主BGM。

Boss原16帧图集保留，旧主立绘原样用于登场。演出v1使用稳定第0帧与轻倾；[r3修正版](BOSS-FIX-r3.md)进一步将同一原图作为网格纹理，增加发梢、袖口和裙摆局部动态，原大幅移动循环不再播放。图片和音乐文件没有重新生成或改写。
