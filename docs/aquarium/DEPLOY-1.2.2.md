# 水族馆 1.2.3 · 部署口径（2026-11-06 修订）

> 起因：Carinoasd 在 PR #67 的审查指出「整目录覆盖会让平台退版」。
> **旧的 `说明.md` 写「本包整目录替换 `source/plugin/gamecenter/`」，这条对 1.8.x 站点是错的，已作废。**
>
> 版本口径：本文档原名 `DEPLOY-1.2.2.md`，内容随 1.2.3 更新。**水族馆当前版本是 1.2.3**；
> 1.2.2 → 1.2.3 只多了这一轮审查的修正（诊断日志改 `writelog`、CSS 脏选择器、配置入库、删未引用类、`is_writable` 假阴性），玩法无变化。

---

## 一、先分清站点版本

| 站点插件版本 | 能不能用 1.2.2 的**整目录包** | 说明 |
|---|---|---|
| **1.4.0**（和我们分支同源） | 可以 | 但只在这条线上成立 |
| **1.5.0 以上 / 1.8.x** | **不可以** | 覆盖会退版，见下 |

我们的分支底盘是 `discuz_plugin_gamecenter.json` = **1.4.0**；正式站已是 **1.8.1**。

### 整目录覆盖到 1.8.x 会发生什么

- `games/danmaku`（1.7.0 的天使弹幕）被删，大厅少一个游戏
- `gamecenter.inc.php` / `lib/core.php` / `admincp.inc.php` / `install.php` / `upgrade.php` 退回 1.4.0，1.5.0～1.8.1 的平台修正全部消失
- 插件版本从 1.8.1 变成 1.4.0；Discuz 用字符串比较版本，后台「更新」不会降版 → 出现「文件 1.4.0、数据库 1.8.1」的错位

---

## 二、1.8.x 站点的正确做法（当前**未完成**）

只取水族馆的文件，逐函数合进平台线：

```
games/aquarium/                 ← 可整目录
lib/aquarium*.php               ← 不能直接覆盖，见下
```

### 为什么 `lib/aquarium*.php` 也不能直接覆盖

1.8.1 里 `gamecenter_aquarium::inspect()` 返回 `ok / heal / anomaly`，后台「水族馆存档」分页（`admincp.inc.php` 148、403 行）依赖它。我们的 `lib/aquarium.php` 没有这个函数，直接覆盖会让后台报 `Call to undefined method`。

两边的存档检查已经分岔：

| | 1.8.x | 本分支 |
|---|---|---|
| 入口 | `inspect()` → `ok / heal / anomaly` | `aquarium_state.php` 共用校验 + `migrate_readonly` |
| 后台分页 | 已接入 `inspect()` | 无 |

**待定**：以哪边为准。建议以 1.8.x 的 `inspect()` 为外壳，把本分支的 `aquarium_stock` / `migrate` 判定作为内部实现——后台分页已按三态接好，改我们这边成本更低。

**前置**：1.8.1 源码已由 Carinoasd 推到本仓库的 **`platform/1.8.x`** 分支（`50f24ea`，只含 `source/plugin/gamecenter/`，`main` 未动）。本分支需要 rebase 到该分支后再逐函数合并。

---

## 三、本分支 1.2.3 相对 1.2.1 的内容（合并时别漏）

- PR #61：服务与迁移共用校验、迁移切点固定、手机 360px 鱼缸宽度、干净检出补 v2 配置
- PR #66：金币到期自动结算、装饰自动排开与左右换序
- PR #63：诊断日志改用原生 `writelog`（不再写 `data/diag.log`）、建档人数页面兜底刷新
- 自定义入池音效 `assets/audio/user/sfx_splash_user.{ogg,mp3}`
- 2026-11-05 修正：`style.css` 脏选择器删除、`ACTIVE_CONFIG` 与 `sale-switch.json` 入库、删除未引用的 `lib/aquarium_scenery.php`、`aquarium_stats` 去掉 `is_writable` 假阴性

---

## 三之二、⚠️ 覆盖 `games/aquarium/` 会重置售卖开关

`sale-switch.json` 现在**入库了**（`mode: "off"`）。如果正式站曾被改成 `allowlist` 并加了白名单，下次更新覆盖 `games/aquarium/` 时会**被打回 `off`、名单清空**，而且不会有任何提示。

方向是安全的（回到关闭），但灰度会被打断。**更新前先备份：**

```
source/plugin/gamecenter/games/aquarium/data/sale-switch.json
```

或更新后按原样写回。1.8.x 的交付包同样适用。

---

## 四、数据安全（与平台版本无关，照旧成立）

- 代码里没有任何删除存档的路径
- 校验不通过 → 只读展示，鱼缸照常显示，**不会**出现空缸或「建立我的水族馆」按钮
- 回滚只能用「兼容关闭版」，不能退回旧版（已钓到新鱼的账号会读档失败）

---

## 五、状态

| 项 | 状态 |
|---|---|
| 1.4.0 站点整目录覆盖 | 可用（包：`天使水族馆_正式版_1.2.3_20261105.zip`，SHA-256 `3B7D4EBB…335F8372`） |
| 1.8.x 站点合并 | **进行中**：源码已由 Carinoasd 推到 `platform/1.8.x`，本分支内容待 rebase 后逐函数合并 |
| 1.8.x 站的临时处置 | 不要用本包覆盖；先维持现状 |

### 存档检查的分工（2026-11-06 与 Carinoasd 对齐）

以 1.8.x 的 `inspect()` 为外壳（`ok / heal / anomaly`，另加 `other` / `broken` 两种判定），把本分支的 `aquarium_stock` / `migrate` 判定放进内部。**三态语义保持不变：**

- `heal` 只修可安全自动修复的：展示超量、数据列 `config_version` 不符、缺 `inventory_schema`
- 守恒错误、未知 schema、超出终身上限、装饰容量不合法 → 一律 `anomaly`，转只读

合并时不得让本分支的校验把这些情况降级成 `heal`。
