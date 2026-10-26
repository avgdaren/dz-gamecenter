# 基线源码核对与阶段决策

日期：2026-10-26  
审查：GPT / Codex  
范围：Issue #1；基线 `5e2044fa244d754d35e0f212ddf1fd730cde9c56`。

## 结论

现有插件具备 v0 单机接入需要的注册、鉴权、开局、重播、排行榜和成绩弹窗能力。v0 可以限定在新增 memory 游戏目录内实现，不需要改 SDK、表结构或 Discuz 核心。具体实现契约见 [V0-MEMORY.md](V0-MEMORY.md)，执行任务为 Issue #2。

本次完成仓库源码静态核对，没有运行 PHP、数据库、浏览器或本地 Discuz。环境性能和冒烟结果来自小蓝已有记录，没有被重新验证。以下“已确认”仅指源码或已入库 DDL 能证明的事实。

## 已核对的入口

| 文件 / 方法 | 已确认事实 | 实现与验收影响 |
| --- | --- | --- |
| `static/gc.js` 的 register / start / submit | 游戏工厂获得 stage 与 api；start 返回 Promise；失败由平台显示弹窗并返回 null | 等开局成功后再接受输入；避免重复点击造成并行开局 |
| `gamecenter.inc.php` 的 start / submit 路由 | 必须 POST 且 formhash 匹配；游戏存在并开放，管理员可预览未开放游戏 | 测试应覆盖无 formhash、游客、会员及管理员预览 |
| `lib/core.php::start()` | 种子为 1～2147483646；游客/受限用户返回 guest；会员获得 token | 以 info.guest 判断是否记成绩，不能只看 api.uid |
| `lib/core.php::start()` | 每 UID 十分钟最多 30 次开局，查询不按游戏过滤 | 篡改与连续测试会共同占用该账号额度；限流拒绝不能算游戏校验缺陷 |
| `gamecenter.inc.php` 与 core::MAX_PAYLOAD | 限制是 serialize 后的 600000 字节，标量转换为字符串 | memory 自行设置更小的操作记录上限；不依赖大载荷空间 |
| `lib/core.php::submit()` | 校验 token 所属账号、游戏、使用状态和 7200 秒有效期；条件 UPDATE + affected_rows 抢占 token | 同 token 只能进入一次后续处理，但失败重试并不保证恢复原提交 |
| `lib/core.php::submit()` | token 在 verify 调用前作废；校验失败和后续异常都不恢复 token | 每条篡改测试重新 start；非法数据修正后不能沿用旧 token |
| `lib/core.php::submit()` | 有 verifier 时采用 verifier 返回的 score；比较客户端 claim 是否一致由游戏 verifier 自行实现 | memory verifier 必须明确拒绝 claim 与重播分数不符，参考 snake |
| `games/snake/verify.php` | 示范版本检查、操作重放、终局和 claim 一致性；可返回 minms | memory 保留这些必要校验，计分不依赖客户端计时 |
| `lib/core.php::put_best / board / rank_of` | 支持 asc/desc；日、周、总榜每 UID 留最佳；同分依 dateline 再依 UID 排序 | memory 用 asc、整数尝试次数；测试以源码的完整排序规则为准 |
| `lib/core.php::sync_games()` | 扫描时新增游戏默认关闭；manifest 没有奖励配置字段 | 本地验收需后台扫描、配置并开放；不在 game.json 虚构奖励字段 |
| `install.php / upgrade.php` | 安装建表，升级包含安装逻辑与扫描 | v0 只扫描新增游戏，无需数据库升级 |
| `docs/schema/gamecenter-tables.sql` | 六张表均声明 InnoDB；best 主键按游戏、档期、UID；reward 无 playid / matchid 唯一键 | 可设计事务方案；现有奖励账本不能直接提供对局级去重依据 |

路径相对于 `source/plugin/gamecenter/`，另注明的 docs 路径相对于仓库根目录。

## v0 的必要配置

memory 使用“完成 8 对所用的配对尝试次数，越少越好”。规则和重播格式固定在 V0-MEMORY.md。

“不发积分”需要同时关闭单局和周榜奖励：后台确认 `credit=0`、`ratio=0`、`weekrewards` 为空。上线前读取配置和会员积分，确认游戏后没有积分变化。奖励由数据库和后台管理，game.json 不能保证这项配置。

重播校验验证过程与分数一致性，不能证明是真人游玩。种子/牌面已在前端，因此本阶段排行榜仅用于链路展示。

## v1 前需要补齐的证据

### 1. 框架数据库封装

AGENTS.md 与 ENVIRONMENT.md 指定事务 API 为 `DB::begin_transaction() / commit() / rollback()`。本轮按该约定设计，不改用手写 START TRANSACTION。

仓库树没有 `source/class/discuz/discuz_database.php`，因此不能把框架封装标为已审源码。请在 v1a 编码前补充脱敏的方法摘录/版本证据，或本地可复现的最小测试，覆盖：

- 事务开始、提交、回滚是否影响同一连接；
- 行锁和条件更新、affected_rows 的行为；
- 死锁 1213 如何暴露给调用层，是否有隐式退出/自动重试；
- 持久连接或重连对事务与命名锁的影响。

证据放在 docs 下即可，不把 Discuz 核心运行文件复制进插件或修改核心。此项不阻塞 v0。

### 2. 奖励结算可靠性

现有 `submit()` 依次消费 token、写 play、更新 best、调用 reward_play，没有包住整条链路的事务或恢复状态机。

`reward_play()` 使用命名锁，但 `DO GET_LOCK(...)` 没有读取并验证获取结果；reward 表没有按 playid/matchid 的唯一约束。数据库写入与 `updatemembercount()` 也未在该函数中表现为一个已核实的原子整体。

`settle_weeks()` 先插入“该游戏/周已结算”的占位记录，再逐人发奖；中途失败后，重试会因为记录已存在而跳过整周。它适合提示现状，不能作为联机可恢复结算的直接保证。

这些是静态发现的可靠性缺口，并非已复现的线上事故。v0 关闭 memory 奖励，不在本轮扩改现有插件。v1b 必须定义 match/participant 的唯一结算标识、状态、重试和补偿，并核对论坛积分更新路径。核心原则是复用积分体系，但对可靠性不足的部分先做适配和验证。

### 3. 容量与竞争测试

沿用当前 PLAN：4 workers；40 个已登录页面、约 20 QPS 持续 10 分钟；轮询 p95 ≤ 150ms；普通页面相对基线和增量阈值不变。

已有 10 QPS × 20 秒页面测试不等同于新增房间接口在 20 QPS × 10 分钟下达标。仓库暂未包含可复现的压测脚本，v1a 需同时交付脚本、账号/房间分布、实际请求率、延迟分位数与资源采样。

死锁可以在数据库内部发生并被有限重试处理；面向验收应检查无未处理死锁、无重复落子或结算、无无限重试。截止时间竞争依据服务端在锁保护内的时间判定，客户端发起时间不作为裁决。

## 部署资料的使用边界

`docs/schema/gamecenter-tables.sql` 是结构快照，含 DROP TABLE IF EXISTS，不可当作现有站点的升级脚本导入。后续结构变化通过插件 install/upgrade 的迁移逻辑实施。

README 现有 robocopy 命令用于代码复制，不提供备份、删除文件同步、数据库迁移或完整回滚。v0 只新增目录，可由小蓝按候选提交部署；v1 前按需补充部署与回退步骤，不在本轮引入额外工具。

## 本次验证记录

- 已读取仓库根 AGENTS、README、PLAN、STATE、ENVIRONMENT，插件开发规范、SDK、路由、核心、安装升级、snake verifier 与六表 DDL。
- 已对照完整仓库树确认审查边界和缺失的框架 DB 封装。
- 未执行 PHP/JS 语法检查、数据库并发、浏览器操作、手机、真实积分和性能测试；本 PR 不含运行代码变更。
- 现有本地冒烟和性能记录仍归属于小蓝的基线证据，不重复记为 GPT 实测。
