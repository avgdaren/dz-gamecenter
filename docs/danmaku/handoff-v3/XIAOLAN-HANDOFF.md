# 小蓝接手：两关三难度 v11

2026-11-16，小典 / Codex；原型 `(C) 2026 Carinoasd`，原论坛包装的小蓝署名保留。

avg达人已实际试玩当前v11，反馈“我试玩结束了，没什么问题，可以像之前那样交接给小蓝了”。本次沿用 **小典备齐源码与素材 → GitHub交接 → 小蓝负责论坛适配、本地验收与线上包**。本页取代handoff-v1／v2的当前内容说明；不代表两关已经接入论坛或榜单。

GitHub交接：[Draft PR #81](https://github.com/avgdaren/dz-gamecenter/pull/81)，运行内容固定提交`933694d66c2957bd9f2b5eabc7c9b2e435dfd5d0`。对应[Issue #80](https://github.com/avgdaren/dz-gamecenter/issues/80)，分支`feat/issue-80-danmaku-campaign-v11`，基底`feat/danmaku-title-power-v1`（旧交接PR #79）。PR及固定运行提交见[GITHUB.json](GITHUB.json)。只移植本游戏与必要适配资料，平台以你维护的现行代码为准，不整分支覆盖gamecenter或旧`danmaku`。

## 先核对这份成品

[RUNTIME-MANIFEST.json](RUNTIME-MANIFEST.json)列出94份实际运行／重建依赖，文本统一UTF-8无BOM、LF后取SHA，图片／MP3／WOFF2按原始字节取SHA。53个运行模块的准确顺序在[runtime.json](runtime.json)。

在完整checkout中执行：

```text
python tests/danmaku/package_handoff_v3.py --output-dir tmp/danmaku/handoff-v3/review
node tests/danmaku/test-campaign-difficulties-v10.cjs
node tests/danmaku/test-campaign-mob-fix-v11.cjs
```

Node与Python标准库即可，不需要npm、字体工具、FFmpeg、历史output／tmp或本机论坛。第一条生成`danmaku-campaign-v11-offline.html`，49,809,476字节，SHA256必须是：

`b2a7a0c4e0420b65a15fa0c6bc7da0de87ffc3fd8bf956fa90f8490cd366d5ee`

这与主人确认的当前离线件逐字节相同。`template.html`、`data-template.json`只是制作模板与资源引用，不能直接双击当正式游戏。重建HTML供基线审阅，论坛运行应采用独立资源与现有SDK包装。

## 当前应保留的行为

- 两关“星穹回廊 → 风铃花庭”，Easy／Normal／Hard统一入口，默认Normal。连续挑战按实继承生命、原始P、B及剩余无敌／冷却；不替换为练习满资源，不送额外关间补给。
- 六段28句剧情，读取／跳过期间冻结战斗及音乐。第一关战后对白 → 原100逻辑步祈祷 → 第二关开场；第一关不提前整局结算，第二关后显示统一分项。
- v8共用Boss登场、换式、常驻招名及最终收束；危险弹幕／自机在前景。原登场／120步换式等待不加长，自机“星翼绽放”翼框保持。字体为已内嵌的500字重离线子集，OFL及署名完整保留。
- 五级成长P0／3／8／12／16、移动、判定、集中／散射、顶角吸附、大招1B／300伤害／90步清弹／120步无敌与冷却、掉命补B及回收强化保持。务必用实际生效的五级配置，不能用旧基础JSON的三级配置覆盖。
- **第一关三档小怪耐久均为轻／中／大型1／128／450。** 这是v11修正，漏掉`difficulty-flow-v11.js`就会恢复旧Normal／Hard的32／90／360。轻型有效命中即破，中大型保留耐久。
- 第二关96秒、8秒后首敌。Easy已确认铃羽三式保持；Normal124敌，Hard140敌。N三式为交叶迁径／错庭重瓣／隔庭追响；H为回卷双风／迟放回庭／三铃错奏。Hard主鸣提前36步锁定后不追踪，延迟转向前24步提示；HP与详细编排见[CAMPAIGN-v10](../CAMPAIGN-v10.md)及[耐久修正v11](../CAMPAIGN-v11.md)。
- 关卡／Boss／铃羽单式练习、检查点重试及无敌有明确练习标记；单式重开、换资源和检查点重试保留所选式，不能当一次连续完成记录。正式论坛是否公开这些入口沿你维护的平台规则处理。

## 代码与资源入口

| 内容 | 路径／说明 |
|---|---|
| 共用底层与第一关 | `source/plugin/gamecenter/games/_danmaku_proto/`，沿用各历史版本；新增Hard定点运动及原光弹图集 |
| 第二关 | `_danmaku_stage02_draft/`；当前适配为`difficulties-v10.js`、`difficulty-normal-v1.js`、`difficulty-hard-v1.js`，Easy为`refined-easy-entry-v6.js` |
| 两关流程 | `_danmaku_campaign_draft/`；按清单加载，`difficulty-flow-v11.js`在旧v10流程上补第一关共同耐久；最后用`app-v11.js` |
| 显示层 | `stage01-view-v10.js`／`stage02-view-v10.js`、`spell-show-v10.js`／`spell-canvas-v10.js`，与原v8／v9层共同工作 |
| 音频加载 | `_danmaku_assets_v1/audio-lazy-v1.js`；当前曲先准备、Boss曲后台预备，切关释放旧上下文／缓冲，取消后防旧异步回写 |
| 美术与音乐引用 | `data-template.json`中的`$uri`／`$base64`为仓库相对路径；优化图在`docs/danmaku/assets-lossless-v1/`，第二关原音乐在`docs/danmaku/audio/stage02-user-v1/` |
| 原件／来源 | `docs/danmaku/art/`及`audio/`保留原素材与生产记录；发行素材不覆盖母版，BGM不重新有损编码 |

同一难度开局后锁定；用开局绑定的真实难度／规则贯穿两关，不根据HUD文字或每帧表单值推测。原生JS／PHP，禁止npm、第三方CDN及Discuz核心修改。DOM、样式、键盘、RAF与音频生命周期需收进你维护的游戏容器，退出正确释放。

在线资源继续按最终内容哈希命名、共用地址与长期缓存。仅哈希图片／MP3可`Cache-Control: public, max-age=31536000, immutable`；入口／无哈希脚本走版本更新。保留仍打开旧页面需要的旧PNG，不采用删除式同步。动作／弹体取样素材仍保留PNG，无损RGBA相同不等于浏览器缩放后整幅画布相同。原资源优化本地首屏14.85→4.32MB、热切Normal共享大素材无新增请求是本地证据，线上必须实际测，详见[资源记录](../ASSETS-OPTIMIZATION-v1.md)。

## 服务端与榜单是本次接入的关键边界

| 整局规则 | 第一关底层 | 第二关 |
|---|---|---|
| `danmaku-campaign-easy-v5` | Easy r9＋共同耐久 | Easy refined v6 |
| `danmaku-campaign-normal-v2` | Normal r7＋共同耐久 | `danmaku-stage02-normal-v1` |
| `danmaku-campaign-hard-v2` | Hard r3＋共同耐久 | `danmaku-stage02-hard-v1` |

**当前两关没有对应的PHP确定性重放、正式成绩载荷和榜单白名单。** 原`stage.php`验证的是旧单关规则，连第一关新耐久也不能直接用旧Normal r7／Hard r3解释。不要只复制前端、放宽分数上限或相信客户端汇总分后就计榜，也不要把两关成绩提交到既有单关Easy／Normal榜。

首次论坛接入期间，保留现有单关服务／历史榜，新两关明确不计榜；正式计榜前完成两关及切关资源／统计、输入与事件时间线的JS／PHP一致性、自然终局判定、时长与载荷预算及重算成本验证。Hard原本不计榜，不因入口齐全自动开榜。正式成绩须按可信难度／规则分隔，练习、无敌、重试与旧记录分别处理。第二关当前是临时试玩分（实际Boss伤害＋阶段／擦弹／小怪／道具分），尚无正式两关分数上限，不能复用单关331700或旧14400HP归一分母。

继续使用现有`api.start`／`api.submit`／game.json公开契约。token、可信seed、登录／游客与提交幂等由平台控制；不接收客户端自报辅助、原始P或关间赠送数据作为可信状态。原型PHP的CLI／引导保护请在`IN_DISCUZ`受控加载下适配，保留直接访问保护。当前PR无DB迁移、不改奖励。

## 已验与待你验

用户试玩确认与小典技术检查分别记录：[USER-ACCEPTANCE.json](USER-ACCEPTANCE.json)、[CHECKOUT-VALIDATION.json](CHECKOUT-VALIDATION.json)、[v10验证](../campaign-v10-validation.json)、[v11修正验证](../campaign-v11-validation.json)。19组Node检查包含六式整数确定性、资源／重试／剧情冻结／结算、Hard提前锁定、五级成长、第一关60个实际碰撞夹具；新v11断网浏览器三档入口、一次命中／一次掉落、Easy第一关与三档第二关画布对照通过。v10声音／切关／窄屏检查为上一轮历史证据。

交接制作已在仅包含94份清单依赖与两份测试的独立临时目录重建并核对SHA，证明不依赖本机历史大包。没有为本次交接再自动整关自然通关，真实手机、长期性能、两关PHP、论坛HTTP／DB／榜单／并发、线上缓存及部署未验。

你接入后重点验：按现行SDK原生开局、暂停／失焦／退出生命周期、剧情／祈祷／跨关资源和声音；验证正式记录正常不误判，非法改分／截断／辅助／跨难度／重复提交拒绝或幂等；冷／热资源缓存、嵌入布局与真实手机。通过本地论坛验收后，再从固定提交准备线上包、SHA清单和回滚说明。

本次已授权Github交接，仓库仍为既有公开仓库；没有变更可见性、合并、改论坛／数据库或部署。最新网友包仍为既有Easy v9 RAR及展开目录，不是本次论坛安装包。
