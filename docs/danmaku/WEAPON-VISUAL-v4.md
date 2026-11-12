# 短追踪弹与星杖立绘

后续反馈：用户已确认标题，要求低速绿色弹恢复前版样式、增加P与积分掉落；当前行为和入口见[道中强化与积分晶体](COLLECT-v1.md)。本页“低速也缩短”属于被纠正的历史版本，高速短追踪仍保留。

2026-11-12，小典 / Codex；原型 `(C) 2026 Carinoasd`。沿用 [Issue #78](https://github.com/avgdaren/dz-gamecenter/issues/78)／[Draft PR #79](https://github.com/avgdaren/dz-gamecenter/pull/79)。

用户要求追踪弹使用短弹形，认可主角立绘但需要武器体现弹幕来源。本轮只修改绘制和标题图片，规则仍Easy r7／Normal normal-r5。

最新试玩：`E:\GPT工作区\output\danmaku-stage01-weapons-v3-offline.html`；快速看追踪短弹：`E:\GPT工作区\output\danmaku-weapons-v3-review.html`。旧v2试玩与预览均保留。

绿色追踪弹改为9px长的短菱形和小白芯，删除原来按速度延伸约45px的拖尾，仅保留直径10px的轻微光晕。低速绿色直射使用同一短弹外形；中央细长收束弹保持原绘制分支。速度、追踪转向、发射频率、伤害与碰撞完全沿用上一版。

主角沿上一张高清立绘进行内置 image_gen 局部编辑，添加蓝金色星杖：五角星杖头包住青蓝星晶，杖顶的两枚短绿色示意弹表现发射来源。保留原脸、发型、服装和整体姿态，右手调整为持杖。新1024×1536 RGBA原样复制到 [player-title-portrait-v2.png](../../source/plugin/gamecenter/games/_danmaku_proto/assets/player-title-portrait-v2.png)，旧v1原文件保留；[完整提示词与编辑目标](art/player-title-v2/PROMPT.md)、[尺寸／alpha／SHA记录](art/player-title-v2/manifest.json)。没有脚本编辑PNG。武器已用于标题立绘，战斗像素图仍是原文件，未重画持杖动作。

本次核对40份原运行文件／素材／声音逐文件一致，规则JSON与PHP／JS模拟保持原值，`weapons.js`追踪函数前缀也与提交`748db98`相同。只修改其 `drawShot` 的绿色弹绘制分支；没有新增规则号或另跑32组规则／整关模拟。

浏览器源码短查：标题星杖／星晶与弹形可见、不压文字和难度按钮；独立预览查看短绿色追踪弹与简化显示，无控制台报错。未打开实际关卡跑整关，未另在浏览器打开打包文件。短弹外观与新武器是否合意仍由用户确认，不将技术检查写成真人验收。

`python tests/danmaku/package_weapon_visuals.py`检查43份运行文件、21个主脚本、78个唯一DOM ID、自包含引用／脚本编译和旧v2交付SHA。新试玩17,197,621字节，SHA256 `872ce4e65ed873270f32b089433e91887dff76bc5fe54f7f415100c0d02b6904`；快速预览794,193字节。规则、40份保护文件、原立绘及旧离线包不变；本机报告／截图在 `tmp/danmaku/weapons-v3/`。

没有数据库升级、SDK契约／依赖变化、论坛HTTP／榜单／DB或部署。本轮不更新长期性能、真实手机／声音或整关手感结论。小蓝采用时同步新版绘制脚本、立绘PNG与资源白名单；不需要切换新规则号。未合并、部署或代发消息。
