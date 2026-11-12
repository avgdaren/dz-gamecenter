# 天使弹幕祭 · 自机素材制作记录 v1

日期：2026-11-11（北京时间） · 小典 / Codex。

用户已认可[正背面草图](art/player-candidates/player-concept-v1.png)，确认背面战斗朝向、正面展示并明确选择Python整理。本文件记录48×48帧、透明边缘、共用色盘、锚点与循环预览的制作事实。后续已完成本地运行接入与Shift切换，详见[r2接入记录](PLAYER-INTEGRATION-r2.md)；脚本方式已授权，P2未推进。

## 当前已完成

| 文件 | 实际内容与规格 |
|---|---|
| [背面静帧源图](art/player-production-v1/player-back-idle-source-v1.png) | 1234×1274，RGBA，单一背面人物 |
| [正面展示源图](art/player-production-v1/player-front-display-source-v1.png) | 1024×1536，RGBA，同一少女的正面形象 |
| [动作源图](art/player-production-v1/player-motion-atlas-source-v1.png) | 1448×1086，RGBA；4列×3行，每格362×362，共12格 |
| [帧配置](art/player-production-v1/player-motion-v1.js) | 三行依次悬浮、左移、右移，各4帧；预览8帧/秒，显示48×48，判定点位置(24,28) |
| [独立播放预览](art/player-production-v1/preview.html) | 可选择三组动作、暂停；48像素显示、深浅底放大对比、右下角正面展示；窄屏改为纵向排列 |

以上PNG为保留的生成源图。人物生成和早期修正使用内置image_gen；本轮像素整理使用用户明确授权的本地Python脚本，不依赖第三方库。原始文件与[完整提示词](PLAYER-PRODUCTION-PROMPTS-v1.md)保留，原图SHA256没有变化。

### 已导出的原生像素素材

| 文件 | 输出规格 |
|---|---|
| [动作图集](art/player-production-v1/native-v1/player-motion-v1.png) | 192×144，4列×3行，12张48×48帧 |
| [逐帧文件](art/player-production-v1/native-v1/frames/idle-0.png) | `frames/`内悬浮／左移／右移各4张，12帧全部不同 |
| [背面静帧](art/player-production-v1/native-v1/player-back-idle-v1.png) | 48×48，与悬浮首帧一致 |
| [正面展示图](art/player-production-v1/native-v1/player-front-display-v1.png) | 160×224，人物可见高度192像素 |
| [4倍检查图](art/player-production-v1/native-v1/player-motion-contact-4x.png) | 768×576，最近邻整数放大 |
| [悬浮循环](art/player-production-v1/native-v1/idle-preview-2x.png)／[左移循环](art/player-production-v1/native-v1/left-preview-2x.png)／[右移循环](art/player-production-v1/native-v1/right-preview-2x.png) | APNG，各4帧，96×96双倍预览，8帧/秒 |
| [素材描述](art/player-production-v1/native-v1/manifest.json)／[整理记录](art/player-production-v1/native-v1/audit.json)／[验证记录](art/player-production-v1/native-v1/validation.json) | 帧矩形、统一锚点、色盘、原图哈希与实际检查结果 |

共用24个不透明RGB颜色，另有透明色；每个PNG的alpha仅为0或255。透明像素RGB清零，输出仅含PNG必需块与APNG动画块，不带生成源图的iCCP配置。预览已切换为这些原生文件。

## 实际检查

- 解析PNG真实透明通道；源图并非绘制棋盘格模拟透明。动作源图四角alpha为0，12格均有完整的不透明主体。
- 1448÷4与1086÷3均为362，网格没有分数尺寸。按alpha≥192检查，每格主体像素数为29417～31666；没有空帧或主体压到格子边界。逐格边界、透明统计与源文件SHA256见[源图检查记录](art/player-production-v1/source-audit.json)。
- 目视检查12格源图与4倍原生检查图：人物均朝背面，星饰保持在画面左侧，服装与羽翼延续已确认草图。
- 根据源图腰腹处金色披肩下缘，逐帧对齐到(24,28)；全组采用相同缩放系数。12帧的锚点均位于人物实体内，四周没有不透明像素压边，蓝色星饰位于左上方。注册后的原生帧轮廓高39～40像素。
- 逐帧PNG与图集对应区域像素完全一致；三组各4帧全部不同；共用24色、alpha二值、透明RGB清零和原图哈希不变均通过检查。
- 三个APNG的帧数、控制块序号、125ms时长、无拖影覆盖模式与逐帧像素核对通过。格式参考[PNG第三版动画块规范](https://www.w3.org/TR/png-3/#11acTL)。
- 预览JS和帧配置通过`node --check`。
- 使用独立临时配置的本地无界面Chrome实际渲染1100×1000预览，确认自机、深浅底对比和右下角正面图可见。正面源图在实际深蓝底上的叠加效果比生成工具的原图预览干净；低透明度残留尚未清理。
- 使用宽度360像素的iframe实际检查窄屏，角色展示下移、控件和文字可换行，目视未见横向溢出。整窗360像素截图受Chrome最小窗口宽度影响，不能作为360像素视口验收依据，已改用iframe。
- 检查截图在忽略目录`tmp/danmaku/`：`art-review-motion-v1.png`与`art-review-motion-narrow-iframe-v1.png`。这些是独立素材预览的渲染检查，不能写成正式战斗或实际手机验收通过。
- 原生素材导出后再次渲染桌面与360像素iframe，检查图为`art-review-native-desktop-v1.png`与`art-review-native-narrow-v1.png`；新素材、正确比例的判定标记和正面展示均可见，未见布局溢出。
- 使用最终版整理脚本另建一套输出，19个PNG/APNG与已选版本逐文件字节相同，验证脚本也通过。

## 整理方法与复现

脚本先按alpha≥192保留主体，去除孤立噪点；提取腰腹锚点后，用全组相同系数最近邻采样到48×48，再映射到共用24色。正面图独立居中采样到160×224，沿用同一色盘。源图只读，导出目录必须为新目录。

整理与验证脚本分别为[build_player_art.py](../../tests/danmaku/build_player_art.py)和[check_player_art.py](../../tests/danmaku/check_player_art.py)，只在离线制作时使用，不引入游戏运行依赖。仓库根目录复现示例（目标目录必须不存在）：

```powershell
python -X utf8 tests/danmaku/build_player_art.py --output tmp/danmaku/native-rebuild-new
python -X utf8 -B tests/danmaku/check_player_art.py tmp/danmaku/native-rebuild-new --source docs/danmaku/art/player-production-v1
```

## 验证边界

以上素材阶段检查不代替运行交互验收；后续运行交互、回放兼容与性能已另在[r2接入记录](PLAYER-INTEGRATION-r2.md)中记录。实际手机硬件与三阶段真人手感仍未验。按生成源图整理为48像素，不能称作逐像素手工重绘；P2未开始。
