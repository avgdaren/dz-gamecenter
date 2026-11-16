# 小蓝接手：v13正式封面＋v12复归与守卫反馈

**后续修订：** 主人又反馈论坛收尾结算不可见、标题Q版角色突兀，最新接手入口为[handoff-v5](../handoff-v5/XIAOLAN-HANDOFF.md)的v14独立结算与单立绘标题。本目录继续精确重建原v13，不覆盖旧清单。

2026-11-16，小典 / Codex；原型 `(C) 2026 Carinoasd`。

主人在收到自机连死／死亡无特效、精英停留过短的反馈后要求调整。v12完成并通过局部验证后，主人明确“交接给小蓝吧”。这是v12的交接授权，不把它写成已逐档、逐路线或真实手机验收。

本次是[Issue #82](https://github.com/avgdaren/dz-gamecenter/issues/82)的独立补丁，分支`feat/issue-82-danmaku-feedback-v13`，基底为PR #81的`feat/issue-80-danmaku-campaign-v11`／`f478bb849312f29373f9c03f0967e56351df61c1`。已发布[Draft PR #83](https://github.com/avgdaren/dz-gamecenter/pull/83)，运行提交`c50d9e380c5c79b1caa557c3633f586388908865`，细节见[GITHUB.json](GITHUB.json)。原v11说明与清单留在[handoff-v3](../handoff-v3/XIAOLAN-HANDOFF.md)，本页为新的接手入口。移植时取完整新分支，保留旧基线，不把整分支覆盖到你的当前平台。

主人随后要求“继续”，并指出封面应恢复之前上线的版本。本次交付更新为v13：保留v12战斗，恢复正式封面。没有再次声称真人试玩通过。

## 正式封面必须接入

截图中的审阅页不作为正式入口。使用`app-v13.js`＋`title-shell-v13.css`，以原有星杖主角／像素角色／星环、Easy／Normal／Hard直选和开始按钮恢复上线版构图。练习与回看在下方折叠区，改键和音量继续保留；手机使用上下布局。详见[CAMPAIGN-v13](../CAMPAIGN-v13.md)与[最终浏览器报告](../campaign-v13-validation.json)。

这是同一个整局Session的标题状态；不要在现行论坛中另套旧游戏或叠加两套开始入口。`titleCompanion`复用原始PNG，线上按共用资源清单提供URL。模板中的CSS依赖也已列入runtime清单。正式按钮仍由既有SDK生命周期接入，不能直接覆盖你当前平台。封面与两关逻辑应一起移植。

v13断网浏览器原生三档点击／Hard开局／返回／设置／练习通过；390／320无溢出，四张截图已查看。6个两关三档定点状态和Canvas与v12完全相同。未在论坛HTTP中验收。

最终封面：[桌面](previews/title-desktop.png)／[390px](previews/title-mobile-390.png)／[320px](previews/title-mobile-320.png)；[开局后](previews/game-after-start.png)。这些是同SHA浏览器截图，论坛接入后请对照。

## 核对交付

- v13离线文件：49,835,404字节，SHA256 **`3a182c47920d418bbf6e118f39e8afef6626a5afb74a73d8fd861790a87f47e6`**。
- [100份依赖清单](RUNTIME-MANIFEST.json)：文本按UTF-8无BOM／LF取SHA，二进制按原字节；资源与字体母版未变。
- [runtime.json](runtime.json)：主脚本53模块，后接7个入口／补丁模块，准确顺序和标记均已记录。原图、音乐、字体许可及作者署名保持。
- [交接授权](USER-AUTHORIZATION.json)、[独立checkout验证](CHECKOUT-VALIDATION.json)、[本轮浏览器／定点报告](../campaign-v12-validation.json)。

完整checkout运行以下命令即可重建同SHA的v13，不需要本机历史output／tmp、论坛、npm、字体工具或网络资源：

```text
python tests/danmaku/package_handoff_v4.py --output-dir tmp/danmaku/handoff-v4/review
node tests/danmaku/test-feedback-v12.cjs
node tests/danmaku/test-campaign-mob-fix-v11.cjs
```

`template.html`与`data-template.json`是制作模板，不能直接作为论坛安装页。重建HTML用于基线审阅；正式资源继续独立清单、共用哈希URL与按需准备。

## 行为变化

| 内容 | v11 | v12 |
|---|---|---|
| 死亡显示 | 原地扣命、短暂屏边闪 | 原位置光环碎裂／光羽散开，自机消散 |
| 复归 | 没有独立过程 | 36逻辑步／0.6秒后回到原开局位置（240，552），同步上一帧坐标避免扫掠跳线 |
| 受击保护 | 从受击时起120步／2秒 | 死亡等待36步，复归后另有240步／4秒；底部只做一次72px局部清弹 |
| 保护提示 | 普通无敌反馈 | 护环与剩余弧线跟随自机，最后60步显示“保护即将结束” |
| 最后一条命 | 立即结束 | 先播放36步死亡效果再结算，无复活或补B |
| 第一关大型守卫 | 生命周期720步／12秒 | 延长原停住段180步，总900步／15秒 |
| 第二关大型守卫 | 生命周期600步／10秒 | 延长原停住段180步，总780步／13秒 |

两关、三档、关卡／Boss及单式练习共用复归流程。死亡等待期间输入仍严格验证，自机不移动／射击／消耗B，敌方战斗继续。暂停、失焦及剧情冻结恢复时钟。转式和100步祈祷按实际逻辑步消耗剩余保护，跨关不重复补发；检查点重试清除失败尝试的死亡状态。最后一命使用`death-ending`阶段，敌方模拟已终止，36步视觉结束后再由整局返回死亡终局。

“精英”仅调整掉B的大型星仪守卫／花铃守卫。中型侍从、普通小怪不改；大型守卫的出场时刻、原攻击／预警、血量、奖励及退出路径保持，新增驻留没有新增攻击。第一关三档耐久仍为1／128／450，第二关各档仍沿v11；第一关／第二关总道中时长不改。

不改大招的1B消耗、300伤害、90步清弹、120步无敌与冷却；不另补命／加P。掉命降一级、可回收P、标准补回2B、同帧多弹只扣一次命保持。新手感与真实设备表现继续以反馈为准。

## 接入文件与规则

都在`source/plugin/gamecenter/games/_danmaku_campaign_draft/`：

- `player-recovery-v12.js`：死亡年龄、返回位置与保护、局部清弹、快照状态。
- `elite-stay-v12.js`：新增驻留配置／第一关路径样本／第二关大型守卫位置适配。普通敌机逻辑保持。
- `feedback-flow-v12.js`：包裹v11流程，不改历史模拟；处理输入屏蔽、换式／重试／跨关与最后一命的延迟结算。
- `recovery-view-v12.js`：只读逻辑时钟的光羽与护环，简化动态减少羽片／闪动。
- `stage01-view-v12.js`、`stage02-view-v12.js`：新视图；正式入口使用`app-v13.js`与`title-shell-v13.css`，`app-v12.js`仅保留制作基线。**单式练习直接创建Flow后也必须调用`prepareFlow(...,2)`，不能漏掉。**

新整局规则为：

| 难度 | v11旧记录 | v12 |
|---|---|---|
| Easy | `danmaku-campaign-easy-v5` | `danmaku-campaign-easy-v6` |
| Normal | `danmaku-campaign-normal-v2` | `danmaku-campaign-normal-v3` |
| Hard | `danmaku-campaign-hard-v2` | `danmaku-campaign-hard-v3` |

**不能只把120改成276或只覆盖特效文件。** 新行为还包括36步隐藏输入／射击、回归坐标与局部清弹、相位时钟换算、状态转移和最后一命`death-ending`。`Sim.tick`在转场／末命视觉段不会按普通战斗推进，而流程年龄会变化；正式服务端重放／时长预算也要对应处理。客户端上报的复归状态不可信，必须从已验证输入和碰撞重算。

两关PHP确定性回放、正式成绩载荷与榜单仍未实现。保留旧单关服务／历史榜，新两关正式校验完成前不计榜；Hard不自动开榜。不沿用单关331700上限，不把新两关成绩混入旧榜，不破坏`api.start`／`api.submit`／game.json公开契约。原型PHP加载保护、SDK生命周期、游客／登录、token与并发幂等继续按你现行平台处理。

## 验证范围

本轮9组Node覆盖两关三档6个复归边界、精确保护到期、末命不误复活、原始P／B、对白冻结、换式／重试／跨关、守卫驻留／退出与Boss攻击对照。两关三档各18秒相关窗口的敌机／敌弹峰值未超原上限。v11的6组／60个最低伤害命中夹具另作回归。

已在只有100份依赖与两份测试的临时目录独立重建v13，并验证新9组＋回归6组。v12实际断网Chrome检查6个复归场景、末命原生继续／失焦、6个守卫延长窗口、390／320布局及简化动态；脚本异常／外部请求0，截图已查看。浏览器检查是上轮制作时的同SHA证据，本次交接不冒称重新整关通关。

未自动整关自然通关，未验真实手机、长局性能、两关PHP、论坛HTTP／榜单／数据库／并发或线上部署。无DB迁移、npm／CDN及Discuz核心改动；本次不合并、不改站点或数据库、不部署，也不制作网友包。你接入现行论坛并验证后，再从固定提交准备线上包和回滚清单。
