# 天使水族馆 A：测试范围与复现

> **2026-11-06 基线切换：** 本分支 `feat/aquarium-1.8.x` 以 `platform/1.8.x`（正式站 1.8.1，`50f24ea`）为基底。
> 服务端沿用 1.8.1 的 `guard()` / `inspect()` / `snapshot()`，下列套件绑的是 1.4.0 分支的实现，**已从本分支移除**：
>
> - `stats.php`：调用 `gamecenter_aquarium_stats::current()`，1.8.1 无此方法（人数刷新已内联在 `snapshot()`，超 10 分钟顺手 `refresh()`）
> - `handoff_validation.php`：验证 1.4.0 分支自研的 `aquarium_state.php` 共用校验层；1.8.1 用 `guard()` 实现，且语义不同——1.8.1 把「展示超量」「数据列 `config_version` 不符」「缺标记」判为 `heal` 并自动修复，不是异常
> - `migrate.php` 与 `tools/`：绑定 1.4.0 的迁移实现，1.8.1 自带迁移与后台「水族馆存档」检查
>
> **本分支已通过**：`shop` 27、`sell` 22、`cap` 17、`stock` 28、`diag_check` 6、`rules` 345、`closepack` 2；前端 `front_test` 29、`decor_layout_test` 51294 断言。
>
> **待补**：针对 `guard()` 三态（`ok` / `heal` / `anomaly`，另含 `other` / `broken`）的专项用例。

> **2026-11-04 Issue #65：** 金币到期刷新与装饰排布修复，前端模型 29 项、可见边界 3,467 组、shop 27 项通过，并做了独立浏览器夹具验证。见[本轮记录与未验证项](../../docs/aquarium/DISPLAY-FIXES-ISSUE-65.md)。未部署论坛。

> **2026-11-03 后续修复已完成本轮本地回归：** 严格校验 359 PASS；PDO/mysqli 的 v2 各 126、迁移各 41、池切换各 45 PASS；360px 布局已修。以[修复记录](../../docs/aquarium/CODEX-FIXES-1.2.0.md)为当前结果。下文首轮失败与更早记录仅保留历史。用户取消真实场景验收；未部署论坛、未改正式玩家数据、未合 main。

## 2026-11-03：1.2.0 当前复现入口

候选基线 `feat/aquarium-release-1@2a974d5`。本轮恢复精确 v2 配置，执行当前专项套件、原版 X5 两驱动隔离库（各 59 PASS）及独立浏览器夹具；存在明确失败，历史统计不可沿用。请先读 [本轮命令、结果和边界](../../docs/aquarium/CODEX-HANDOFF-1.2.0.md)。

新增：`handoff_validation.php`（当前 36 检查/23 失败，保留真实校验缺口）、`release_assets_check.py`（分包字节/解码 450 PASS，需现有 Pillow）、`browser_fixture.php`（回环地址合成玩家，无 DB/Discuz，引擎源码不改）。

**下方旧测试报告是历史资料。1.4.0 为早期插件集成版本，不能作为当前水族馆 1.2.0 的验收结论。**

---

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。

关联 Issue #24。本目录所有worker仅CLI运行，时间/故障/隔离库注入不进入HTTP接口。生产诊断页只使用真实服务器时间。需64位PHP 8.1+（项目目标8.3），Node与Python仅用于开发测试，不是线上依赖。

## 当前状态：1.4.0增量候选，待本地复验

运行基线已由PR #27提供，固定为0d9c1fdb743c2bfd7ae0abb0827b16310baadaae。插件保持1.4.0，不走升级；按[覆盖文件→单表SQL→扫描注册](../../docs/aquarium/DEPLOY-1.4.0.md)在本地测试站复验，默认关闭，未正式上线。e69752b已有小蓝最小闭环实站回执，见[阶段台账](../../docs/aquarium/STAGE-STATUS.md)。

小蓝[回执6494171580](https://github.com/avgdaren/dz-gamecenter/pull/25#issuecomment-6494171580)确认**旧候选56ac86c**在原版X5/querysafe下，真实InnoDB PDO和mysqli各59项通过。这不是当前1.4.0候选的重跑，也不是论坛HTTP验收。

## 当前修订在GPT环境的复跑

本轮隔离环境 PHP 8.3.6；没有真实Discuz站点。数据库服务器在创建UNIX套接字时被环境拒绝，不能进行真实InnoDB并发，官方X5驱动/querysafe也未执行。MariaDB二进制成功准备不等于数据库测试通过。

从仓库根目录执行：

```sh
php tests/aquarium/rules.php
python3 tests/aquarium/reference_check.py
python3 tests/aquarium/service_test.py
python3 tests/aquarium/entry_test.py
node tests/aquarium/front_test.mjs
node tests/aquarium/decor_layout_test.mjs
python3 tests/aquarium/integration_140_test.py
php tests/aquarium/legacy_rules_smoke.php
python3 tests/aquarium/db_test.py
```

PHP不在PATH时，用PHP_BIN指定实际可执行文件供Python调用；规则测试直接用该PHP运行。所有子进程明确UTF-8编码，不依赖Windows GBK或PYTHONUTF8。service_test.py使用os.makedirs创建唯一临时目录并清理；可用GC_TEST_TMPDIR指定可写父目录，默认仓库工作目录。

| 检查 | 本轮结果 | 证明范围 |
|---|---|---|
| PHP / JS / JSON语法、diff空白 | PASS | 语法与文件一致性 |
| rules.php | 345检查 PASS | 纯规则、上限、时钟、余数、升级/切域、81次保底、固定HMAC、排序/指纹、随机分段 |
| reference_check.py | 3600次捕获与独立Python参考一致 | 实际PHP与独立Python的鱼种/金币/首次发现/保底序列 |
| service_test.py | 86检查 PASS，34个并发请求 | PHP多进程+flock**服务模型**；非InnoDB，不验证生产SQL/锁实现 |
| entry_test.py | 17请求 PASS | PHP入口/HTML模型；非HTTP、非Discuz站点 |
| front_test.mjs | 17检查 PASS | DOM模型：禁止连点、响应丢失后只读恢复、不自动重购、隐藏/恢复；非浏览器 |
| integration_140_test.py | 85检查 PASS | 真实PHP入口+DB模型：七游戏通用槽位/chunk保留，水族馆隔离，20表元数据、单表SQL与schema一致；非HTTP/真实DB |
| legacy_rules_smoke.php | 25检查通过，附基线问题 | 七游戏manifest、若干纯规则与负向校验；不覆盖完整游戏生命周期 |
| 扫雷原tests/check.mjs | 20 PASS | 原扫雷校验套件 |
| 记忆游戏原tests/check.mjs | **FAIL：过期v2预期** | 基线测试将已支持v2判为非法；见Issue #28，不冒充PASS |
| db_test.py | **SKIP** | 无可用原版X5根目录/显式隔离库；未证明真实数据库并发 |

模型结果不能升级为真实站点验收。小蓝在e69752b已报告真实浏览器19/19、跨周期/双标签、七游戏页面冒烟及测试档回退演练；完整旧游戏流程/SDK、手机、容量和保留数据的完整备份恢复仍未验证。当前SHA的两驱动59项复跑尚需补证，不能挪用旧SHA结论。

## 真实数据库复跑（小蓝）

仅对专门建立的隔离库运行，库名必须以 _gc_test 结尾。worker会删除并重建**该隔离库内gct_gamecenter_aquarium_save**，不要填正式论坛库。

设置 GC_AQUARIUM_TEST=1、GC_DZ_ROOT=本机原版X5根目录、GC_TEST_DSN=隔离库PDO DSN、GC_TEST_USER、GC_TEST_PASSWORD；凭据只放进运行环境，不写仓库/日志。分别设置 GC_TEST_DRIVER=pdo 和 mysqli 各跑一次：

```sh
python3 tests/aquarium/db_test.py
```

脚本使用调用方本机原始 db_driver_mysqli.php、db_driver_pdo.php 和 discuz_database.php，启用与既有raid套件一致的querysafe。检查幂等DDL、初始化竞争、50轮两进程结算竞争、同版本购买、不透支、旧请求重试、损坏档保留、锁等待重试和连接超时还原。

没有实际运行的脚本仍需本地调试并回报，不假定“提供脚本”就等于通过。若驱动返回、querysafe或SQL不兼容，附环境/命令/报错，修复后复跑。

## 独立参考与冻结

reference.py 是Python标准库的HMAC、pool_hash和完整config_hash参考。它只输出参考，不自动更新生产期望值。生产aquarium_config.php的两个hash是固定常量。

四条HMAC向量已由本轮PHP与Python运行匹配。概率池先按ASCII ID排序；完整config_hash另外覆盖成本、奖励等，防止仅pool_hash保持不变时悄悄热改经济字段。变更测试配置也应生成新版本/常量并复核，正式内容版本不能直接复用测试版本。

## 本地站点与手工复验

**按DEPLOY文档在本地测试站执行三步交付，不运行插件升级。** 下述仅为管理员诊断，不是正式开放。

完成覆盖、单表建表与扫描注册后，管理员可直接打开：

`plugin.php?id=gamecenter&mod=play&game=aquarium`

仅有底盘诊断按钮，不是概念图画面：建档、同步、目标升级、占位水域解锁/切换。默认大厅不展示，普通用户即使后台误开放也不能写入。先不要勾选开放。

手工验证刷新/退出重登、两个标签页同时同步/购买、网络丢响应后同步恢复、未登录/无权限、缺formhash、旧start/submit拒绝；检查原游戏不受影响。记录代码SHA和原版X5/PHP/MariaDB版本。

## 1.4.0原基线发现

[Issue #28](https://github.com/avgdaren/dz-gamecenter/issues/28)：五子棋manifest缺room且无通用rules.php适配器，实际入口模型返回“这个游戏不支持房间”；旧纯规则五连判断通过不代表房间可用。记忆游戏旧套件将版本字符串2列为非法，但verify已支持v2；新冒烟覆盖v1/8、v2/8、v2/15正常及伪造分数拒绝。旧七游戏文件保持原基线，不在此PR修复。上述发现需小蓝实站复核，七游戏验收仍未完成。

## C阶段候选（不会切换当前HTTP配置）

```sh
php tests/aquarium/content_test.php
python3 tests/aquarium/content_reference_check.py
php tests/aquarium/economy_sim.php --seeds=64 --lamp=1500
php tests/aquarium/economy_sim.php --seeds=64 --lamp=1200
```

候选62检查；独立Python对实际PHP两个水域7200捕获一致（7242检查）。模型两价各6策略×64固定种子，共768路线；每回访验证预算恒等/不负债及终值，输出分位数/代表轨迹。JSON为合成输入的可复现报告，不是生产日志。C候选不改foundation默认配置，不创建/迁移测试档，不提供HTTP拨钟；新内容无DB/实站结果。范围与消费策略见[报告](../../docs/aquarium/ECONOMY-SIM-v0.1.md)及[交接](../../docs/aquarium/CONTENT-HANDOFF-v0.1.md)。

## 内容美术资源检查

`python3 tests/aquarium/assets_check.py`（离线开发依赖Pillow）已通过751项：41项主图、79运行WebP、尺寸/alpha/未裁切边框、ID/编号与候选一致、月门洞口、逐文件SHA/Git blob、原7样稿不变。运行图总2837018字节。此结果不等于真实玩家页/手机/性能验收。复导工具tools/export_aquarium_assets.py仅用于制作，服务器使用现有WebP不需Pillow或ImageMagick。
