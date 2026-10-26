# STATE · 当前状态

最后更新：2026-10-27

---

## 当前基线

| 项 | 值 |
|---|---|
| 分支 | `main` |
| 当前已合入基线 | main `741bcfe`（PR #9 企划已合入；插件沿用 PR #7）；初始 tag 为 `baseline-2026-10-26` |
| 插件版本 | gamecenter **1.2.0**；memory **2.0.2**；gomoku **0.1.0**；保留原作者署名 |
| 部署路径 | `E:\dzx5-env\www\source\plugin\gamecenter\` |
| 本地站点 | `http://localhost/plugin.php?id=gamecenter` |
| 环境 | Discuz! X5.0.4.Open / PHP 8.3.36 / MariaDB 10.11.19 / nginx 1.30.6（详见 ENVIRONMENT.md） |

**main 始终保持「已验收」状态。** 未验收的东西不许合进来。

---

## 初始入库内容（后续新增见当前计划）

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

1. **已交付基线包含单人异步闭环及五子棋回合制联机**；已有房间接口、事务状态机与三张联机表，共 9 张插件表。多人动作与小广场的实时同步另行规划。
2. **v0 选翻牌记忆配对**，按「最快能验证」定题；**积分填 0**，排行榜只作展示。
3. **作弊面**：`seed` 在前端 → 任何确定性游戏都能被脚本完美游玩，换题材解决不了。这是架构决定的，不靠 `verify.php` 兜。

---

## 进行中 / 待办

- [x] Issue #1 基线源码静态核对、PR #3 文档已合入。
- [x] Issue #2 / PR #4 memory 已交付；PR #5 美术/音效及 main `6f9d080` 的 8 位角色牌面/大厅图标已保留。用户确认已打包交管理员；本次不改 memory/snake。
- [x] **v1a / Issue #6 / PR #7**：候选 `0ee9de8` 经小蓝本地验收后合入 `ef8d4a3`。[验收报告](https://github.com/avgdaren/dz-gamecenter/pull/7#issuecomment-6413129339)记录双人对局、恢复、超时、并发、幂等、权限、触控和旧游戏回归。完整回退未实做，不能写成已通过。
- [ ] **v1b**：对战积分的可恢复结算、独立排行、长期数据清理；本阶段不发积分。
- [x] **raid 企划 / Issue #8 / PR #9**：企划、数值模型、P1 fixture 与 querysafe 回归已合入 `741bcfe`，小蓝确认 45 项模型检查、6 例逐轮独立复核通过；[企划正文](RAID-IMPLEMENTATION-PLAN.md)。
- [ ] **raid P1 / Issue #12 / PR #13**：纯 PHP 规则与单／双席位本机可玩样稿候选，见 [P1 自测与试玩说明](../tests/raid/README.md)。小蓝已对 `a4f1225` 复跑规则 442 项、2000 组差分、HTTP 192 项、前台状态 66 项，并完成真实 Chromium 逐轮／视口／深浅色／恢复验收；[回执](https://github.com/avgdaren/dz-gamecenter/pull/13#issuecomment-6420781736)。据回执修复操作提示被统一文案和 GET 覆盖的问题，前台回归增至 83 项（44 POST、同时在途 1）。用户随后确认 `0b9220c` 文案复验和回归通过；基础玩法已获正向反馈，新增表现与真实两账号体验见下条。无数据库升级，尚未接入论坛联机。
- **P1 后续反馈处理（2026-10-27）**：用户确认 `0b9220c` 文案复验和回归通过、认可基础玩法；[三条体验反馈与自然截止证据](https://github.com/avgdaren/dz-gamecenter/pull/13#issuecomment-6421600754)。已补等待上限说明、连续两轮未确认提醒、本地 Web Audio／伤害与恢复数字／守护和破绽反馈；HTTP 194、前台 97（52 POST、同时在途 1）、表现与模拟音频 40 项通过。PHP 引擎、数值、fixture 与数据库未改；新表现试听／Chrome／真机仍待验，真实联机等待和大厅由 P2 实现。角色候选与产品策略见 [处理文档](raid/P1-PLAYTEST-RESPONSE.md)，最终插画仍在 P3。

---

## 当前验证与阻塞

- PHP/JS/JSON、31 项规则/权限、31 项前台离线状态测试通过。
- 小蓝已在真实站点完成备份、1.2.0 升级/三表创建、扫描与开放；发现 querysafe 拦截会话变量查询，临时改为 SHOW 后建房成功（PR #7 留言）。
- 正式候选已修复该查询；原隔离测试遗漏的 querysafe 现按官方默认开启。旧代码先复现失败，修复后 PDO / mysqli 各 2278 项断言通过，含各 1000 组落子竞争、200 组截止竞争与真实死锁重试。隔离测试不等同于本地 Discuz 验收；本次无额外数据库迁移。
- 小蓝已给出本机 Discuz/PHP 8.3.36/MariaDB 10.11.19 的实机报告，正式修复后上述对局、权限、触控与旧游戏项目通过。
- 五子棋容量报告：40 已登录页面持续 600 秒、12000 请求全成功、20 QPS、p95 50.5ms。报告未提供同期普通页 p95/worker 内存细项，完整回退未执行；保留边界，不阻塞下一款企划。
- 用户已按“单人比双人难 2–3 个点”定案；据 [PR #9 数值留言](https://github.com/avgdaren/dz-gamecenter/pull/9#issuecomment-6418945175)固定 P1 为单人首领 120/恢复 3、双人首领 130/每人恢复 2，其他基础数值不变。规则版本 `raid-v1-p1-balanced`，数值不再待拍板，真人体验仍待 P1。
- 离线模型 45 项通过，已定单人有 574 条通关序列，最早 14 轮；所测稳健策略 16 轮胜、剩 14。双人掩护 6 轮胜、19/22、恢复未用。只证明模型，不代表真人胜率或实际手感。
- [P1-REFERENCE.json](raid/P1-REFERENCE.json) 已提供 6 例逐轮预告/动作/血量/恢复/破绽，供 PHP 对照。原版 18 条及上一候选 43 条保留历史比较。
- PR #9 五项工程意见已处理，3 项官方 querysafe 检查此前通过。历史采用两条索引查询后 PHP 合并；[审阅处理与定案](raid/REVIEW-RESPONSE-PR9.md)。企划 v0.3 已通过并合入；P1 规则及本机样稿候选见上方 Issue #12，真实论坛服务仍待 P2。
- raid 的 PHP 规则和本机可玩界面已交 P1 候选；三张新表、论坛接口、最终插画、真人难度与新容量仍待对应阶段实现/验收。P1 样稿不作为已发布游戏，不修改插件版本或上架大厅。

---

## 交接约定速查

- 一条 Issue → 一个分支 → 一个 PR；`main` 只收已验收的
- 每次验收记录：**提交 SHA、环境版本、复现步骤、预期/实际结果、错误日志**
- 部署与回滚必须成对（代码 + 数据库），回滚脚本按需补进 `tools/`
- 本机 git 必须带代理：`-c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897`
