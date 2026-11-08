# 天使水族馆：下版美术资源选用包

作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。2026-11-08。

本包将本轮选定的美术集中到一个入口：**3 种生物、1 张萤光秘境背景、14 件布景素材，共 18 张静态 PNG 母图；另附四组预设、三种生物共 12 帧游动美术及 46 个 WebP 运行文件。** 资源侧制作、导出和接入资料已收尾，游戏内登记与实现交小蓝推进。旧候选留在原目录，不混入当前母图目录。

生物名称与选用稿：青芽海龟、绮霞古比、珊澜蝶鱼。古比采用已认可的杏金/霞粉大扇尾版本；蝶鱼采用已认可的暖白/珊瑚橙、眼后青色弧纹与暖色花斑版本。

## 查看与交接

- [本地美术目录](index.html)：双击打开可查看原图，透明图以页面格纹底显示；不是游戏效果验收。
- [机器清单](manifest.json)：当前名称、文件、来源与未完成项。
- [运行资源交付](runtime/v1/README.md) / [运行目录](runtime/v1/preview.html)：46 个 WebP、图标/剪影、尺寸与锚点、映射及复制路径。
- [接入交接](HANDOFF.md)：游戏接入范围与待定业务规则。
- [三种生物游动循环](motion/v1/preview.html)：包含原始动作稿、256×256 单帧、横向 WebP/PNG 图集及 APNG/GIF 预览。
- [四组预设](PRESETS.md) / [分组数据](presets.json)：林泉小居、苔轮溪桥、林间歇脚、萤石静庭。
- `exports/background/`：仅附已有背景 WebP、手机版与缩略图，未进行本轮重新导出。
- `provenance/`：原场景清单与生成提示词，历史名称按原文保留。

## 选用原图目录

| 类别 | 名称 | 选用原图 |
| --- | --- | --- |
| 生物 | 青芽海龟 | [PNG](masters/creatures/qingya-turtle-v01.png) |
| 生物 | 绮霞古比 | [PNG](masters/creatures/qixia-guppy-v01.png) |
| 生物 | 珊澜蝶鱼 | [PNG](masters/creatures/shanlan-butterfly-v03.png) |
| 背景 | 萤光秘境 | [PNG](masters/backgrounds/tank_firefly_grove-v01.png) |
| 建筑 | 萤根小筑 | [PNG](masters/decor/building_glowroot_cottage-v01.png) |
| 建筑 | 苔轮水坊 | [PNG](masters/decor/building_mosswheel_mill-v01.png) |
| 景观 | 苔石拱桥 | [PNG](masters/decor/building_mossstone_bridge-v01.png) |
| 景观 | 古根门庭 | [PNG](masters/decor/building_root_archway-v01.png) |
| 景观 | 萤籽引路柱 | [PNG](masters/decor/building_glowseed_beacon-v01.png) |
| 植物 | 林泉蕨丛 | [PNG](masters/decor/plant_spring_fern-v01.png) |
| 植物 | 铃花小簇 | [PNG](masters/decor/plant_lavender_bells-v01.png) |
| 植物 | 碧带水草 | [PNG](masters/decor/plant_fineleaf_ribbon-v01.png) |
| 地面装饰 | 曲苔石径 | [PNG](masters/decor/scape_moss_step_path-v01.png) |
| 地面装饰 | 青苔叠石 | [PNG](masters/decor/scape_riverstone_cluster-v01.png) |
| 摆件 | 蜜晶石簇 | [PNG](masters/decor/trinket_honeyquartz_cluster-v01.png) |
| 摆件 | 萤籽地灯 | [PNG](masters/decor/trinket_glowseed_lantern-v02.png) |
| 摆件 | 根木长凳 | [PNG](masters/decor/trinket_rootwood_bench-v01.png) |
| 摆件 | 叶形路牌 | [PNG](masters/decor/trinket_leafway_sign-v01.png) |

## 当前边界

这是美术交接包。三种生物的主图、手机版、图鉴图标、剪影与游动图集，以及14件布景主图/缩略图和背景三份导出已齐。实际运行 fish_id、捕获/商品规则、游戏登记与界面接入尚未完成。当前 14 件是目录数量，四组预设每组 5–6 件，每层最多 3 件。

静态选用稿原样保留。动作姿态由内置 image_gen 生成；运行导出使用 FFmpeg 作机械裁边、等比例整理、锚点对齐、缩略图/剪影和编码，没有程序重绘或扭曲角色。新增导出已确认解码、尺寸、alpha与引用，未重跑原有美术选稿或整套评审，未改游戏代码、活跃资源目录、配置、数据库或正式玩家数据。此前售卖系统仍是独立功能规划，本资源包不含交易逻辑。
