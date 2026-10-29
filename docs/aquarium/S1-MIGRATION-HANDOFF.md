# S1 配置与存档过渡 · 实现与验收说明

作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd · 2026-10-29
分支：`feat/aquarium-s1-migration`（基于 PR #37 head `dbc9e32`）
范围：只做「配置迁移 + 维护态」，不含购买/布置/玩家界面（S2–S3）。

---

## 1. 交付内容

| 文件 | 作用 |
|---|---|
| `lib/aquarium_configs.php` | 配置版本登记；`active_version()` 当前仍为 foundation；显式 ID 映射 `id_map()`；维护标记文件 |
| `lib/aquarium_migrate.php` | 迁移核心：统一切点、旧规则结算、ID 重映射、逐行事务、断点统计、全量核对、备份/还原 |
| `lib/aquarium_store.php` | 新增 `save_versioned()`：row 版本列与 JSON 版本在同一条 UPDATE 写入 |
| `lib/aquarium.php` | 默认配置改走 `configs::active()`；新增维护态返回码 `maintenance` |
| `tools/aquarium_migrate.php` | CLI：`dry-run / apply / verify / backup / restore / maintenance` |
| `tests/aquarium/migrate_worker.php`、`migrate_test.py` | 隔离库上的验收（38 项） |

### 命令

```sh
php tools/aquarium_migrate.php --mode=dry-run \
  --dz-root=<原版X5根> --dsn="mysql:host=...;dbname=<库>;charset=utf8mb4" \
  --user=... --password=... --tablepre=pre_ --job=job.json

php tools/aquarium_migrate.php --mode=apply --yes --batch=200 --job=job.json
php tools/aquarium_migrate.php --mode=verify ...
php tools/aquarium_migrate.php --mode=backup --out=backup.json ...
php tools/aquarium_migrate.php --mode=restore --in=backup.json --yes ...
php tools/aquarium_migrate.php --mode=maintenance --value=on|off ...
```

**不默认连接任何库**：`--dsn` 与 `--dz-root` 必须显式给出；`apply/restore` 还要 `--yes`。

---

## 2. 迁移规则

1. **切点 T**：首次运行取 `max(now, 全表最大 updated_ms)`，写进 job 文件；后续运行一律复用，不重取。
2. **旧规则结算**：用 foundation 配置 `settle(save, T)`，沿用旧周期、旧权重、旧 24h 上限；超过上限仍按原规则丢弃，锚点推进到 T。
3. **显式映射**：`test_pond→pond`、`test_bay→bay`；12 条占位鱼按权重/金币完全一致映射到正式 ID。映射表在 `configs::id_map()`，两侧权重或金币不一致会直接拒绝迁移。
4. **保留**：金币、seed、catch_seq、已发现鱼及其时间与计数、保底计数、鱼竿等级。
5. **进度换算**：周期变化时 `floor(old_progress × new_period / old_period)`；当前两版周期相同，等于不换算。
6. **同事务**：`config_version`、`state_json`、`version+1`、`updated_ms` 一条 UPDATE 写入（`save_versioned`），漏改任何一列都会被 `decode()` 判为坏档。
7. **幂等**：已是目标版本的行只校验跳过，不重结算、不改写。
8. **失败不落盘**：未知版本、锚点晚于切点、JSON 损坏、映射缺失，都记失败并保持原档。
9. **job 文件**：源/目标版本不一致时拒绝续跑；游标按 UID 递增，批次边界持久化。

---

## 3. 验收（隔离库，38 项 PASS）

环境：MariaDB 10.11.19 + 原版 X5 `db_driver_pdo/mysqli` + querysafe 默认开启，库名 `gc_aquarium_gc_test`（表前缀 `gct_`）。

覆盖：dry-run 不写库 → 备份 → 分批 apply → 权益保留（seed/catch_seq/金币/发现时间）→ 重复执行幂等 → 未知版本行报失败且不动 → 备份还原回退 → **中断后按游标续跑** → 切点跨运行不变 → verify 全表收尾。

命令见 `tests/aquarium/migrate_test.py` 顶部；需要 `GC_AQUARIUM_TEST=1`、`GC_DZ_ROOT`、以 `_gc_test` 结尾的 DSN。

### 回归

`rules 345` / `reference 3625` / `service 86` / `entry 17` / `integration_140 85` / `front 17` 全部 PASS。

---

## 4. 没做的事（明确未验）

- **HTTP 维护态没在真实站点验**：只验了标记文件开关，站点层要等 S3 一起验。
- 没有把 `active_version()` 切到内容配置：切换意味着旧档全部进入维护态，应与迁移执行同批部署，属上线动作。
- 没跑 PDO/mysqli 两驱动的完整迁移矩阵（只用 CLI 默认驱动跑通）；S5 补。
- 没做真实站点的两标签并发、丢响应、备份恢复演练 —— 归 S5。
- 购买/布置/玩家界面未开始（S2/S3）。
