# 风铃花庭 · 战斗动作素材 v2

2026-11-14，小典 / Codex；原型 `(C) 2026 Carinoasd`。

工具：内置 `image_gen.imagegen`，透明背景，三次独立生成。输入只使用本项目已有小怪设计与铃羽立绘／战斗图，分别作为身份参考。未使用用户对白截图中的人物。

完整的三条实际提示词见 [generation-prompts.json](generation-prompts.json)。关键要求为保留现有人设、简化轮廓与大色块、减少刺绣和细飘带，提供2×2四姿态、真实透明背景，并按实际战场尺寸检查。

| 文件 | 人物／姿态 | 源图与运行时使用 |
|---|---|---|
| [garden-fairy-actions-v2.png](garden-fairy-actions-v2.png) | 风庭精灵：待机、侧飞、施法、回收 | 原PNG1254×1254；2×2格，每格627；可见人物缓存高度56px |
| [bell-attendant-actions-v2.png](bell-attendant-actions-v2.png) | 司铃风侍：待机、侧移、施法、回收 | 原PNG1254×1254；2×2格，每格627；可见人物缓存高度72px |
| [lingyu-actions-v2.png](lingyu-actions-v2.png) | 铃羽：待机、侧飞、风术、唤铃 | 原PNG1254×1254；2×2格，每格627；可见人物缓存高度128px |

图片从生成目录逐字节复制到本目录，源图没有裁剪、重绘、抠图或重编码。透明度、SHA256与原始尺寸见 [source-audit.json](source-audit.json)。提示词要求1024方图，实际工具返回1254方图，运行时按实际尺寸计算格子。

这些是AI生成的四个关键姿态源图，随后在Canvas里按身体支点对齐、去除格内透明留白、等比例缩入游戏缓存。不是手工逐帧精修的原生低分辨率像素图集，也不把运行时缩小记为源图已经原生56／72／128像素。四姿态接入与视觉验收状态见 [角色与演出候选记录](../../STAGE-02-PERFORMANCE-v2.md)。
