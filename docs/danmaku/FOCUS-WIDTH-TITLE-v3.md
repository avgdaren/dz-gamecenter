# 低速补射与主角标题

后续表现更新：[短追踪弹与星杖立绘](WEAPON-VISUAL-v4.md)。本页武器规则继续采用，当前短弹外观、持杖标题与试玩入口见新页；旧v2文件保留。

2026-11-12，小典 / Codex；原型 `(C) 2026 Carinoasd`。沿用 [Issue #78](https://github.com/avgdaren/dz-gamecenter/issues/78)／[Draft PR #79](https://github.com/avgdaren/dz-gamecenter/pull/79)，分支 `feat/danmaku-title-power-v1`，不合并或部署。

用户认可收束样式，反馈4／5级低速太窄难命中，要求保留绿色弹但取消其追踪；同时要求标题使用主角，有高清立绘则复用，没有则补做。本次保留已认可的中央弹束，加两侧直射补覆盖，并换主角标题。

最新试玩：`E:\GPT工作区\output\danmaku-stage01-weapons-v2-offline.html`。定点看4／5级火力：`E:\GPT工作区\output\danmaku-weapons-v2-review.html`，无需打到高等级或通关。旧 `weapons-v1` 两个文件原样保留。

## 低速火力

4级、5级低速均保留原三路收束弹的外形、速度、间隔和伤害。在横向−36、−18、＋18、＋36px补四路绿色菱形弹，每6帧一轮、9px／帧、每发伤害1，覆盖72px；绿色补射只有直线速度，不索敌、不转向。独立发射节奏避免4级中央弹束每4帧、补射每6帧互相漏发。5级高速仍是原7路直射＋4路追踪；1～3级、4级高速不改。

中央输出仍300／420每秒，四路补射理论全命中增加40每秒；实战取决于目标位置和碰撞半径。没有扩大命中盒或增加Boss血量。新规则为Easy `danmaku-stage01-r7`／Normal `danmaku-stage01-normal-r5`，只追加 `weapons07`；之前十种关卡规则的回放行为保持原值，已发出的低速弹继续按各自速度飞行。新自机弹种类3表示绿色直射，PHP与JS一致重算，不接受客户端自报补射字段。

## 主角高清立绘

已核对工作区、原人物制作记录与两张源图：现有1024×1536正面源图和1254×1254图标仍为像素风，没有找到可直接替换标题的非像素主角立绘。按用户“没有的话可以做”授权，使用内置 image_gen 参考已有正面源图和图标补做1024×1536 RGBA立绘，原样复制至 [player-title-portrait-v1.png](../../source/plugin/gamecenter/games/_danmaku_proto/assets/player-title-portrait-v1.png)。浅金中长发、蓝眼与蓝色星饰、深蓝披肩／白裙／暖金边和小羽翼沿用原设定，旧像素源图／战斗小图不变。

[完整实际提示词与来源](art/player-title-v1/PROMPT.md)、[尺寸／透明通道／SHA记录](art/player-title-v1/manifest.json)。生成后没有脚本编辑图片；四角alpha均0，1,079,612个全透明像素，保留生成的半透明边缘。标题仍横版、直接Easy／Normal按钮，Boss立绘保留用于原登场；没有重复生成敌人或改音乐。用户此前选定的1号爆散＋震屏闪光、大招羽翼效果保持原文件。

## 检查与接手

- 新增32组道中／三Boss阶段、Easy／Normal、标准／辅助、4／5级、移动／集中切换／大招定点JS/PHP完全一致；实弹检查确认左右偏36px的目标旧低速无法命中、新绿色直射可以命中。原三路中央弹逐字段一致；绿色弹调用追踪更新后速度／目标仍不变，独立6帧节奏正确。
- 十种旧规则共20个定点与上一提交 `8888e43` 的模拟器一致；新规则合法片段重算通过，8类改分／附加字段／未知规则载荷两端拒绝。持续射击局部采样峰值111，小于192上限。原 `test-weapons.cjs` 与 `test-title-power.cjs` 回归通过，无新增自动整关通关。
- 浏览器源码短查主角标题实际显示，320×568布局无横向溢出，主角资源1024px宽正确加载；独立展示页目视检查4／5级低速中央弹束和四路绿色直射，无控制台报错。没有再开游戏自然通关，也未在实际关卡流程取得高等级。
- 打包核对42份运行文件、21个主脚本、78个唯一DOM ID，33份旧资源／模拟／声音／演出逐文件保护通过。新试玩17,091,086字节，SHA256 `1b0b374c8dce79d1028494886d94e5ed1cc2c68c445c343c53ca9c017df78692`；快速预览794,231字节。打包脚本编译／引用自包含检查通过，未另在浏览器打开这两个打包文件。

复核：PHP8置PATH或设 `DANMAKU_PHP`，`node tests/danmaku/test-wide-weapons.cjs`；规则生成 `python tests/danmaku/build_wide_weapons_rules.py`、`python tests/danmaku/package_preview.py`；打包 `python tests/danmaku/package_wide_weapons.py`。源码预览 `python tests/danmaku/serve.py --port 8896`，定点页 `/weapons-review-v2.html`。报告／截图在 `tmp/danmaku/weapons-v2/`。

未验证新补射真人手感／整关、真实手机与声音、长局性能、论坛HTTP／榜单／DB和部署。无数据库升级、SDK契约／第三方依赖改动。小蓝采用时同步新规则、PHP／JS、主角新PNG与容器／打包资源白名单；不能把新规则直接提交到旧r3榜单。没有修改小蓝站点或代发消息。
