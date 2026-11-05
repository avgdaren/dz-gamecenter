# S2 服务端动作（购买 / 扩容 / 布置）· 实现与验收

作者：小蓝（DSH）· 2026-10-29 · 分支 `feat/aquarium-s1-migration`（同一 PR 追加）

## 1. 新增能力

`lib/aquarium_shop.php`（纯规则，无 IO）：

| 方法 | 说明 |
|---|---|
| `defaults()` | 旧档补齐 `fish_capacity / decor_owned / layout`，槽位按容量补齐或截断 |
| `validateState()` | 容量合法、鱼位只放已发现且不重复、装饰只放已拥有且层匹配、单层不超位、背景合法 |
| `missing()` | 条件差额（金币 / 池塘鱼种 / 总图鉴 / 未解锁水域），供界面置灰 |
| `buy()` | 已拥有返回 `owned` 不扣款；条件不足 `condition`；金币不足 `coins`；成功扣款并记录时间 |
| `expand()` | 下一档容量 + 对应价格，扣款后按新容量补槽位 |
| `setLayout()` | 逐项校验，未知字段一律拒绝 |

服务端（`lib/aquarium.php`）：

- 新增 action：`catalog / buy / expand / layout`，全部要 `expected_version`（catalog 除外），走同一行锁事务；
- 价格、条件、容量、背景全部由服务端配置投影，**客户端不能提交任何价格或币值**，多余字段直接 `input`；
- `snapshot()` 增加 `fish_capacity / decor_owned / layout`，并下发布局与装饰位规则；
- `catalog()` 返回鱼种（是否已发现）、装饰（价格/条件/是否拥有/差额）、容量与背景。

## 2. 未定项的写法

- **装饰位**：`decor_slots_per_layer()` 单点常量（当前 3 → 每层 3、总 6），不是协议。改 4/5 只改这一行。
- **价格**：只从配置读，代码里没有任何价格字面量。
- **容量**：来自配置 `fish_capacities` / `fish_capacity_costs`（4→8→12）。

## 3. 验收

`tests/aquarium/shop.php`：**26 项 PASS**，覆盖默认值补齐、金币不足、成功扣款、重复购买不重扣、水域条件、扩容扣款与槽位、未发现鱼拒绝、重复鱼拒绝、未拥有装饰拒绝、层不匹配拒绝、超位拒绝、背景切换与非法背景、伪造字段拒绝、容量与槽位不一致。

回归：`rules 345` / `service 86` / `entry 17` / `integration_140 85` / `front 17` / `migrate 38` 全 PASS。

## 4. 未验

- 没有真实 HTTP 层验证（要等 S3 页面接上）；
- 没有真实 InnoDB 下的购买并发（`db_test` 仍是 S1 前那套，S5 补布置/购买的并发与丢响应）；
- 旧档（无 layout/decor 字段）只在纯规则层验了补齐，未在真实迁移档上验（S3 接页面时验）。
