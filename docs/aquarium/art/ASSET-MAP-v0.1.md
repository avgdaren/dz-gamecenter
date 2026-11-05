# 天使水族馆 D1：稳定ID与素材映射 v0.1

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。Refs #29。中文名/造型待审，ID沿用v0.2企划；这是目标路径清单，不表示素材已经制作。运行根目录为 `source/plugin/gamecenter/games/aquarium/assets/`；不要按文件遍历决定图鉴或抽签顺序。

## 鱼（12）

| 图鉴序号 | fish_id | 中文名 | 品级 | 文件 |
|---:|---|---|---|---|
| 01 | pond_blue | 晴蓝鱼 | 常见 | fish/pond_blue.webp |
| 02 | pond_orange_tail | 橘尾鱼 | 常见 | fish/pond_orange_tail.webp |
| 03 | pond_leaf | 叶纹鱼 | 少见 | fish/pond_leaf.webp |
| 04 | pond_peach | 桃心鱼 | 少见 | fish/pond_peach.webp |
| 05 | pond_glass_moon | 玻璃月鱼 | 稀有 | fish/pond_glass_moon.webp |
| 06 | pond_feather | 羽鳍鱼 | 珍奇 | fish/pond_feather.webp |
| 07 | bay_silver | 银沙鱼 | 常见 | fish/bay_silver.webp |
| 08 | bay_coral | 珊瑚鱼 | 常见 | fish/bay_coral.webp |
| 09 | bay_lantern | 灯笼鱼 | 少见 | fish/bay_lantern.webp |
| 10 | bay_ribbon | 丝带鱼 | 少见 | fish/bay_ribbon.webp |
| 11 | bay_star_ray | 星斑鳐 | 稀有 | fish/bay_star_ray.webp |
| 12 | bay_aurora | 极光天使鱼 | 珍奇 | fish/bay_aurora.webp |

图鉴序号固定展示顺序，与ASCII抽签顺序分开。每鱼缩略图为 `thumbs/fish/<fish_id>.webp`。

## 装饰（24）

| 目录号 | decor_id | 中文名 | 分类 | 适配层 | 文件 |
|---:|---|---|---|---|---|
| 01 | plant_meadow | 晴光水草 | 水草 | back/front | decor/plant_meadow.webp |
| 02 | plant_lily | 睡莲小丛 | 水草 | front | decor/plant_lily.webp |
| 03 | plant_ribbon | 飘带长叶 | 水草 | back | decor/plant_ribbon.webp |
| 04 | plant_crimson | 绯叶水草 | 水草 | back/front | decor/plant_crimson.webp |
| 05 | plant_fern | 羽叶水蕨 | 水草 | back | decor/plant_fern.webp |
| 06 | plant_tide | 星潮海藻 | 水草 | back | decor/plant_tide.webp |
| 07 | scape_pebbles | 圆润卵石 | 石景 | front | decor/scape_pebbles.webp |
| 08 | scape_layers | 晴灰层岩 | 石景 | back/front | decor/scape_layers.webp |
| 09 | scape_moss | 苔绿山石 | 石景 | back | decor/scape_moss.webp |
| 10 | scape_wood | 花枝沉木 | 石景 | back | decor/scape_wood.webp |
| 11 | scape_cave | 静谧岩洞 | 石景 | back | decor/scape_cave.webp |
| 12 | scape_coral | 绮色珊瑚 | 石景 | back/front | decor/scape_coral.webp |
| 13 | building_bridge | 翼纹小桥 | 建筑 | back | decor/building_bridge.webp |
| 14 | building_pavilion | 潮音凉亭 | 建筑 | back | decor/building_pavilion.webp |
| 15 | building_moon_gate | 月庭圆门 | 建筑 | back | decor/building_moon_gate.webp |
| 16 | building_ruin_arch | 星痕拱门 | 建筑 | back | decor/building_ruin_arch.webp |
| 17 | building_columns | 沉眠列柱 | 建筑 | back | decor/building_columns.webp |
| 18 | building_angel_gate | 天使庭门 | 建筑 | back | decor/building_angel_gate.webp |
| 19 | trinket_shell | 珍光贝壳 | 摆件 | front | decor/trinket_shell.webp |
| 20 | trinket_pearl | 月露珍珠台 | 摆件 | front | decor/trinket_pearl.webp |
| 21 | trinket_star_lamp | 星辉提灯 | 摆件 | back/front | decor/trinket_star_lamp.webp |
| 22 | trinket_crescent | 弯月小景 | 摆件 | front | decor/trinket_crescent.webp |
| 23 | trinket_crystal | 星晶花簇 | 摆件 | front | decor/trinket_crystal.webp |
| 24 | trinket_wings | 羽翼纪念像 | 摆件 | front | decor/trinket_wings.webp |

每件缩略图为 `thumbs/decor/<decor_id>.webp`。主题/层/目标尺寸/锚点详见机器表；价格和购买条件仍以原装饰清单及未来服务端正式配置为准，不在美术映射重复定义。

## 背景与水域缩略图

| ID | 中文名 | 桌面/默认文件 | 手机文件 |
|---|---|---|---|
| tank_day | 日光鱼缸 | background/tank_day.webp | background/tank_day_mobile.webp |
| tank_moon | 月光鱼缸 | background/tank_moon.webp | background/tank_moon_mobile.webp |
| pond | 晴光池塘（钓点） | water/pond.webp | 共用缩略图 |
| bay | 星潮浅湾（钓点） | water/bay.webp | 共用缩略图 |

12鱼+24装饰+2背景=38个核心画面，另有2水域缩略图、36个缩略导出与界面图标；不是仅36次文件导出。手机背景是同场景适配，非额外可购买主题。
