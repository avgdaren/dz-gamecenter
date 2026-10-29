# 鱼鳍叠图修正 · 完整单层游动帧

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。日期：2026-10-30。关联 Issue #42。

## 问题与交付

用户提供的小蓝说明写明：身体绘制完整原图，再叠一层同图裁出的尾段旋转。这会保留底图的旧尾巴，产生双尾、重影和不透明区域变深。当前远端 PR #39 的 eea97d9 仍是单图样稿，没有这段本地叠尾代码；本 PR 交付可替换的完整帧和播放器，不声称已修改用户实站。

交付 12 种鱼 × 12 个完整透明帧，共 144 帧，沿用全部稳定 ID。每种一张 1024×768 无损 WebP，4 列×3 行，每格 256×256，原点相同、锚点 [0.5, 0.5]。主素材不触边，头部锁定区在所有帧内 RGBA 像素一致，面孔不随帧变形。帧 0 为中立帧，帧 6 也经过中立姿态；循环不重复存储末帧。

**制作方式为原画的连续逆向采样变形，不是手绘逐帧或重新生成的新鱼。** 每个输出像素只从原图的一处取样，尾部与少量上下鳍平滑变形；不切出第二条尾巴，不覆盖完整鱼图。12 张源 PNG 已逐项匹配现有美术 manifest 的 source_sha256。原画、原 512px WebP、图鉴缩略图和旧 manifest 不修改。

## 文件

- `source/plugin/gamecenter/games/aquarium/assets/fish-motion/v1/`：12 张无损 WebP 与独立 manifest。
- `source/plugin/gamecenter/games/aquarium/fish-sprites.js`：可直接接入的完整帧播放器，无新增运行依赖。
- `source/plugin/gamecenter/games/aquarium/fish-warp.js`：制作与验证使用的纯变形函数，播放器不依赖它。
- `tools/render_aquarium_fish_frames.py`、`.mjs`：可复现导出，离线需要 Pillow 和 Node，不添加 npm 项目依赖。
- 本目录 `preview.html`：12 种鱼，暂停、逐帧、左右方向检查。完整解压后可直接打开，也可由测试站访问。
- 本目录 `pond-preview.gif`：当前六种池塘鱼的快速动态预览。GIF 为有损调色板预览，实际资源为透明无损 WebP；GIF 统一节奏不代表各鱼最终周期。
- 本目录 `frame-proof.png`：12 种鱼的中立／上摆／下摆对照。

## 小蓝接入：替换旧美术容器

先加载 `fish-sprites.js`（复用站点现有原生脚本加载方式，不新增 SDK 字段或 CDN）。将它挂到**同时包含旧身体图和旧尾巴层的专用美术容器**。不要挂在仅包含身体的子节点上，也不要把新帧再放到完整鱼图上面。

```js
// entry 来自 assets/fish-motion/v1/manifest.json；ID 仍与图鉴一致。
// artHost 只装鱼的美术；鱼名、点击热区和游动位置留在外层。
const player = AquariumFishSprites.mount(artHost, {
  sheetUrl: assetBase + 'fish-motion/v1/' + entry.file,
  fallbackUrl: assetBase + 'fish/' + entry.id + '.webp',
  size: entry.frame_size[0],
  columns: entry.grid[0],
  frames: entry.frame_count,
  cycleMs: entry.cycle_ms,
  onError: () => { /* 单张静态图回退，不影响游戏、购买或存档 */ }
});
record.sprite = player;
// 收起动画完成、清空鱼缸或卸载游戏时：
record.sprite.dispose();
```

1. `mount` 会先销毁同容器旧播放器、清空旧 body/tail 子节点，再只保留一个 Canvas；每次换帧先 clearRect，再 drawImage 一张完整帧，不做帧间交叉淡入，不叠多张图。
2. 必须一并移除旧尾巴克隆元素、相应动画样式，以及每帧访问旧 tail 元素的更新代码。原 `.fin` 入场／收起包裹动画可以保留，位置和转身仍由外层管理；不要整缸重建。
3. 这 12 张核对后的原画全部头朝右，sprite 也统一朝右。向右游 scaleX(1)，向左游 scaleX(-1)，翻转整条鱼；移除“只有晴蓝鱼朝左”的特例。不要外层翻一次、内部再翻一次。
4. Canvas 使用固定 256px 内部分辨率，CSS 随鱼尺寸缩放；适合当前约 100～170px 展示。若后续做大尺寸特写，重新导出高分辨率素材，不强行放大这套 atlas。
5. 播放器共用一个 rAF，只在实际帧号变化时绘制；物种周期 540～1200ms，初相随机，避免全体同步。不要在自己的每帧循环里重新 mount。
6. 页面隐藏暂停；减少动态效果时显示中立帧；恢复时按设置继续。收起或切走调用 dispose，清理已卸载鱼的引用。所有播放器销毁后可调用 clearCache 释放本模块 atlas 引用。
7. 资源尺寸错误或加载失败时，只保留原单张鱼图。用原 manifest／catalog 权威数据判断已发现资格；本模块不参与拥有、容量、购买、金币、存档或布局排序。

## 体积与边界

12 张运行 atlas 总 2,583,626 bytes。每张解码 RGBA 约 3 MiB，12 张合计约 36 MiB，不含浏览器/GPU额外开销。因此按实际展示鱼种懒加载，不为未展示鱼预载所有 atlas；图鉴继续使用现有缩略图。

本批不改 game.js、小蓝的 UI／游动路线分支、服务器接口、存档或数据库，插件仍 1.4.0。Draft PR 供合成与接入，未部署。

## 验证

`node tests/aquarium/fish_sprite_test.cjs`：610 项 PASS，Node VM + 测试环境已有原生 Canvas 2D。覆盖 12 atlas 解码、144 帧头部锁定、逆采样列方向单调（无折叠／重复尾段）、每帧清屏并精确绘制完整帧、旧 body/tail 两层清除、共用调度器、隐藏／减少动态、重复挂载、加载失败单图回退、卸载后不复活。

另验全部图集尺寸／哈希／alpha边界、导出脚本与 JS／JSON 语法、预览资源路径，并人工检查 12 鱼三相位对照。细项见 QA.json。

**未验证**：真实浏览器与实站集成、低端机/GPU内存、12 鱼满缸长期运行、旧尾巴实际样式完全移除、现有游动状态和声音联动。本机无可用 Chromium，原生 Canvas 检查不能写成浏览器验收通过。

复现导出（原 PNG 已在仓库对应 docs/aquarium/art/ 路径，也可以指向完整原画目录）：

```sh
python3 tools/render_aquarium_fish_frames.py --masters docs/aquarium/art
node tests/aquarium/fish_sprite_test.cjs
```

测试使用制作环境已有 `@napi-rs/canvas`，可通过 CODEX_PRIMARY_RUNTIME_NODE_MODULES 指向现有测试依赖；它不随插件加载，不新增 package.json 或线上依赖。
