# 天使弹幕祭 · 当前交接 v14

## v14结算与标题修订（2026-11-16）

用户本地论坛试玩反馈第二关收尾没有可见结算／后续预告，标题Q版角色突兀。[CAMPAIGN-v14](CAMPAIGN-v14.md)已改为独立结算：真实总分／关卡／用时、“未完待续／TO BE CONTINUED”、重开／返回，失败与练习另分类；标题采用单主角立绘。当前v14、唯一回退v13，保留v12战斗规则。

现行论坛HTTP复现：仍载入v11，结束已进入over／clear，`#cover`被外壳强制隐藏，原分数表在视窗下方。新版未在论坛安装；小蓝应一起替换入口和模板，撤掉旧壳的一刀切隐藏。新接手入口[handoff-v5](handoff-v5/XIAOLAN-HANDOFF.md)，105份依赖可独立重建SHA `a0046f2340c6dfc00d15538520fd494bd38bc65f5d915f948a621f7cb6c4bfe5`。PR／运行提交看[v5 GITHUB](handoff-v5/GITHUB.json)。

9条原生收尾路径、重开／返回／检查点、失败／练习分类、390／320及6份v13状态／Canvas对照通过；无规则改变，不重复整关自然通关或长局验证。真实手机、新版论坛安装、两关PHP／榜单仍未验。以下旧版状态保留为历史记录。

## v13正式封面与交接（2026-11-16）

用户要求继续交小蓝，并恢复之前上线版封面。已完成[CAMPAIGN-v13](CAMPAIGN-v13.md)：星杖立绘／像素角色／星环、三档直选和开始游戏，设置、练习与回看折叠；保留v12死亡复归和大型守卫驻留。当前v13、回退v12。SHA256 `3a182c47920d418bbf6e118f39e8afef6626a5afb74a73d8fd861790a87f47e6`。100份依赖独立checkout重建，15组逻辑／60命中夹具通过，断网浏览器三档入口与6份v12战斗状态／画布对照通过；真机、论坛、整关自然通关未测。

接手入口[handoff-v4](handoff-v4/XIAOLAN-HANDOFF.md)，Issue #82／`feat/issue-82-danmaku-feedback-v13`，已发布[Draft PR #83](https://github.com/avgdaren/dz-gamecenter/pull/83)，运行提交`c50d9e3`；元数据见[GITHUB.json](handoff-v4/GITHUB.json)。不要把旧审阅页直接嵌入论坛。下面保留制作阶段记录，“未推送／当前v12”不是当前交付状态。

## v12交接授权（2026-11-16）

用户明确“交接给小蓝吧”，本轮按Issue #82独立分支`feat/issue-82-danmaku-feedback-v12`，接续原PR #81。最新入口[handoff-v4/XIAOLAN-HANDOFF.md](handoff-v4/XIAOLAN-HANDOFF.md)，实际PR／运行提交与推送状态看[GITHUB.json](handoff-v4/GITHUB.json)。98份依赖可从独立checkout重建当前v12，SHA256 `6a8220cc13b106eed2bd89d0e4cf90b4ec12bce1bde4efaf0e25e6f2e47cd3fe`，新增9组与v11回归6组通过。

此次为交接授权，没有用户再次逐档试玩结果，不冒称v12真人难度／真实设备已验收。小蓝接现行论坛与两关PHP／榜单校验及线上包；小典不改站点／数据库、不合并或部署。以下“本地候选／未推送”等为制作阶段记录，以v4目录最新状态为准。

## v12当前本地反馈候选（2026-11-16）

用户收到两项细节反馈，已实施[CAMPAIGN-v12](CAMPAIGN-v12.md)：两关三档死亡光羽／0.6秒后底部复归／回归后4秒保护／将结束提示；最后一命播完死亡再结算。大型掉B守卫均多驻留3秒，第一关生命周期15秒、第二关13秒；既有攻击、血量与奖励不加量。中型侍从及普通小怪保持。

新入口`output/天使弹幕祭/当前试玩/danmaku-campaign-v12-offline.html`，唯一回退v11；三档整局规则为Easy v6、Normal／Hard v3。新增`player-recovery-v12.js`、`elite-stay-v12.js`、`feedback-flow-v12.js`、`recovery-view-v12.js`及v12入口／两关视图。9组定点与断网浏览器通过，具体见[campaign-v12-validation.json](campaign-v12-validation.json)。没有自动整关自然通关，观感与新手感待用户反馈。

**尚未更新小蓝PR：** PR #81与运行提交933694d仍是已确认v11；本次只修改本地试玩与记录，无推送／部署／新网友包。旧交接94文件清单与SHA仍可独立重建原v11，不用v12规则覆盖历史记录。以下“当前v11”是此前记录，以本节为本地最新状态。

## 用户验收与小蓝交接（2026-11-16）

用户实际试玩当前v11后明确：“我试玩结束了，没什么问题，可以像之前那样交接给小蓝了”。已按既有GitHub流程推送独立分支并建立[Draft PR #81](https://github.com/avgdaren/dz-gamecenter/pull/81)（Issue #80，运行提交933694d），接手入口为[handoff-v3/XIAOLAN-HANDOFF.md](handoff-v3/XIAOLAN-HANDOFF.md)，GitHub状态见[GITHUB.json](handoff-v3/GITHUB.json)。[用户反馈记录](handoff-v3/USER-ACCEPTANCE.json)与[完整checkout验证](handoff-v3/CHECKOUT-VALIDATION.json)分开保存，不把用户反馈推断为所有路线、真实手机或服务器已验收。

94份依赖、53模块可从源码独立重建用户确认的v11，SHA仍为`b2a7a0...366d5ee`。19组Node／60个命中夹具、224JS／111JSON／82Python／28PHP语法通过。两关PHP回放／正式榜单仍未适配，小蓝负责论坛及线上包；小典本次不改站点／数据库、不合并、不部署。以下未推送等状态为先前制作时记录，以交接目录中的最新GitHub记录为准。

## v11当前修正（2026-11-16）

用户指出第一关Normal／Hard小怪仍耐打。确认为v10接续旧档位时漏接共同耐久，旧值32／90／360，现第一关三档统一**1／128／450**：轻型有效命中即破，中大型保留耐久。已交[CAMPAIGN-v11](CAMPAIGN-v11.md)，[验证](campaign-v11-validation.json)。当前入口`E:\GPT工作区\output\天使弹幕祭\当前试玩\danmaku-campaign-v11-offline.html`，49,809,476字节，SHA256 `b2a7a0c4e0420b65a15fa0c6bc7da0de87ffc3fd8bf956fa90f8490cd366d5ee`。唯一回退`历史版本\danmaku-campaign-v10\`；v9旧完整交付已按留存规则退役，原始素材／源代码／报告／网友v9 RAR与展开目录保持。

新增`_danmaku_campaign_draft/difficulty-flow-v11.js`及`app-v11.js`。N／H整局规则变为`danmaku-campaign-normal-v2`／`danmaku-campaign-hard-v2`，原v10源码保持。整局、第一关练习／Boss、阶段替换／重试均适配；Easy及第二关、Boss攻击、五级成长、素材／字体／音乐／演出保持。

本次6组定点与60个实弹碰撞夹具通过，覆盖三档×五级火力×四种弹种、同帧多弹一次击破／掉落、中大型保留耐久、旧攻击／Boss对照及第二关回归。修正版HTML断网Chrome三档实际入口与1HP→0HP／一次掉落通过，Easy第一关与三档第二关定点画布同v10，异常／外部请求0。没有自然整关通关或新真人难度验收，v10其他检查属于历史记录。

复现`test-campaign-mob-fix-v11.cjs`、`package_campaign_v11.py`、`browser-campaign-mob-fix-v11.cjs`。继续按用户反馈推进，不顺手改其他难度／演出或制作网友包；没有部署／推送。以下v10入口、回退及规则为上一轮记录，以本节为准。

## 当前执行状态（2026-11-16）

用户批准计划后，Normal／Hard已并行实现并整合交付，详见[CAMPAIGN-v10.md](CAMPAIGN-v10.md)及[campaign-v10-validation.json](campaign-v10-validation.json)。当前是**两关三难度离线v10**：`E:\GPT工作区\output\天使弹幕祭\当前试玩\danmaku-campaign-v10-offline.html`，49,807,673字节，SHA256 `8ee02c8220c9daa4c6f61c98dd947d660801ad0b7d7faf411b17185947076bf4`。默认Normal，开局前可选Easy／Normal／Hard。唯一回退是`历史版本\danmaku-campaign-easy-v9\`；v8完整交付按既有留存规则退役，源代码和报告保持。

- 第一关各档调用既有Normal r7／Hard r3，原规则不改。第二关N124敌、H140敌；两档96秒、8秒首敌、轻型一击破，资源与五级成长共用。两套独立三式与HP见制作记录，不只是改名或倍率。
- 新源码：`_danmaku_stage02_draft/difficulty-normal-v1.js`、`difficulty-hard-v1.js`、`difficulties-v10.js`；`_danmaku_campaign_draft/difficulty-flow-v10.js`、`app-v10.js`、`stage01-view-v10.js`、`stage02-view-v10.js`、`spell-show-v10.js`、`spell-canvas-v10.js`。原v9源码保持。
- Normal三式：交叶迁径／错庭重瓣／隔庭追响。Hard三式：回卷双风／迟放回庭／三铃错奏。Hard主鸣提前36步锁定、显示方向线、锁后不追踪；延迟转向有提前24步提示。共同演出仍v8，资源准备仍v9；六段28句剧情、100步祈祷、自机大招框及Easy保持。
- 三个铃羽单式练习可直接启动；重开、换练习资源、结束后重开与Boss重试保留所选式。进行中难度锁定，回标题再切。
- 修复过新适配器覆盖五级核心的问题：当前从有效Easy模拟取核心，P13为4级，掉命降一级、回收至P16及复活补B均已验证。不要再用原始三级JSON覆盖实际模拟规则。
- 13组定点、24个高低火力窗口、无击杀发弹上限扫描和隔离断网Chrome通过。Easy两关完整定点会话及Canvas同v9，自机框普通／紧凑Canvas同v9。实际三档／六式、练习重开与检查点、原生声音／移动／B、跨关资源及音乐、旧音频释放、390／320模拟窄屏通过；脚本异常及外部请求0。不是整关自然通关、真实手机、所有路线或真人难度验收。
- 复现：`test-campaign-difficulties-v10.cjs`、`package_campaign_v10.py`、`browser-campaign-difficulties-v10.cjs`。字体工具仅位于tmp制作目录，运行不依赖npm／CDN。新版字体子集在`docs/danmaku/fonts/spell-serif-v10/`，原字形／500字重/OFL保留。
- **尚未线上接入：** 正式两关PHP回放与榜单未制作，本轮没改论坛／数据库、推送Git或部署。`资源优化候选/`仍为旧线上一关Easy／Normal候选。不要把新两关Normal／Hard写成已经上线。
- **既有网友包不变：** v9 RAR（`bccee476...4969d`）与展开目录保持，原ZIP已不存在，RAR档自身仍未重新解压复验。本轮无新网友包。

后续优先收avg达人的Normal／Hard真人试玩反馈，按具体问题调整。Easy铃羽、自机框、已确认演出与等待不顺手改；第三关仅剧情线索，制作需另获用户任务。源码现有大量未提交内容保留，不重置、不新建工作树。

## 以下为v9阶段交接存档

以下“当前v9／回退v8／等下一任务”仅记录上一阶段，当前状态以上方v10为准。

2026-11-16，小典 / Codex；原型 (C) 2026 Carinoasd。

## 新对话交接状态

用户表示本轮“告一段落”，明确要求新开对话继续项目。本轮只整理与创建接续对话；下一会话先读本文件、仓库AGENTS.md和PRODUCTION-CONTRACT-v1.md，简短确认接手，等待用户下一项具体任务，不自动扩展关卡、重做制作计划、打包、自然通关或部署。

交接前实查：此前生成的网友ZIP已不在原位置。当前保留`E:\GPT工作区\output\天使弹幕祭\网友试玩包\天使弹幕祭demo-两关Easy-试玩v9.rar`（36,164,269字节，SHA256 `bccee476be9b7986a1bce4048bf5032390e0219f0cc954aaa4a4c59765d4969d`）及同名展开目录。展开目录4份载荷文件均与原FRIEND-DEMO-MANIFEST一致，游戏HTML与当前v9的`082205...6e93c`哈希一致；RAR压缩档本身未重新解压复验。实查记录`friend-v9-current-files.json`。原ZIP的CRC／断网启动记录是当时结果，不直接等同RAR验收。保留现有RAR和展开目录，不自动重建ZIP或清理这些用户留存文件。

## 当前执行与反馈

用户已认可v8“没什么问题”，本轮按线上加载／切难度等待反馈完成[素材与加载优化](ASSETS-OPTIMIZATION-v1.md)。当前两关离线v9约47.67MB，SHA256 `082205fae9f90313a2f6dfea667adbc5498da73bd82725b8dc152a2d45c6e93c`，规则仍`danmaku-campaign-easy-v5`，战斗／已确认Boss演出／自机框保持。入口`E:\GPT工作区\output\天使弹幕祭\当前试玩\danmaku-campaign-easy-v9-offline.html`，v8为唯一回退。

线上现有一关Easy／Normal的接入候选在`output/天使弹幕祭/资源优化候选/`，57文件约11.28MB，基于本机当前论坛制作，尚未部署。包括内容哈希静态资源、原MP3清单、按需音频和只读基线检查；两个game.json升0.2.2，原gkey／榜单／规则／PHP校验保持。没有擅自把离线第二关或v8演出接入平台，也没有向小蓝发送消息。先按候选README核对基线与缓存，再由平台维护者接入。

29张无损处理最终减少约22.6%，19张战斗／动作／弹体取样素材保留PNG。原解码RGBA全同；两关合成画面最大通道舍入差1／2，不写成整幅像素相同。BGM未重新编码，拆除Base64脚本表示膨胀并按需缓存。本地HTTP无gzip、相同静态缓存条件下，首屏14.85→4.32MB（−71%），热切Normal共用大素材无新增请求。不是线上已测速度。

`_danmaku_assets_v1/audio-lazy-v1.js`保持音乐计划／循环／混音／事件，首次只准备当前曲，Boss曲后台预备；两关备用音频只解锁，第一关终式预备第二关道中，切关释放旧上下文与缓冲。`app-v9.js`接此流程。构建／检查为`prepare_lossless_assets_v1.py`、`package_assets_optimized_v1.py`、`test-audio-lazy-v1.cjs`、`browser-asset-optimization-v1.cjs`。报告[assets-optimization-v1-validation.json](assets-optimization-v1-validation.json)。原件继续保留。随后用户明确要求，已交[网友测试版v9](CAMPAIGN-FRIEND-v9.md)，约35.6MB；未上传、Git提交或部署。

## v8演出基线（v9保持）

- `spell-show-v8.js`只读现有逻辑时间；`spell-canvas-v8.js`复用认可短样的自有绘制；`notice-frames-v8.js`登记招名避让／大招裁切区，自机绘制段同v7。
- `stage01-view-v8.js`、`stage02-view-v8.js`调整图层；`app-v8.js`取消旧DOM登场牌并增加流程回看。弹幕、预警、Boss小图和自机在大立绘／主题场上方，招名独立保留。
- 第一关180步、第二关390步登场均沿用，宣告占最后120步；四次换式各120步，没有改变开战时间。场景、粒子、法阵与暂停跟随原逻辑时钟。
- 第一关最终击破当步进入战后对白，收束在对白背后定格；读完依旧是100步祈祷过场。第二关仍100步结束段再接战后对白。未加新等待或让对白期间的特效／音乐私自推进。
- 招名避让资源HUD、练习标记及两种已有大招框位置。回看慢放只影响回看；回看含辅助，不是正常连续记录。
- 图像、音乐、字体与v7内嵌哈希一致；旧v7全部源码未改。Noto Serif SC的52字／500字重离线子集继续内嵌，完整OFL和版权保留。

## 验证

本轮8组音频边界检查、29张最终RGBA比较、论坛静态JS语法、原生交互声音／热切Normal／两关定点快照／第二关音乐接续与Boss曲预备／旧音频释放通过。论坛仅版本变化，gkey／api.start与submit／规则／回放／计分校验保持；SDK用本地替身，没有调用实际凭证或成绩接口。浏览器无脚本异常或404。

v8演出验证保留在[campaign-v8-validation.json](campaign-v8-validation.json)，是上一轮记录，不冒称本轮重新整体验收。没有自然整关通关、真实手机、长期性能或线上部署验证；真人手感仍由用户负责。

## 保留与分工

当前v9、唯一回退v8；v7完整HTML按既有留存授权退役，源码／报告保持。最新网友测试内容为v9（现为上述RAR与展开目录），旧v4包已退役，独立Normal／Hard、原始素材和获认可短样保留。维护记录`.workspace-maintenance/2026-11-16-assets-v9/`。不自动重建所有旧包，网友包仅按明确请求制作。旧浏览器脚本依赖已退役二进制时属于历史记录，当前用资源优化脚本对照v8回退。

## 继续制作的基线

- 先读根AGENTS.md与[跨关卡契约](PRODUCTION-CONTRACT-v1.md)。共同画法／演出／危险提示不等于复制出敌数量或Boss招数。
- 第二关96秒、120敌、8秒后入敌；BGM从曲首立即播放，小怪出生2秒首发。轻型敌人有效命中即破，中大型耐久为此前反馈版。
- Easy铃羽风廊／花瓣舒展／铃声回响已获认可，不顺手调招。自机大招仍1B／300伤害／90步清弹／120步无敌与冷却，使用已确认翼形“星翼绽放”框。
- 六段28句[剧情v2](STORY-v2.md)保持。阅读冻结战斗／音乐，s1-after→100步祈祷→s2-open，资源只继承一次；v5短尾页修复保留。
- 铃羽是前辈相熟同辈，因收拾残局窝火而本性不坏；止风种暗示预谋／藏匿对象。“云渊断层”只是第三关线索，未制作第三关或最终揭秘。

本阶段已收口，下一步等用户给出具体任务或网友反馈；没有新问题时不改攻击、难度、资源或已确认自机框。网友包只在用户明确需要时制作。
