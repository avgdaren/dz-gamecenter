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

- [ ] GPT 核对本基线：SDK 契约、结算入口、DB 封装能力（三者源码均在仓库内）
- [ ] **v0**：翻牌记忆配对 `memory`（范围与验收见 `PLAN.md` §二）
- [ ] **v1a**：五子棋最小联机（服务端权威状态机 + 短轮询 + 幂等落子 + 并发测试）
- [ ] **v1b**：可验收联机版（独立对局记录、结算去重、清理机制、移动端）

---

## 阻塞点

无。

---

## 交接约定速查

- 一条 Issue → 一个分支 → 一个 PR；`main` 只收已验收的
- 每次验收记录：**提交 SHA、环境版本、复现步骤、预期/实际结果、错误日志**
- 部署与回滚必须成对（代码 + 数据库），回滚脚本按需补进 `tools/`
- 本机 git 必须带代理：`-c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897`
