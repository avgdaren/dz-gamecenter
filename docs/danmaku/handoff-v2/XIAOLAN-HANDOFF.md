# 小蓝接手：当前完整单关版

2026-11-12，小典 / Codex；原型 `(C) 2026 Carinoasd`。主人已授权本次通过现有公开仓库交接，由你接本地论坛、验证后准备线上包。这里是最新入口，覆盖旧 `handoff-v1` 的当前规则与UI说明。

[PR #79](https://github.com/avgdaren/dz-gamecenter/pull/79)，分支 `feat/danmaku-title-power-v1`，基底 `feat/danmaku-normal-v1`。请从PR当前HEAD取 `source/plugin/gamecenter/games/_danmaku_proto/`，共43份运行文件，按 [RUNTIME-MANIFEST.json](RUNTIME-MANIFEST.json) 核对；文本按LF规范化、PNG按原字节。可对接时将PR的HEAD SHA固定在你的交接记录中。这个目录已经包含Normal分支内容，不要只拿最后一个顶角补丁或用main替代。

你维护的论坛平台以你的当前代码为准，移植本游戏目录及必要适配，不整分支覆盖gamecenter。继续保留原作者旧 `danmaku` 游戏。本轮小典没有接入或修改你的站点／DB，没有合并或部署；本目录仍是原生JS＋PHP原型，已有论坛包装由你同步。

## 本次最终行为

- 标题为已获主人确认的星杖主角高清立绘、横版构图，Easy／Normal直接按钮。标准完整一关；集中键可改并保存；生命／5级火力／大招在战场内，下方为简短操作与设置。
- 火力门槛P0／3／8／12／16。4级低速三路收束弹，5级低速更快更密；两档均有四路绿色直射补覆盖，低速绿色外观已按最新要求恢复前版弹形／拖尾。5级高速绿色追踪是短弹、无长尾。
- 道中P总量26，非P的20只敌人各掉蓝色积分晶体，拾取+500；原击破分、P满级溢出和B溢出保留。已收晶体分不因掉命扣除。
- 新细节：角色进入左右上角后全屏P／B／积分晶体／恢复P自动吸过来，离开顶角仍继续；新生道具和恢复包跳过原解锁等待。逻辑坐标为y≤192且x≤96或x≥384，场地480×640、自机y下界144，中央上沿不触发。吸收沿原道具移动／碰撞后结算，不是直接给库存或分数；过期和已出场道具不复活。
- Normal敌方弹幕已获主人确认，HP／碰撞／移动、B伤害、音乐和已有图像不再调整。两次Boss转场同为1号爆散＋短震屏闪光；大招羽翼／光环／光柱。掉命后大招重置标准2／辅助3，最后一命不补，转场不送B。

## 服务端与榜单同步

当前Easy规则 **`danmaku-stage01-r9`**，Normal规则 **`danmaku-stage01-normal-r7`**，两者格式解析上限均 **331700**；分数必须来自完整PHP重放。对应本轮 `rules.json` 的 `power05`／`weapons06`／`weapons07`／`collect08`／`corner09`，不能只同步前端文件。旧14种关卡规则保留历史重放语义。

现有提交载荷字段仍为 `stage,v,rule,assist,ticks,input,score`；论坛传输沿原平面字段约定 `stage=1,v=1,assist=0`，rule用本局开局绑定的当前难度规则。拒绝未知字段、自报power／points／autoCollect、辅助或未自然终局的成绩；`danmaku_stage01_replay($payload,$rules,false,false)`关闭trace重算后取 `snapshot.score.total`。开局token、可信seed、游客、重复提交幂等沿你维护的平台处理，不接受客户端指定可信seed或新开token重试。

旧 `handoff-v1/forum/submission-bridge.*` 和 `ranking-policy.json` 固定r3，是历史资料，会拒绝新记录；请在正式桥接里同步当前规则、严格字段转换、分数上限与重算。Easy、Normal和旧r3成绩按规则／难度分别处理，不能直接混榜。平台若只按游戏条目分榜，按你当前的隔离实现落地，保持既有SDK契约。奖励继续沿平台已定值，本次没有新设积分奖励或DB升级。

`engine.php`、`battle.php`、`boss-patterns.php`、`weapons.php`、`stage.php`仍有原型CLI／引导保护；你在正式模块中按 `IN_DISCUZ` 受控加载整理，保留直接访问保护，不能原样复制后声称HTTP校验已接通。

## 前端与资源

按 `index.html` 的21个经典脚本顺序加载；`controls.js`、`weapons.js`、`rules-data.js`以及 `assets/player-title-portrait-v2.png`不可漏。BGM与音效仍在原bank脚本中，原两首HappyShrimp成品保持。全部图片与运行文件见清单，不从本机output目录依赖资源。

将全页DOM／样式／键盘监听限制到你的游戏容器，离开时释放监听／RAF／音频；保留改键冲突拒绝、暂停／失焦冻结、音频加载完成前不走逻辑步。先选难度、平台start成功后再开始当前规则的模拟。不要恢复已移除的练习／辅助公开入口，不在每帧根据界面文字猜难度。规则、集中状态和自动吸收都由回放输入／坐标决定，不接收额外自动收集开关字段。

## 可以直接复核的内容

Node与PHP8可运行，PHP不在PATH时设置 `DANMAKU_PHP`。`node tests/danmaku/test-corner.cjs`是本轮80组顶角／解锁／离开继续、28组旧规则及非法字段检查；`node tests/danmaku/test-collect.cjs`覆盖32组阶段、12组掉落／积分／换阶段／掉命和合法晶体分重算。测试需Git历史及已提交的匿名夹具，不依赖本机tmp／output基线。

`python tests/danmaku/package_corner.py --output-dir output/corner-handoff`可从完整checkout生成自包含试玩和快速预览，不要求已有历史离线文件。主试玩SHA256 `5df44e7c898ac53b0473809c16311f080157b81d1949d153bc4f1c3f424eea9b`；快速预览可点左右上角按钮直接看全收。它们供审阅，不是论坛安装包。

本轮源码独立预览已看到左右顶角全收P／B／积分晶体，提升火力并加500分，无控制台报错；语法、打包自包含、43文件清单与37份原文件保护通过。没有自动整关通关，主人继续负责真人手感。实际关卡高位风险、真实手机／声音、长局性能、论坛HTTP／正常成绩与非法记录、并发幂等、各榜单／个人最佳／游客行为和部署尚需你在当前平台验证，不能把局部模拟写成论坛验收。

通过本地论坛验证后，由你从固定提交准备线上包、版本／SHA／回滚说明。无需小典先跑一遍论坛，也不要直接拿离线HTML或旧r3交接ZIP当安装包。
