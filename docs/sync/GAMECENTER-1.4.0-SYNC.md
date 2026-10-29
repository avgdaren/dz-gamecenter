# gamecenter 1.4.0 基线同步说明（Issue #26）

同步日期：2026-10-29
同步人：小蓝（本地站验收侧）
同步对象：**本地论坛正在运行的插件目录** `E:\dzx5-env\www\source\plugin\gamecenter`
本分支：`sync/gamecenter-1.4.0`，父提交 `main` `76d226d12fed938d5592b60877d2fb9aadf8cdbd`
分支性质：**只同步源码，不升级、不部署、不改 `main`**。

---

## 一、这份基线是什么

| 项 | 值 |
|---|---|
| 插件定义版本 | `1.4.0`（`discuz_plugin_gamecenter.json`） |
| 文件数 | **121**（不含 `.git`、日志、缓存、数据库数据） |
| 游戏 | 7 个已注册 + 2 个模板：`gomoku` `memory` `minesweeper` `raid` `reversi` `snake` `tetris`，模板 `_example` `_longexample` |
| 数据表 | **19** 张 `pre_gamecenter_*`（结构见 `docs/sync/gamecenter-1.4.0-tables.sql`，**无任何业务数据**） |
| op 白名单 | `start` `submit` `room` `chunk` `save` `load` `delsave` `raid` |

### 构成（三条来源）

1. **上游 gamecenter 1.4.0** —— 论坛管理员提供的原版；
2. **天使讨伐令增量** —— 我们的 raid 功能叠在 1.4.0 上，改动量为 `gamecenter.inc.php` 9 行 + 新增 5 个文件（`lib/raid*.php`、`games/raid/`）。依据：`_上游140\delta-说明.md`；
3. 其余为本仓库既有内容（memory / minesweeper / gomoku / snake 及其素材）。

> 因此严格说，这条分支是 **「上游 1.4.0 + 讨伐令增量」**，不是纯净的上游 1.4.0。版本号仍写 1.4.0，因为线上就是这样跑的。

---

## 二、相对 `main` 的差异

以 **git 存储内容**为准（`git diff main...HEAD`）：

```
新增 22 个文件 / 修改 18 个文件 / 删除 0 个
```

**新增 22**

- 插件 18 个：
  - `cron/cron_gamecenter_room.php`（房间定时任务入口）
  - `games/_longexample/`（长局分段示例：game.js / game.json / verify.php / index.htm）
  - `games/reversi/`（6 个文件）
  - `games/tetris/`（8 个文件，含 `miku-forms.png`）
- 同步材料 3 个：`docs/sync/GAMECENTER-1.4.0-SYNC.md`、`gamecenter-1.4.0-tables.sql`、`manifest-1.4.0.txt`
- `.gitattributes`（强制 LF 检出，见 §四）

**修改 18**

`DEVELOP.md`、`admincp.inc.php`、`discuz_plugin_gamecenter.json`、`gamecenter.inc.php`、`install.php`、`uninstall.php`、`upgrade.php`、
`lib/core.php`、`lib/raid.php`、`lib/room.php`、`lib/room_store.php`、`lib/view.php`、
`static/gc.css`、`static/gc.js`、
`games/raid/{game.js,game.json}`、`games/snake/{game.js,game.json}`

**删除 0** —— 站点目录是 `main` 的超集，因此本次同步**没有任何删除动作**。

> **换行风格说明**：另有 4 个文件（`games/memory/game.json`、`games/memory/verify.php`、`lib/gomoku.php`、`lib/room_schema.php`）
> 在「部署目录 vs 仓库旧工作区」的字节比对里被标为不同，但差异只是 CRLF/LF；git 存储内容与 `main` 一致，因此不出现在 diff 中。
> 同步后工作区已是 LF，与部署目录逐字节相同。

---

## 三、相对 1.3.0 新增的能力（供合并水族馆时对照）

| 能力 | 落点 |
|---|---|
| 槽位存档（客户端权威） | `op=save/load/delsave`、表 `gamecenter_save`（3 槽 / 64KB，`save_put()` 直接落客户端 JSON，服务端不校验内容） |
| 长局分段提交 | `op=chunk`、表 `gamecenter_chunk`、`games/_longexample/` |
| 回放 | 表 `gamecenter_replay` |
| 挑战 | 表 `gamecenter_challenge` |
| 联机对战 | 表 `gamecenter_match`、`gamecenter_rating`、`gamecenter_room_seat`、`cron/cron_gamecenter_room.php` |
| 游戏 ttl / 成绩附加数据 | `lib/core.php` 的 `TTL_MAX_H`、`STATS_MAX` |

**水族馆必须注意**：`save_put()` 是客户端提交整段 JSON、服务端不校验，**不能承载金币/图鉴/保底**；布置类展示态可以考虑复用它。

---

## 四、一致性核对方法（可复现）

`docs/sync/manifest-1.4.0.txt` 是 121 个文件的 `sha256  <相对路径>` 清单，按路径排序，根为 `source/plugin/gamecenter/`。

本次核对结果：

```
同步后仓库目录 vs 站点运行目录：新增 0 / 修改 0 / 删除 0（121 文件全部一致）
```

复现：

```sh
# 任意 sha256 工具，对每个文件生成一行 "hash  path"，按路径排序后 diff
git ls-files -s source/plugin/gamecenter > /dev/null   # 仅提示范围
# 或直接用仓库内清单对比部署目录
```

---

## 五、已知不一致（本次**未修**，保持与线上完全一致）

同步优先保证"仓库 = 线上"，因此以下三处问题原样带入，留给整合 PR 处理：

1. **`discuz_plugin_gamecenter.json` 的 `datatables` 只有 16 项**，缺 3 张讨伐令表（`gamecenter_raid_room/member/action`）→ 插件导出/备份会漏掉 raid 数据。
2. **`uninstall.php` 只 DROP 11 张表**，少 8 张：`room_seat`、`match`、`rating`、`save`、`chunk`、`raid_room`、`raid_member`、`raid_action` → 卸载后会留 8 张孤儿表。
3. **版本号 1.4.0 但含讨伐令增量**，与纯净上游 1.4.0 不同源。

---

## 六、本次验收范围

已做：

- 121 个文件与部署目录逐文件哈希比对：**完全一致**；
- 全部 PHP `php -l`、全部 JS `node --check`、全部 JSON 解析：通过；
- 19 张表结构导出并核对数量（`CREATE TABLE` 19 条，`INSERT` 0 条）。

未做（明确未验）：

- 未执行 `install.php` / `upgrade.php`，未升级、未部署任何站点；
- 未做站点回归（7 个游戏的完整流程）、未做并发/浏览器/手机验证；
- 未验证卸载与备份恢复；
- 未导出任何数据库业务数据、凭据、cookie、缓存或运行日志。
