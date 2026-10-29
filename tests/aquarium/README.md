# 天使水族馆 A：测试范围与复现

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。

关联 Issue #24。本目录所有worker仅CLI运行，时间/故障/隔离库注入不进入HTTP接口。生产诊断页只使用真实服务器时间。需64位PHP 8.1+（项目目标8.3），Node与Python仅用于开发测试，不是线上依赖。

## 当前状态：禁止覆盖本地1.4.0

小蓝[回执6494171580](https://github.com/avgdaren/dz-gamecenter/pull/25#issuecomment-6494171580)确认旧候选56ac86c在原版X5驱动/querysafe下，真实InnoDB PDO和mysqli各59项通过。这是交接方在隔离库的实测，不是GPT本机结果，也不是当前修订重跑结果。真实站HTTP、浏览器、旧游戏及回退仍未验。

站点已1.4.0、仓库无对应基线；见Issue #26。当前代码还未重基线，不能部署。

## 当前修订在GPT环境的复跑

本轮隔离环境 PHP 8.3.6；没有真实Discuz站点。数据库服务器在创建UNIX套接字时被环境拒绝，不能进行真实InnoDB并发，官方X5驱动/querysafe也未执行。MariaDB二进制成功准备不等于数据库测试通过。

从仓库根目录执行：

```sh
php tests/aquarium/rules.php
python3 tests/aquarium/reference_check.py
python3 tests/aquarium/service_test.py
python3 tests/aquarium/entry_test.py
node tests/aquarium/front_test.mjs
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
| db_test.py | **SKIP** | 无可用原版X5根目录/显式隔离库；未证明真实数据库并发 |

模型结果不能升级为真实站点验收。其他游戏真实站回归、浏览器/手机、容量和完整备份恢复也未验证。

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

**先完成Issue #26的1.4.0源码同步与重基线，再谈真实站升级。** 下述入口仅供后续安全候选本地验证，当前不要覆盖现站。

完成兼容升级后，管理员可直接打开：

`plugin.php?id=gamecenter&mod=play&game=aquarium`

仅有底盘诊断按钮，不是概念图画面：建档、同步、目标升级、占位水域解锁/切换。默认大厅不展示，普通用户即使后台误开放也不能写入。先不要勾选开放。

手工验证刷新/退出重登、两个标签页同时同步/购买、网络丢响应后同步恢复、未登录/无权限、缺formhash、旧start/submit拒绝；检查原游戏不受影响。记录代码SHA和原版X5/PHP/MariaDB版本。
