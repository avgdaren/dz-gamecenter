# 五子棋自测与小蓝验收

作者：GPT / Codex；Issue #6；2026-10-26。

## 已执行与待执行

| 层次 | 本轮结果 | 边界 |
| --- | --- | --- |
| PHP/JS/JSON | 语法检查通过 | 原生 JS，PHP 8.3.6 CLI，Node 24.22.1 |
| 纯规则/权限 | 31 项通过 | 四方向、长连、边界、防行折返、和棋、到期、非法参数与权限前置 |
| 真实数据库，PDO | 2268 项断言通过 | MariaDB 10.11.14 + 官方 X5 DB 类与 PDO 驱动；1000 组竞争、200 组截止竞争，截止采样偏差最大 13ms；真实 1213 回退后成功 |
| 真实数据库，mysqli | 2268 项断言通过 | 相同测试，使用官方 mysqli 驱动；仅一个落子与动作记录生效，超时和落子互斥 |
| 前台状态 | 31 项通过 | 真实 SDK/游戏代码、离线 MiniDOM/网络；预选、恢复、串行、轮询、退避、丢失确认与同 ID 重试 |
| 真实 Discuz / 浏览器 / 手机 | **待小蓝验证** | 不能由上述隔离测试替代 |
| 40 页面、20 QPS、10 分钟 | **未执行** | 提供 poll-bench.mjs，在真实测试站运行 |

数据库测试使用官方仓库 `DiscuzTeam/DiscuzX` 的 MitFrame_Intl 分支文件，未把核心文件加入本仓库：

- `discuz_database.php` blob `f4b457fcc62692aa93eea1fa31ad5559265030ad`
- `db_driver_mysqli.php` blob `d132f5b011486d61a52f1ac1fc300d5e87fb26a1`
- `db_driver_pdo.php` blob `2ab4985ed557d98d56863e43cefd1e0e371a607e`

`DB::query(..., 'RETRY', true)` 保留原始查询结果并禁止驱动在事务内自动重连。PDO 的 statement errorInfo、mysqli 的 errno 被转换为可捕获错误；事务使用 DB::begin_transaction/commit/rollback，1213/1205 有限重试，事务内锁等待最多 2 秒并在结束后恢复原 session 设置。官方镜像与本机 Release 的一致性仍需对照；镜像 PDO 驱动出现 rowCount 动态属性的 deprecation，属于外部源码，未在本项目修改。

## 基础自测命令

在仓库根目录，使用 64 位 PHP 8.3 与 Node ≥18：

```powershell
E:\dzx5-env\php\php.exe tests/gomoku/rules.php
node tests/gomoku/front-check.mjs
```

前台测试只读现有 SDK，不安装 npm 包，不模拟 CSS 布局或浏览器默认键盘行为。

## 真实数据库自测

创建一个独立空测试库，名称必须以 `_gc_test` 结尾。需要 PDO_mysql 和 mysqli 扩展；提供本机原版 X5 源码目录供测试读取，不把它提交到仓库。

```powershell
$env:GC_ROOM_TEST = '1'
$env:GC_DZ_ROOT = 'E:\dzx5-env\www'
$env:GC_TEST_DSN = 'mysql:host=127.0.0.1;port=3306;dbname=gamecenter_gc_test;charset=utf8mb4'
# GC_TEST_USER / GC_TEST_PASSWORD 从本地安全配置赋值，不写进仓库或报告
$env:PHP_BIN = 'E:\dzx5-env\php\php.exe'
$env:GC_TEST_DRIVER = 'pdo'
node tests/gomoku/db-check.mjs
$env:GC_TEST_DRIVER = 'mysqli'
node tests/gomoku/db-check.mjs
```

测试会重建该隔离库中 `gct_gamecenter_room*` 三表，并创建最小 gct_gamecenter_game 供路由测试；不使用正式 pre_ 表。包含真实对局、认输/等待过期、创建限流、会话/组权限前置、POST/formhash 隔离路由检查、拒绝旧单机 start/submit 伪造、并发占座、动作重放与 1213 恢复。隔离路由的会话全局由测试提供，不等同于真实登录态验收。

## 小蓝本地集成清单

1. 备份现有插件和数据库，执行插件升级入口（见 docs/V1A-GOMOKU.md），确认三张新表均为 InnoDB、已有六表结构及记录不变。升级重复运行不清空数据。
2. 后台扫描并开放 gomoku。确认单机游戏卡片和日周总榜正常；五子棋显示好友约战及独立结果，不显示无意义的单机排行。
3. 两个不同账号创建/加入同一房间；第三人不能读取或占第三座；同账号多标签只占一个座位；用户组限制有效。
4. 完成黑胜、白胜、认输；刷新、关页、重新登录、切后台后可恢复；等待超时和每回合超时由服务端确认。
5. 慢网/断网时不抢跑画棋子。模拟“服务端已成功、响应丢失”，同请求 ID 重试只记录一次。旧版本、重复格子、伪造 UID/棋盘、错误 formhash 被拒绝。
6. 手机 320/390 宽度及桌面、深浅色、触控、键盘方向键/回车/空格、邀请复制、控制台检查。手机重点验收“预选 + 确认”能否避免误触。
7. 真实 PHP worker 下进行重复竞争及截止竞争；关注框架 SQL 安全检查、驱动版本和连接映射。三张房间表必须位于同一事务连接。
8. 若接入已有调度器，可 include `source/plugin/gamecenter/cron/room_cleanup.php`，每轮有界处理 50 个到期房间；未配置调度时，读取房间及创建请求会处理过期。v1a 不自动删除历史。

## 论坛轮询容量

在仓库外保存本地 JSON 配置，字段为 `url`（插件 URL）、`forum_url`（同源普通论坛页）与 40 个 `sessions` 条目；每项包含 `cookie`、`formhash`、`room`。会话和房间由小蓝自己的本地测试账号准备，配置绝不提交。

```powershell
node tests/gomoku/poll-bench.mjs <仓库外的配置路径.json>
```

默认只允许 localhost/127.0.0.1。远程测试站须先确认测试窗口，再显式设置 GC_BENCH_ALLOW_REMOTE=1；脚本不会自动部署或自行获取凭据。

每页面串行轮询，错峰启动；先采无游戏负载的普通页，再跑 40 页面约 20 QPS 和同期普通页，持续 10 分钟，输出成功数、错误数、延迟分位数。另记录实际 PHP worker 数和内存采样。普通页 HTTP 成功不代表内容或登录状态正确，需人工核实。

报告同时记录房间状态分布。测试期间应维持实际对局活动；若多数采样已经终局，只能说明终局读取容量，不能作为活动对局的容量证明。

验收：轮询 p95≤150ms；普通页 p95≤基线 1.5 倍且增量≤200ms；零5xx/超时，进程内存不持续增长。脚本的 latency_checks 仅代表两项延迟条件，不代表整体验收通过。
