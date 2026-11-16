# 第二关统一画风动作源图 v1

2026-11-15，小典 / Codex；原型 `(C) 2026 Carinoasd`。

使用内置 **image_gen**，不是CLI／API后备。每份同时引用 [已确认的本关标准姿态](../stage02-unity-v1/PROMPTS.md) 和第一关同类实际运行图集；本关标准姿态负责身份，第一关负责画法与比例。完整实际提示词和两张参考路径在 [generation-prompts.json](generation-prompts.json)，PNG尺寸、透明与SHA在 [source-audit.json](source-audit.json)。

项目素材路径：

- `E:\GPT工作区\dz-gamecenter-handoff\docs\danmaku\art\stage02-unity-actions-v1\garden-fairy-actions-v1.png`
- `E:\GPT工作区\dz-gamecenter-handoff\docs\danmaku\art\stage02-unity-actions-v1\bell-attendant-actions-v1.png`
- `E:\GPT工作区\dz-gamecenter-handoff\docs\danmaku\art\stage02-unity-actions-v1\lingyu-actions-v1.png`

三张均为透明2×2源图：左上中性、右上向左、左下向右、右下施法。本次运行待机继续使用上一轮已确认的原缓存，使用新图后三个动作。没有拿新中性帧悄悄替换已确认待机。

原PNG直接从工具目录逐字节复制，未重存、未用Python修图。工具原输出：

| 项目文件 | `C:\Users\ASUS\.codex\generated_images\01a1d7f9-c165-7ca0-8a7f-5c4d558800f3\` 下原文件 |
|---|---|
| garden-fairy-actions-v1.png | exec-f6debd2c-90f9-4c89-abcb-94f0805c6aab.png |
| bell-attendant-actions-v1.png | exec-1c234730-f081-4ac4-86cc-ffcc8becd2c0.png |
| lingyu-actions-v1.png | exec-78300497-7cb9-474b-a964-6f259301d9bc.png |

运行时Canvas按四格透明区域取边界、登记身体支点，缩小成48×48／48×64／96×128帧，以同一32色候选表和alpha阈值192缓存。妖精源图1261×1247为奇数尺寸，按等分区域采样透明留白，不裁写或修正源PNG。实际新帧可见高度35–36／48／101px、20–25色，没有网格拉伸；四姿态实际对照在试玩页下方。

这是已确认方向上的动作扩展候选，不是用户对本轮动作或整关观感的后续验收。详见 [制作记录](../../STAGE-02-REFINED-v1.md)。
