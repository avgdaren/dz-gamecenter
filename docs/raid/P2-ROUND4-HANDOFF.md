# 天使讨伐令 · 三阶段修复与最终复验交接（0.1.10历史）

> 最新接续见[P2-R18-HANDOFF.md](P2-R18-HANDOFF.md)：保留小蓝0c8af73修复，中央CTA、v3单人18/双人16与旧房兼容已提交。以下v2参数/16轮报告是当时结果。
作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-10-27。

按6443648789执行；当前前端0.1.10。**未合并、未部署；未做真人试玩。** 单人由用户拍板，双人真人试玩按用户要求不做。无插件表结构变化。

## 分开的提交

| 阶段 | commit | 内容 |
|---|---|---|
| 1 | 5762f28 | 圆角、对比度、大厅fresh/邀请/恢复/重开状态机 |
| 2 | d44818a | 只校准音效gain与transfer，真实离线88项通过 |
| 3 | 51400ef | 新容错/失误模型、调参、规则版本与旧房兼容、fixture与PHP对照 |
| 4 | 本文所在提交 | 回归、双人延迟重开补测、截图/哈希及交付说明；补primary悬停对比度 |

三笔代码可以独立对照，不把数值变更塞进音效提交。

## 阶段1：界面与入口

立绘容器14px圆角、overflow:hidden，三层统一裁切；去掉旧径向遮罩，不重做立绘或表情。boss-info显式color:var(--ink)，浅色muted改#6d6a78，深色muted不改。另外回归发现通用hover会把primary背景改浅但仍用浅色字，补primary专用hover保持主题对比度。

真实Chromium 151.0.7922.34 CSS样本四组合（p1/p2×明暗）通过：标题9.676:1；浅色notice/message/turn-help 4.722:1，玩家small 5.189:1；深色分别7.810/6.836:1；primary含悬停通过。圆角14px、overflow hidden、三个img遮罩none、phase-art-ready前后尺寸相同。报告contrast-20261027.json；portrait-phase1/2.jpg为浏览器样本截图，**不是Discuz实站截图**。

大厅标题与开始按钮都带fresh=1。fresh且无room：保持权威指针，但不渲染旧血条、预告、终局；活动/等待房显示“继续｜放弃并开新局”。room优先，按指定房间读取；无fresh刷新照常恢复。入口消费fresh后从地址栏移除，后续刷新按恢复语义处理。

放弃不是清本地指针：等待房串行cancel→create；单人串行retreat→create；双人先确认撤退，等服务器本轮结算后left生效才create。延迟重开意图按UID存入sessionStorage，刷新可继续；未确认操作沿用原request_id，不能提前新建或双发。终局主按钮“再来一局”一次开原模式新局，另有邀请好友/查看记录。

experience-check现131项，含五个入口要求、拒绝放弃不修改房间、单人串行、双人未离场不新建、延迟撤退刷新后再创建。它是生产JS+脚本化传输/MiniDOM，**不是实站入口验收**。

## 阶段2：真实音频测量

用现有feedback-offline.html、真实OfflineAudioContext，44100及48000Hz全部88项PASS；报告audio-levels-20261027.json。先按小蓝建议乘数改gain，重击受击仍差0.19dB，再单独提高该cue gain×1.25；频率、波形、滤波、包络时长不变。transfer上限0.70→0.85，compressor保持threshold -8/ratio6。

| cue | 44.1k实测峰值 dBFS | 目标 |
|---|---:|---|
| swing | -11.593 | -12..-8 |
| attack | -6.299 | -8..-4 |
| attackHeavy | -5.606 | -6..-2 |
| hurt | -7.897 | -9..-5 |
| hurtHeavy | -5.770 | -7..-3 |
| guard | -16.854 | -20..-12 |
| heal | -16.357 | -20..-12 |
| exposed | -15.812 | -20..-12 |
| phase | -16.535 | -20..-12 |
| win / lose / timeout | -15.376 / -12.289 / -20.244 | 原目标均通过 |
| mixed / storm | -1.518 / -1.412 | 有限且峰值≤0.851 |

48k的精确数值另见JSON；不能把表里舍入后的显示值拿来做精度断言。中频与尾音、24声部饱和都保留原断言。**通过的是渲染后数字，不代表音箱/耳机听感通过。** 新音效试听、侧链实际听感仍由用户/小蓝复验。BGM两首原文件、0.28基准及原有音乐控制均未修改。

页面固化为每次音效改动的必验步骤：仓库根运行python -m http.server后打开tests/raid/feedback-offline.html，await window.raidAudioDone或复制window.raidAudioReport。无需npm依赖，不能只跑AudioContext替身就宣布电平通过。

## 阶段3：推荐与应用到源码的参数

| 参数 | v1 | v2 |
|---|---:|---:|
| solo_boss_hp | 120 | 110 |
| solo_potions | 3 | 4 |
| duo_boss_hp | 130 | 150 |
| heal | 28 | 28（不动） |
| round_limit | strict16 | strict16（不引入击退） |
| rules_version | raid-v1-p1-balanced | raid-v2-solo110-p4-duo150 |

采用新A/B指标后达标，才应用到本分支源码；没有部署。网格仍有72行，其中36行strict16参加评分，36行假设击退只作参考、不参加推荐。score使用目标区间的归一化缺口、等权；同分先改动更少，再遵从杠杆优先级保留heal28，最后按固定网格顺序。唯一recommended与上述源码参数一致，distance=0，applied=true仅表示已改仓库源码。

逐杠杆记录在sequential_levers中：基线→solo110→再加第4次恢复→duo150→heal32参考；每个相邻试验只动一个参数。110/3药合法偏离双点31.69%，但保守分母仅24.68%，没过25%；加第4药后保守双点34.29%，p=.8为60.1%，不再需要改治疗。150双人回合变8且单点容错84.375%，符合模型目标。

### 口径写清：不能假定固定15步

单人最优参考按“最早胜利、再最高HP”取，实际13个决策，所以Δ1为26个名义变体、Δ2为C(13,2)×4=312；不是强行写30/420。修改基准行后固定其余后缀；若后缀走完仍在战斗，继续自适应启发式到16轮，不能把“仍在战斗”误记成失败。

主rate保守按**全部名义变体**作分母；非法治疗/无药由规则拒绝，单列invalid，不写成战斗loss，也不算胜利。另列legal_rate，仅以合法执行作分母；推荐用更保守的rate，避免删掉非法变体后虚高。双人用既有掩护线作参考（不冒称穷举最优），8轮×2席位×2其它动作=32个单点变体；额外列不同席位各一处的双点结果。

失误模型明确为合成模型：每个存活席位每轮以p使用自适应合理动作，否则从全部合法动作均匀抽取，含原动作；每个p各2000局，固定seed=20261027。不是实测玩家胜率。

| 指标 | v1 | v2 | 目标 |
|---|---:|---:|---|
| 单人Δ1保守 | 17.857%（5/28） | 76.923%（20/26；另1非法） | ≥60% |
| 单人Δ2保守 | 9.066%（33/364） | 34.295%（107/312；另27非法） | ≥25% |
| 双人Δ1保守 | 79.167%（19/24） | 84.375%（27/32；另3非法） | ≥70% |
| 单人p=1 | 100% | 100% | 100% |
| 单人p=.9 | 62.75% | 83.45% | 参考 |
| 单人p=.8 | 37.3% | 60.1% | 55–65% |
| 单人p=.7 | 20% | 41.4% | 参考 |
| 单人p=.6 | 10.2% | 22.65% | 10–25% |

| v2策略 | 单人 | 双人 |
|---|---|---|
| 盲打 | 0%，第3轮败 | 0%，第7轮败 |
| 固定启发式 | 100%，14轮/30HP | 100%，8轮/9、6HP |
| p=.8失误模型 | 60.1%，成功局均15.157轮/21.002HP | 87.55%，成功局均8.638轮/16.187HP每原席位 |
| 均匀随机（不是新手） | 0.1%=2/2000 | 3.15%=63/2000 |

均值仅成功局；全样本均值、Wilson区间、p全曲线、随机及原始计数在balance-v2-20261027.json。模型PASS不等于玩家手感；单人仍需用户试，双人真人不测。

### 规则版本、旧房与fixture

不是把旧局强制改成新数值。initial默认v2；validate只接受明确v1/v2白名单，按房间保存的版本校验HP/恢复次数。旧活动局、旧等待房开战、旧终局/历史继续使用v1。未知版本拒绝，v2字段伪装成v1也拒绝；历史每行的boss/药次数上限同样按版本，避免第4次恢复让持久化解码失败。旧文案按原房恢复预算显示3，新房显示4。

P1-REFERENCE.json按v2重生成，旧文件原样留P1-REFERENCE-v1.json。fixture-v2-diff.json给出逐轮字段差异；共同前缀的动作逐项完全相同，只因HP/次数/半血阈值产生状态和终止时机差异；所有新旧轨迹均由真实PHP复放核对。4000条随机合法/非法路径（v1/v2各2000）Python↔PHP逐字段对照，共47602回合通过。

不新增表、不清指针、不改旧state_json版本。已装P2表的站点更新运行目录即可；首次P2仍遵照原1.3.0升级流程。

回退纪律：三个提交可分别评审。若只回退调参，**保留双版本解码能力**，将新建默认版本切回v1；已有v2房仍按v2收尾。不要在仍有v2房时直接恢复只认识v1的旧raid_rules.php，否则旧代码会拒读新房。完全回退旧包前须先停止建房、待v2活动/等待房收尾并保留新版本只读解码来读取历史；不能靠改数据库版本号或删表“解决”。该新增v2回退流程尚未在真实DB演练。

## 本环境实际执行结果

| 检查 | 结果 | 边界 |
|---|---|---|
| php -n tests/raid/rules.php | PASS 775 | v2六条fixture+v1全轨迹+拒绝/边界 |
| python tests/raid/differential.py | PASS 4000局/47602回合 | 真实PHP，合法/非法两版对照 |
| python tests/raid/http_check.py | PASS 196 | 真实PHP HTTP/session样稿，非Discuz；本地样稿音轨用未修改的生产BGM副本补齐，只验HTTP Range/MIME/CSP，不是旧样稿音轨素材验收 |
| node tests/raid/front_check.mjs | PASS 112 | 原型DOM子集+真实PHP HTTP |
| node tests/raid/experience-check.mjs | PASS 131 | 生产JS/MiniDOM/脚本化传输 |
| node tests/raid/face_check.mjs | PASS 23 | 计时器/宿主接收者模拟 |
| node tests/raid/feedback_check.mjs forum | PASS 89 | AudioContext替身，不替代88项真实渲染 |
| node tests/raid/music_check.mjs forum | PASS 45 | 音乐/duck生命周期替身 |
| php -n tests/raid/view.php | PASS 11 | 真实view+最小平台替身，大厅双链接fresh |
| php -n tests/raid/version_compat.php | PASS 11 | 真实规则与持久化解码；无DB事务 |
| python tests/raid/music-assets-check.py | PASS 8 | 真实解码/响度/hash |
| python tests/raid/face-assets-check.py | PASS 37 | 真文件规格/hash |
| python tests/raid/balance_grid_test.py | PASS 13 | 新A/B分母、p1一致、未知/边界、排除击退评分等 |
| contrast_check.mjs / 浏览器样本 | PASS 8 / PASS | 指定六类文字四组合及primary悬停，非实站全页 |
| feedback-offline.html | PASS 88 | 真Chromium/真实OfflineAudioContext |
| forum-front-check.mjs / db-check.mjs | **未运行** | 缺GC_RAID_TEST、GC_TEST_DSN、GC_TEST_USER、GC_TEST_PASSWORD、GC_DZ_ROOT；无用户Discuz/隔离库环境，不能冒充通过 |

修改的PHP/JS/Python/JSON/HTML内联JS语法与diff通过；fixture重导字节一致；网格指标复跑一致。资源SHA-256与字节数在resource-hashes-20261027.json，包含未改动运行图片/音轨和两张新增QA截图。

## 小蓝下一步：按真实环境复验

1. 完整更新运行目录，确认0.1.10与新rules_version；保留旧房/旧历史，不卸载、不改表，不覆盖为旧v1版本号。
2. 按总交接列出的完整命令跑回归，尤其补本环境未能执行的forum-front与两驱动隔离库DB套件；增加真实旧等待/活动/历史跨版本复验。
3. 复跑feedback-offline.html核对88项与峰值表，再听攻击/受击同轮、静音立即停、切阶段/隐藏无残留duck。人耳结果由用户拍板。
4. 大厅终局→idle；活动/等待→提示且不丢房；继续/明确放弃分别正确；无fresh刷新；room优先；终局按钮一击重开。双人撤退尚未生效不能提前建房，刷新后也不能重复创建。
5. 真站明暗×两阶段截图、圆角14px/切换不跳；扫全页文本（含悬停），再做320/390布局兜底。既有表情时序/强档/reduce/404回退重验。
6. python docs/raid/balance_check.py --grid > grid.json 2> grid.txt，核对唯一推荐与A/B计数/p=.8数字。单人实机一局由用户决定是否满意；固定启发式14轮/30HP、速攻13轮/24HP是路线参照，不是任意操作都必须落在±1轮。

**未验证**：真实Discuz/DB本候选的集成与并发、新v2回退演练、实站全页对比度与入口、用户单人手感、新音效试听。双人真人和手机真机按用户明确要求不做，不列阻塞。站点首页也有的close_blind噪音不修、不算本插件缺陷。
