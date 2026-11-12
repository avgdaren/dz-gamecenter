# 天使弹幕祭 P1 验证与试玩

作者：小典 / Codex · `(C) 2026 Carinoasd`。

当前修正版为[Boss动态与阶段r3](../../docs/danmaku/BOSS-FIX-r3.md)，完整一关／首领练习分别为`danmaku-stage01-r3`／`danmaku-p1-r3`，旧规则与回放保留。用户负责真人试玩，默认不跑整关自动通关。相关定点检查：`node tests/danmaku/test-boss-r3.cjs`、`node tests/danmaku/test-boss-view.cjs`；需要看画面时用约5秒实际入口加独立预览的`node tests/danmaku/browser-boss-r3.cjs`。以下旧命令与结果保留为历史，不作为每轮必跑流程。

当前界面候选为[UI v1](../../docs/danmaku/STAGE-01-UI-v1.md)。新版单文件`danmaku-stage01-ui-v1-offline.html`；测试用`node tests/danmaku/browser-stage01.cjs --bgm --ui-v1 --out=tmp/danmaku/stage01-ui-v1/browser <新版file:///URL>`，加`--layout-only`仅检查七种尺寸／入口／辅助，加`--cold-audio`检查开局前声音准备。`browser-focus.cjs`已支持折叠练习区里的入口。旧HappyShrimp版保留；当前源码默认使用新UI，音频来源和实现沿用下一段。

当前音频版为[HappyShrimp成品音频v1](../../docs/danmaku/STAGE-01-HAPPYSHRIMP-v1.md)：用户提供两首完成的MP3，使用HappyShrimp配合提示词工程制作。道中72秒、Boss从登场连续播放并处理循环；通关／失败短曲仍使用MIDI v3，16种音效不变。运行`node tests/danmaku/browser-stage01.cjs --bgm`，冷启动加`--cold-audio --out=tmp/danmaku/stage01-happyshrimp-v1/cold-browser`；`node tests/danmaku/test-audio.cjs`、`node tests/danmaku/test-midi.cjs`和`python tests/danmaku/check_stage01_audio.py`核对生命周期、保留MIDI及音频完整性。单文件`danmaku-stage01-happyshrimp-v1-offline.html`，规则仍为`danmaku-stage01-r2`。音乐默认55%，音效默认关闭；首次开始会先准备声音再推进关卡。旧MIDI v3／v2／音频v1及原曲保留，旧包可单独复验；当前源码默认使用新BGM，使用`--bgm`验证。

当前美术首版：`node tests/danmaku/browser-stage01.cjs --art`检查新场景与三类小怪；`python tests/danmaku/check_stage01_art.py`和`node tests/danmaku/test-stage01-art.cjs`核对资源与表现不改模拟。单文件名`danmaku-stage01-art-v1-offline.html`，运行规则仍为`danmaku-stage01-r2`。见[美术接入记录](../../docs/danmaku/STAGE-01-ART-PRODUCTION-v1.md)。

2026-11-11最新：默认入口为单关《星穹回廊》，含72秒小怪、拾取强化、三档散射／集中、星翼绽放大招与三阶段Boss。当前新开局规则`danmaku-stage01-r2`，大招上限3枚，两名守卫各提供1个B，集中判定点更醒目且实际半径3不变。运行`node tests/danmaku/test-bomb.cjs`与`node tests/danmaku/browser-stage01.cjs --bomb`验证新版；`node tests/danmaku/test-stage01.cjs`保留成长r1回归，旧首领／弹型练习仍独立。导出复验用`node tests/danmaku/check-export-stage01.cjs <回放文件>`。当前行为、命令和未验项见[大招接入记录](../../docs/danmaku/STAGE-01-BOMB-r2.md)。

## 试玩

现在可以直接双击`source/plugin/gamecenter/games/_danmaku_proto/index.html`，无需启动服务。完整交付包根目录另有`START.html`单文件试玩版，可单独复制后打开；规则、脚本和图片均已嵌入。默认是《星穹回廊》单关完整流程，原首领及花瓣／瞄准／波浪练习仍可切换。

HTTP预览仍可使用：仓库根目录运行 `python tests/danmaku/serve.py --port 8876`，打开 <http://127.0.0.1:8876/>。

`rules.json`仍是JS/PHP共用的规则源；`rules-data.js`是供浏览器直接打开的同内容副本。改动规则后执行`python tests/danmaku/package_preview.py`同步，执行`python tests/danmaku/package_preview.py --check`检查是否过期。可选单文件打包命令为`python tests/danmaku/package_preview.py --output tmp/danmaku/START.html`；仅用Python标准库，试玩不需要打包工具或Python。

开场 3 秒、每阶段最多 70 秒、阶段间转场 2 秒。三阶段血量 4500／4800／5100；生命和清屏贯穿整局。标准 3 命／2 清屏，辅助 5 命／3 清屏与减速弹幕。两种模式目前都只在本机显示结果，没有接论坛排行榜或积分。

方向键／WASD 移动，按住Shift低速集中射击并显示判定点，松开恢复普通散射并隐藏判定点；窄屏点击“集中”按钮提供等价切换。X／空格清屏，Esc暂停；开场和转场不射击、不消耗清屏。切换场景会重置当前局。按住清屏键不连续消耗，终局才能导出完整回放。

2026-11-11运行接入已完成：像素自机与右下角正面图已上屏，当前新开局使用r2射击规则，旧r1回放仍可重算。新增验证运行`node tests/danmaku/test-focus.cjs`，真实浏览器交互运行`node tests/danmaku/browser-focus.cjs`。旧预览服务需要重启以载入新增图片与JS白名单。最新事实和**PHP长局超预算**记录见[接入交接](../../docs/danmaku/PLAYER-INTEGRATION-r2.md)，下文性能数据保留为2026-11-10的r1历史结果。

## 自动验证

```powershell
node tests/danmaku/test-core.cjs
node tests/danmaku/test-battle.cjs
python tests/danmaku/package_preview.py --check
```

离线入口浏览器复验：`node tests/danmaku/browser-focus.cjs --ui-only --offline --out=tmp/danmaku/startup/source-file <index.html的file:///绝对URL>`。省略`--ui-only`会再跑45秒自然练习终局并核对JS/PHP全部快照。省略URL时会自行启动HTTP预览服务。`--out`用于将各入口的检查记录分开保存；独立Chrome临时配置均位于忽略目录。

第一条是原 P0 的 35 项检查、6 个固定终局、200 组随机终局差分和 13 类非法拒绝。P1 通过最小输出／终点钩子复用原物理规则，输入字节格式不变，旧 P0 回放继续使用原规则 ID。

第二条是 P1 的 27 项转场／计分／拒绝检查。包括开场行为、阶段超时、截止步击破优先、最后一命与击破同帧判负、伤害溢出裁剪、转场不补资源、阶段组合弹幕和严格改分拒绝。

P1 比对 64 个合法案例：3 条完整通关模型路线、1 条自然超时、40 组随机自然终局、20 组合法前缀；每 60 步、阶段变化和终点逐项比较 JS/PHP 的完整状态。另有 15 类非法记录两端均拒绝，包括假分数、客户端血量／阶段、版本、传送输入、非法标记和通关后追加输入。

模型驱动器 `p1-policy.cjs` 只读取当前状态并选择合法移动／清屏输入，不改 HP、生命、时钟或弹幕。通关记录证明规则可达与重播正确，不等于真人已通关或难度统计。

## PHP 重算与性能

```powershell
& 'E:\dzx5-env\php\php.exe' tests/danmaku/cli-p1.php 'C:\path\danmaku-battle-record-p1.json'
& 'E:\dzx5-env\php\php.exe' tests/danmaku/benchmark-p1.php
```

第一条只输出终点；需要逐段诊断时加 `--trace`。新战斗回放使用 `danmaku-p1-r1`，与旧练习场元数据隔离。PHP 仍只允许本机 CLI，不存在可调用的正式 HTTP 成绩接口。

对实际浏览器导出的文件，同时核对 Node／PHP 的每60步、转场与终点：

```powershell
node tests/danmaku/check-export-p1.cjs 'C:\path\danmaku-battle-record-p1.json'
```

本轮真实浏览器标准挑战在4380步自然超时，327次命中、Boss余1230HP、4541分；两端全部快照一致。旧P0真实浏览器记录也与P0交付时保存的PHP快照逐项一致，没有因伤害钩子或编解码复用发生规则漂移。

第二条先运行规则检查生成合法长局，再测最长所测标准通关样本（12,647 步，约210.78秒）：5 次预热、50 样本，包含输入解码、完整模拟和终点计算，不生成每秒诊断快照。

本轮 PHP 8.3.36 CLI／i9-14900HX／OPcache CLI 关闭：p50 425.35ms、p95 453.84ms、最大 489.55ms、峰值内存 6 MiB。该合法样本满足500ms本机预算，不代表理论最长217秒的所有路线或线上4 worker混合负载都已通过。

P0 的人工360弹／13,200步夹具仍是失败项，没有因本轮合法长局通过而变成PASS。它强行重置寿命和擦弹标记，不能由正式回放输入产生；P2仍需用可达最重记录、提交频率和实际HTTP负载评估服务端预算。

## 结果与未验

自动测试、差分与长局性能结果保存在忽略目录 `tmp/danmaku/p1/`。正式源码不包含运行日志、实际导出玩家记录或测试产生的回放。

1280×900桌面、360×800窄屏均已实际渲染并检查无水平溢出；阶段血条、实时分数、暂停／重来和自然终局已观察，控制台无错误或警告。完整三阶段真人手感、实际手机双指、论坛凭证／榜单／并发、正式素材运行整合和音频尚未验。美术风格已选“二次元星空幻想”，Boss选定沉静庄严的星环观测者，方向板和透明主体层首稿及开工安排见 [美术简报](../../docs/danmaku/ART-BRIEF-v1.md)；图像没有直接接入运行画面。
