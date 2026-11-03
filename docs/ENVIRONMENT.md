# ENVIRONMENT · 本地开发环境（不含任何凭据）

## 2026-11-03 接手复核

现有 Discuz X5.0.4.Open Release 20261010 / PHP 8.3.36 / MariaDB 10.11.19 / nginx 1.30.6 已在本机重新读取版本；Node 24.19.0、Python 3.12.10 可用。原仓库/部署目录保持不写，用户确认的独立 clone 为 `E:\GPT工作区\dz-gamecenter-handoff`，分支 `codex/issue-60-aquarium-handoff`。实际配置来源、专用隔离库、工具路径和当前测试失败见 [水族馆接手记录](aquarium/CODEX-HANDOFF-1.2.0.md)。**本文下方部署示例仅供历史参考，本轮没有执行，不代表已获部署授权。**

---

> 只写版本、结构与复现命令。**密码、token、cookie 一律不写在这里。**

## 一、版本

| 组件 | 版本 |
|---|---|
| Discuz! | X5.0.4.Open Release 20261010 / MitFrame 1.0（官方简体中文开源版） |
| PHP | 8.3.36 NTS（VC++ 2019 x64） |
| MariaDB | 10.11.19 LTS |
| nginx | 1.30.6 (Windows) |
| 磁盘 | `E:\dzx5-env\`（纯 ASCII 路径，避免中文路径坑） |

## 二、PHP 扩展（已启用）

`gd` `mbstring` `mysqli` `pdo_mysql` `openssl` `curl` `zip` `fileinfo` `exif` `sockets` `bz2` `opcache`

关键 php.ini：

```ini
extension_dir = "E:/dzx5-env/php/ext"
date.timezone = Asia/Shanghai
memory_limit = 512M
post_max_size = 64M
upload_max_filesize = 64M
; opcache：开发期改代码即时生效
opcache.validate_timestamps=1
opcache.revalidate_freq=0
```

## 三、进程拓扑

```
浏览器 → nginx :80 ──fastcgi──> php-cgi 127.0.0.1:9000（1 父 + 4 子）
                                     │
                                     └──> MariaDB 127.0.0.1:3306
```

**php-cgi 以 4 个 worker 运行**（`PHP_FCGI_CHILDREN=4`）：

```powershell
$env:PHP_FCGI_CHILDREN = '4'
Start-Process E:\dzx5-env\php\php-cgi.exe -ArgumentList '-b','127.0.0.1:9000','-c','E:\dzx5-env\php\php.ini' -WindowStyle Hidden
```

启停脚本：`E:\dzx5-env\start.bat` / `stop.bat` / `status.bat`

## 四、站点

| 项 | 值 |
|---|---|
| 站点根 | `E:\dzx5-env\www\` |
| 插件路径 | `E:\dzx5-env\www\source\plugin\gamecenter\` |
| 前台 | `http://localhost/plugin.php?id=gamecenter` |
| 后台 | `http://localhost/admin.php`（后台路由形如 `admin.php?app=admin&platform=system?action=…`） |
| 数据库 | 库名 `discuz`，表前缀 `pre_` |

**凭据请向项目负责人索取，不入库。**

## 五、数据库事实

- 全站 306 张表 **100% InnoDB**，`utf8mb4_unicode_ci`
- 插件自有 6 张表：`pre_gamecenter_game / session / play / best / reward / settle`（DDL 见 `docs/schema/`）
- 事务 API：`DB::begin_transaction()` / `DB::commit()` / `DB::rollback()`
  （`source/class/discuz/discuz_database.php:469-479`，底层转 mysqli/PDO 驱动实现）

## 六、性能基线（2026-10-26 实测）

| 场景 | 结果 |
|---|---|
| 单次页面请求 | 约 130 ms 冷 / 50–80 ms 热 |
| 瞬时并发 20（4 workers） | 墙钟 149 ms，p50 98 / p95 128 |
| 持续 10 QPS × 20s（4 workers） | p50 37 / p95 53 ms，零错误 |
| 同 UID 并发 10（真实登录态） | 游戏中心页 p50 49 / p95 64 ms |
| 同 UID 持续 5 QPS × 10s | p50 35 / p95 51 ms |

压测脚本参考：`tools/` 下按需补充。

## 七、部署与回滚

```powershell
# 部署（从仓库工作副本到站点）
robocopy source\plugin\gamecenter E:\dzx5-env\www\source\plugin\gamecenter /E /COPY:DAT /R:1 /W:1
```

注意：

- 改 PHP 刷新页面即生效，**不用重启服务**
- 涉及数据库结构变更，走插件的 `install.php` / `upgrade.php`，**不要手改库**
- 回滚要**代码与数据库成对**：只回滚代码不回滚库，等于没回滚

## 八、网络

本机 **git 直连 github.com:443 会超时**，所有 git 操作必须带代理：

```powershell
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 <cmd>
```

GitHub API 走系统代理，不需要额外配置。
