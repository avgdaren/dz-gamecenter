# v2.0 美术资源侧收尾记录

作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。2026-11-08。Refs #72 / Draft PR #73。

**资源制作、运行导出与接入资料已收尾，交由小蓝进行实际游戏接入。**

## 当前交付

| 范围 | 交付内容 |
| --- | --- |
| 三种生物 | 青芽海龟、绮霞古比、珊澜蝶鱼的已选静态母图 |
| 游动美术 | 各四帧，共十二帧；256×256 单帧、横向 4×1 图集、循环预览 |
| 生物运行资源 | 各一张 512 主图、256 手机版、128 图鉴图标、128 剪影及游动 WebP，共 15 个文件 |
| 布景运行资源 | 14 件主图与 128 缩略图，共 28 个文件；普通主图 512，横向建筑 1024×512 |
| 背景运行资源 | 萤光秘境已有桌面、手机与缩略图原样复用，共 3 个文件 |
| 布置与接入资料 | 四组预设、资源映射、可见范围、锚点、建议显示比例、复制路径与待定规则表 |

合计 **46 个 WebP，2,124,634 字节**。原图保持不变；建议体积目标无超出项。

## 统一取用入口

- [运行美术交付说明](../art/v2-release-selection/runtime/v1/README.md)
- [运行美术目录](../art/v2-release-selection/runtime/v1/preview.html)
- [资源文件清单](../art/v2-release-selection/runtime/v1/manifest.json)
- [接入映射](../art/v2-release-selection/runtime/v1/runtime-map.json)
- [复制映射](../art/v2-release-selection/runtime/v1/COPY-MAP.md)
- [四组预设](../art/v2-release-selection/runtime/v1/presets.json)
- [待定规则表](../art/v2-release-selection/runtime/v1/pending-rules.json)

生物 anchor=(0.5,0.5)，朝右；布景 anchor=(0.5,0.9)，等比例接地。可见像素范围同时提供像素与归一化坐标。建议显示比例是接入初值，不代表游戏内显示已经确认。

## 小蓝侧仍需完成

1. 确定实际运行 fish_id，把 art_id 映射到正式鱼种配置；资源文件名不必跟随中文名改动。
2. 复制资源、合并美术清单与游动清单，接入图鉴、手机资源、背景、布景和四组预设。
3. 正式确定三种生物的水域、门槛、概率、收益、限量与可售资格，以及主题价格与套装规则。当前未定值集中为 null，不能从旧报价或旧生物复制成已批准值。
4. 在游戏实际缸体中确认尺寸、层位、遮挡、播放节奏和保存衔接；小典按具体显示问题配合修正资源。

## 本次检查与边界

只针对新增导出完成解码、尺寸、alpha、文件引用和新图集/图标查看；没有重做原图选稿或整套美术评审，没有浏览器/实机验收。没有修改游戏代码、活跃资源目录、捕获/商品配置、存档、正式玩家数据或版本号，不需要数据库升级。

可复现导出工具为 `tools/export_aquarium_v2_art.py`，使用显式 `--out` 和 `--ffmpeg`，拒绝覆盖已有目录及写入游戏活跃 assets 路径；没有本机路径 fallback。后续若重跑请选择新的空目录，不覆盖这份交付。

示例（仓库根目录；替换实际 Python/FFmpeg 路径）：

```text
<python> tools/export_aquarium_v2_art.py --out <new-empty-output-directory> --ffmpeg <ffmpeg-executable>
```
