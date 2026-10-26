# STATE · 当前状态

最后更新：2026-10-26

---

## 当前基线

| 项 | 值 |
|---|---|
| 分支 | `main` |
| 基线提交 | tag **`baseline-2026-10-26`**（本文件所在提交，`git checkout baseline-2026-10-26` 可复现） |
| 插件版本 | gamecenter **v1.1.0**（原作者 Carinoasd） |
| 部署路径 | `E:\dzx5-env\www\source\plugin\gamecenter\` |
| 本地站点 | `http://localhost/plugin.php?id=gamecenter` |
| 环境 | Discuz! X5.0.4.Open / PHP 8.3.36 / MariaDB 10.11.19 / nginx 1.30.6（详见 ENVIRONMENT.md） |

**main 始终保持「已验收」状态。** 未验收的东西不许合进来。

---

## 本次入库内容

- `source/plugin/gamecenter/` —— 完整插件源码（25 个文件，含 DEVELOP.md、gc.js、core.php、示例与贪吃蛇）
- `docs/schema/gamecenter-tables.sql` —— 6 张自有表 DDL（无数据）
- `README.md` / `AGENTS.md` / `docs/{PLAN,ENVIRONMENT,STATE}.md`

未入库（按约定）：数据库数据、后台/数据库凭据、日志、缓存、运行时文件、整套 Discuz/PHP/MariaDB 二进制。

---

## 冒烟验证（2026-10-26，本地 http://localhost）

| 检查 | 结果 |
|---|---|
| 大厅 `plugin.php?id=gamecenter` | ✅ PASS 200 / 32 ms |
| 游戏页 `&mod=play&game=snake` | ✅ PASS 200 / 29 ms |
| 排行榜 `&mod=rank&game=snake` | ✅ PASS 200 / 29 ms |
| 论坛首页 `forum.php` | ✅ PASS 200 / 33 ms |
| 后台登录页 `admin.php` | ✅ PASS 200 / 49 ms |
| `op=start` 缺 formhash | ✅ PASS 正确拒绝：`页面已过期，请重新整理后再试` |

**另外已验证（截图见项目侧 `_screenshots/`）：**

- 贪吃蛇前台正常渲染（棋盘 / 分数 / 长度 / 速度 / 最佳 / 日周总三榜 tab）
- 点「开始游戏」能进对局（`mod=play` → canvas 渲染，落 30×30 地图）
- 后台插件状态 `available=1` 已启用；游戏管理页可进；贪吃蛇已登记且开放
- 6 张 `pre_gamecenter_*` 表已建，全部 InnoDB

---

## 已知前提（不是缺陷，是架构事实）

1. **平台是单人异步闭环**：没有房间、没有对手状态、没有任何服务端推送，一局只能交一次成绩。→ 联机必须扩插件本体。
2. **v0 选翻牌记忆配对**，按「最快能验证」定题；**积分填 0**，排行榜只作展示。
3. **作弊面**：`seed` 在前端 → 任何确定性游戏都能被脚本完美游玩，换题材解决不了。这是架构决定的，不靠 `verify.php` 兜。

---

## 进行中 / 待办

- [x] GPT 已完成基线源码静态核对（Issue #1，文档 PR 待审）：见 [BASELINE-AUDIT.md](BASELINE-AUDIT.md)。SDK、提交/结算入口与 DDL 已核对；框架 DB 封装源码未入库，相关能力仍需本地证据。此项不代表实机验收通过。
- [ ] **v0 / Issue #2**：翻牌记忆配对 `memory`（范围见 `PLAN.md` §二；规则、计分、重播和验收细节见 [V0-MEMORY.md](V0-MEMORY.md)，待文档 PR 审查通过后按此实现）
- [ ] **v1a**：五子棋最小联机（服务端权威状态机 + 短轮询 + 幂等落子 + 并发测试）
- [ ] **v1b**：可验收联机版（独立对局记录、结算去重、清理机制、移动端）

---

## 阻塞点

- v0 源码接口核对未发现需要改平台的阻塞；当前先审查 Issue #1 对应的文档 PR，再执行 Issue #2。
- v1a 前补充 DB 事务/错误处理封装证据和可复现压测脚本；当前基线有六表 DDL，没有 Discuz 核心 DB 封装源码。
- v1b 不能直接把现有奖励函数视作可恢复且对局级去重的结算接口，需完成专门设计与验证。
- 本轮只做源码静态核对，未运行 PHP、数据库、浏览器、真机或性能测试；既有本地验证仍以小蓝原始记录为准。

---

## 交接约定速查

- 一条 Issue → 一个分支 → 一个 PR；`main` 只收已验收的
- 每次验收记录：**提交 SHA、环境版本、复现步骤、预期/实际结果、错误日志**
- 部署与回滚必须成对（代码 + 数据库），回滚脚本按需补进 `tools/`
- 本机 git 必须带代理：`-c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897`
