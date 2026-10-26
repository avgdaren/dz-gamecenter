# STATE · 当前状态

最后更新：2026-10-26

---

## 当前基线

| 项 | 值 |
|---|---|
| 分支 | `main` |
| 初始基线 | tag **`baseline-2026-10-26`**；本分支已同步 main `6f9d080`，保留 memory 最新美术资源 |
| 插件版本 | 已交付 gamecenter **v1.1.0** + memory **2.0.2**；本分支联机候选 **1.2.0**（原作者署名保留） |
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

1. **已交付基线是单人异步闭环**；本分支新增五子棋房间接口、事务状态机与三张联机表。单机 SDK 及已有游戏不改。
2. **v0 选翻牌记忆配对**，按「最快能验证」定题；**积分填 0**，排行榜只作展示。
3. **作弊面**：`seed` 在前端 → 任何确定性游戏都能被脚本完美游玩，换题材解决不了。这是架构决定的，不靠 `verify.php` 兜。

---

## 进行中 / 待办

- [x] Issue #1 基线源码静态核对、PR #3 文档已合入。
- [x] Issue #2 / PR #4 memory 已交付；PR #5 美术/音效及 main `6f9d080` 的 8 位角色牌面/大厅图标已保留。用户确认已打包交管理员；本次不改 memory/snake。
- [ ] **v1a / Issue #6**：五子棋候选实现完成，待 PR 与小蓝本地验收。规则、接口、迁移和回退见 [V1A-GOMOKU.md](V1A-GOMOKU.md)，自测见 [tests/gomoku/README.md](../tests/gomoku/README.md)。
- [ ] **v1b**：对战积分的可恢复结算、独立排行、长期数据清理；本阶段不发积分。

---

## 当前验证与阻塞

- PHP/JS/JSON、31 项规则/权限、31 项前台离线状态测试通过。
- 小蓝已在真实站点完成备份、1.2.0 升级/三表创建、扫描与开放；发现 querysafe 拦截会话变量查询，临时改为 SHOW 后建房成功（PR #7 留言）。
- 正式候选已修复该查询；原隔离测试遗漏的 querysafe 现按官方默认开启。旧代码先复现失败，修复后 PDO / mysqli 各 2278 项断言通过，含各 1000 组落子竞争、200 组截止竞争与真实死锁重试。隔离测试不等同于本地 Discuz 验收；本次无额外数据库迁移。
- 需小蓝确认本机 Release 的 DB 驱动一致性、实际升级/回退、真实登录与组权限、浏览器/手机体验、既有单机回归。
- 40 登录页面持续 10 分钟的论坛容量仍未验证；脚本与资源采样要求在 tests/gomoku/README.md。
- main 仍是已交付 v0；候选联机代码只在 Issue #6 分支，验收通过后再合入。

---

## 交接约定速查

- 一条 Issue → 一个分支 → 一个 PR；`main` 只收已验收的
- 每次验收记录：**提交 SHA、环境版本、复现步骤、预期/实际结果、错误日志**
- 部署与回滚必须成对（代码 + 数据库），回滚脚本按需补进 `tools/`
- 本机 git 必须带代理：`-c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897`
