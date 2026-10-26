# P2 测试复现

作者：GPT / Codex；原插件 (C) 2026 Carinoasd，私有自用。详细结果与未验范围见`docs/raid/P2-HANDOFF.md`。

## 无数据库检查

在仓库根，PHP必须为8.1+、64位；Windows可把`php`换成本机完整路径，Node24。

```text
php -n tests/raid/rules.php
python tests/raid/differential.py
python tests/raid/http_check.py
node tests/raid/front_check.mjs
node tests/raid/feedback_check.mjs forum
node tests/raid/music_check.mjs forum
php -n tests/raid/view.php
```

Python/Node启动PHP的脚本读取`PHP_BIN`，默认`php`。`forum`参数读取实际`games/raid`音频代码；省略参数仍测原P1样稿。音频替身不证明真实听感、手机权限或无缝循环。

## 真实数据库检查（只能独立测试库）

从你现有的Discuz X5原版目录读取数据库类，测试不会把核心文件复制进插件。需开启pdo_mysql、mysqli；不得把真实站点账号/配置/数据传入测试。

PowerShell示例，连接字符串的库名必须以`_gc_test`结尾，参数填写本机独立测试库；凭据只在进程环境中设置，不写入文件、PR或日志：

```powershell
$env:GC_RAID_TEST='1'
$env:GC_TEST_DSN='mysql:host=127.0.0.1;port=3306;dbname=raid_gc_test;charset=utf8mb4'
$env:GC_DZ_ROOT='E:\dzx5-env\www'
$env:PHP_BIN='E:\dzx5-env\php\php.exe'
# GC_TEST_USER / GC_TEST_PASSWORD 填测试库账号，不在本文提供真实凭据
$env:GC_TEST_DRIVER='pdo'
node tests/raid/db-check.mjs
node tests/raid/forum-front-check.mjs
$env:GC_TEST_DRIVER='mysqli'
node tests/raid/db-check.mjs
```

**db-check与forum-front-check会重建固定前缀gct_的三张讨伐测试表；两个测试串行执行，不要共用并发测试库。** 连接库名校验只是误操作防线，仍须确保该库专用。默认querysafe始终开启，测试原SELECT @@SESSION必须被拒绝的哨兵。测试隔离了真实论坛登录与整站引导，不等同于真实Discuz验收。

`db-worker.php`提供受CLI及显式环境双重限制的测试指令（fixture、损坏状态、锁竞争）；生产插件不包含这些入口。不得将`tests/`部署到Web可访问站点。

驱动来源沿用`tests/gomoku/README.md`中三个固定blob；官方PDO文件的动态属性deprecation保留，PHP CLI可以`-d display_errors=stderr`，确保诊断不混入JSON stdout。不要修改querysafe或关闭测试检查来消除错误。

## 旧游戏回归

```text
node source/plugin/gamecenter/games/memory/tests/check.mjs
node source/plugin/gamecenter/games/memory/tests/game-check.mjs
php -n tests/gomoku/rules.php
node tests/gomoku/front-check.mjs
```

五子棋数据库套件另设`GC_ROOM_TEST=1`后按原README运行；它会重建自己的固定前缀测试表。memory这次只补测试DOM接口，产品JS/素材/SDK未改。snake需小蓝在完整站点实玩并验提交。

## 必须另行实测

真实论坛两账号、权限组、安装升级与非卸载回退、320/390宽和手机、真实头像、实际试听、40页面/20QPS/10分钟及普通页与worker内存。当前环境Chromium下载归档损坏，未完成真实浏览器布局或触控验证。
