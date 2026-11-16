# 第一关Normal／Hard共同小怪耐久修正 v11

2026-11-16，小典 / Codex；原型 `(C) 2026 Carinoasd`。

**后续用户确认：** avg达人实际试玩后反馈“我试玩结束了，没什么问题，可以像之前那样交接给小蓝了”。当前已按[GitHub交接v3](handoff-v3/XIAOLAN-HANDOFF.md)整理源码／素材／独立重建，论坛适配及线上包由小蓝负责；下文“未推送”是修正制作当时状态，最新以交接目录GITHUB.json为准。技术检查与用户反馈分别记录。

用户试玩发现第一关Normal／Hard的小怪仍需多次命中。核实v10接续旧第一关档位时，漏接两关版本已经采用的共同小怪耐久：Normal／Hard仍是32／90／360，Easy为1／128／450。v10检查只确认第一关与旧档位相同，未覆盖新两关版本的共同轻型一击破要求，这是本次漏检原因。

[当前试玩v11](<E:/GPT工作区/output/天使弹幕祭/当前试玩/danmaku-campaign-v11-offline.html>)：49,809,476字节，SHA256 `b2a7a0c4e0420b65a15fa0c6bc7da0de87ffc3fd8bf956fa90f8490cd366d5ee`。默认Normal，开局前可切三档。v10原样作为唯一回退，旧独立第一关Normal／Hard专项仍是历史版本；试玩本修正请使用当前v11入口。

本次统一第一关三档的轻／中／大型耐久为**1／128／450**：轻型有效命中即破，中大型保留耐久。适配覆盖整局、第一关练习、第一关Boss入口、阶段替换及Boss检查点重试。Normal／Hard整局规则追加为`danmaku-campaign-normal-v2`／`danmaku-campaign-hard-v2`，旧规则及源码保持。

只增加`difficulty-flow-v11.js`适配层和对应入口；旧第一关攻击、编队、路线、首发／预警、Boss、玩家成长／判定／B、图像／音乐／字体、第二关与演出都保持。Easy继续委托原实现。

## 本次验证

[报告](campaign-v11-validation.json)。6组针对性Node检查、60个命中用例通过：三档×五级火力×四种弹种，单发1伤害经过实际扫掠碰撞后均击破轻型敌。双弹同帧仅结算一杀／一份掉落；中大型单发后分别剩127／449；基础规则未原地修改。

对照旧第一关，仅应用明确的耐久差异后，Normal／Hard各720步状态一致；两个Boss三阶段各180步状态、入场／换式／重试一致。Easy及三档第二关局部快照保持。以上为受控夹具，不是真人手感或整关通关。

实际修正版HTML在隔离断网Chrome中，真实点击进入三档第一关后检查出生配置；通过运行中的真实子弹碰撞夹具验证1HP→0HP、一杀及一次掉落。Easy第一关、三档第二关定点Canvas与状态同v10，图片／音乐／字体保持。外部请求0、脚本异常0，Normal／Hard截图已查看。

未自动整关自然通关，未重新标定难度或验证真实手机。v10的其他检查保留为历史记录，不冒称本次重新整体验收。没有新网友包、修改论坛／数据库、推送Git或部署。

复现：`node tests/danmaku/test-campaign-mob-fix-v11.cjs`；`python tests/danmaku/package_campaign_v11.py`；`node tests/danmaku/browser-campaign-mob-fix-v11.cjs <HTML完整路径>`。
