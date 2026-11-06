# 萤光秘境导出候选验收（2026-11-05）

作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。Issue #68 / Draft PR #69。

结论：11 张 WebP 的文件验收和离线深浅底目视检查通过，可以继续评审与本地接入准备。四栋建筑仍待主人美术确认；本页不代表游戏内、浏览器或商店验收通过。

## 通过

| 检查 | 结果与证据 |
| --- | --- |
| 母图不变 | 清单内 6 张 PNG 的 SHA256 均一致。认可背景仍为 `3a03ea65936631d580dcbc651f1d8ca6b28a49ccf5e1d7141dc780f4cff51222`。未重画、未覆盖。 |
| 11 张候选文件 | 5 件、11 张 WebP，合计 **494,500 字节**。解码、尺寸、模式、alpha、alpha≥16 主体包围盒、字节数、SHA256 与 [导出清单](runtime-candidate/manifest.json) 一致。无缸框文件。 |
| 独立重跑 | 从当前仓库母图导出至仓库外新空目录，11 张 WebP **逐字节一致**，解析后的完整清单也相同。重跑目录为工作区 `output/aquarium-firefly-qc-20261105/rerun`。 |
| 透明彩条 | 所有 alpha=0 像素在 `#f7f5ed` 浅底和 `#183b53` 深底合成后，均与底色逐像素相同。合成目视未见横向彩条，未见明显霓虹彩边或主体裁断。[1:1 主图对照](qc/edges-light-dark.png)。 |
| 脚点 | 四主图均为 `(0.5,0.9)`。alpha≥16 主体底边为 y=461，理论脚点 y=460.8，误差 **+0.2px**，小于 1px。主体未触画布边缘。对照图的横线和短竖线是验脚点辅助线。 |
| 缩略图 | 四张均为真实 128×128 透明 WebP；[128/64 对照](qc/thumbs-128-64.png) 中轮廓可辨。64px 下小屋、船馆的门窗细节减少，界面仍应配名称，未宣称所有细节可读。 |
| 背景三级尺寸 | 1536×960、768×480、240×150，均为 16:10、全不透明；[尺寸对照](qc/background-sizes.png) 目视构图未见明显问题。 |
| 预览资源与离线模型 | 场景读取导出主图，窄屏候选通过 srcset 引用手机背景；卡片默认读取真实 128px 缩略图。嵌入三份 JSON 与文件一致；本地链接、JS 语法、32 种持有组合报价、背景/缩略/显隐控件和 360/880/1144 宽度下的几何约束通过。**这是 DOM 模型，不是浏览器。** |
| 定价研究复算 | [研究 JSON](pricing-study.json) 独立重算哈希一致：32 种模拟持有组合、209 项报价算术断言通过。不是实际商店测试。 |
| 导出器边界 | 已删除本机 E 盘 fallback，只按脚本所在仓库解析母图；拒绝非空输出目录、插件运行目录与脱离仓库的复制脚本，未覆盖原图或运行资源。 |

机器可读明细见 [asset-check.json](qc/asset-check.json)。导出工具为 FFmpeg 7.1（Format Factory Revision），Pillow 7.0.0 负责读取与验收合成；没有进行逐像素去色污染或补画。

## 失败、限制与未验证

- **浏览器验证受阻**：本轮尝试通过内置浏览器打开本地预览，安全策略拒绝 `file:` 协议（仅允许 http/https）。没有换协议、换浏览器或绕过策略；因此浏览器加载、响应式实际排版、控件实际点击与浏览器 alpha 合成都**未验证**。静态合成不能替代浏览器。
- 文件与合成检查没有发现必须退回的失败项；这不等于任何背景下均无细微半透明色边。原始抗锯齿/轮廓色保留，尚未进行颜色去污染。
- 四建筑美术最终认可、跨层遮挡/鱼群避让、运行时调色、混搭保存、真实所有权、解锁条件、单买与套装事务、并发/重复购买/退款链路均**未验证或未实施**。
- 没有部署论坛，没有读取真实玩家库存，没有修改正式玩家数据。按主人要求未做真实线上场景。新生物本轮未制作，缸框/底座仍暂缓。
- 远端于本轮只读核对为 `feat/aquarium-release-1@3bbdff2b4f7356aa5a115bb14624fe45923671d4`（1.2.3）；本分支制作基线仍为 `606e505`（1.2.2），未合并升级。接入前须按 1.2.3 复核，不依赖已删除的 `aquarium_scenery.php`。

## 复现

需要带 Pillow 的 Python 与支持 libwebp 的 FFmpeg；两者路径显式传入。以下命令在仓库根目录执行，`<...>` 替换为绝对路径；重跑目录必须全新或为空。

```text
<python> tools/export_aquarium_firefly.py --ffmpeg <ffmpeg> --out <new-empty-rerun-folder>
<python> tests/aquarium/firefly_export_check.py --rerun <new-empty-rerun-folder> --evidence <qc-output-folder>
<python> tools/aquarium_theme_pricing.py --proposal <absolute-commerce-proposal.json> --out <absolute-pricing-rerun.json>
<python> tools/sync_aquarium_firefly_preview.py
node tests/aquarium/firefly_preview_check.mjs
```

`firefly_export_check.py` 只读候选与母图，写验收合成和报告。`asset-check.json` 的 PASS 只涵盖声明的文件/像素范围；人工目视结论与未验边界以本页为准。
