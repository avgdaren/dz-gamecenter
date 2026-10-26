# dz-gamecenter

Discuz! X5「游戏中心」插件的开发仓库 —— 天使动漫游戏中心项目。

> **私有自用仓库，不对外分发。**
> 插件原始代码版权归原作者 **Carinoasd** 所有（各文件头保留 `(C) 2026 Carinoasd`）。
> 本仓库仅在本项目范围内做二次开发，不公开发布、不发布修改版。

---

## 这是什么

在 Discuz! X5 论坛上做「浏览器点开即玩」的小游戏，从**单人打榜**逐步扩到**双人对战**。

- 运行环境：Discuz! X5.0.4.Open / PHP 8.3 / MariaDB 10.11 / nginx
- 部署路径：`<站点根>/source/plugin/gamecenter/`
- 前台入口：`plugin.php?id=gamecenter`
- 后台入口：插件 → 游戏中心 → 遊戲管理

**当前里程碑：准备阶段（源码基线已建立）** —— 详见 [docs/STATE.md](docs/STATE.md)

---

## 目录结构

| 路径 | 内容 |
|---|---|
| `source/plugin/gamecenter/` | 插件完整源码（保持部署时的相对路径） |
| `docs/PLAN.md` | 范围、里程碑、验收标准 |
| `docs/STATE.md` | 当前已验收提交、进行中工作、阻塞点 |
| `docs/ENVIRONMENT.md` | 版本、扩展、部署方式、复现命令（**不含任何凭据**） |
| `docs/schema/` | 插件自有表的 DDL（无数据） |
| `tools/` | 部署 / 回滚辅助脚本（按需增加） |
| `AGENTS.md` | 协作与代码约束（**动代码前先读**） |

---

## 本地部署

本机 git 直连 github.com 会超时，**所有 git 操作必须带代理**：

```powershell
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 clone https://github.com/avgdaren/dz-gamecenter.git
```

部署到本地测试站（`E:\dzx5-env\www\`）：

```powershell
robocopy source\plugin\gamecenter E:\dzx5-env\www\source\plugin\gamecenter /E /COPY:DAT /R:1 /W:1
```

改完直接刷新页面生效（opcache `revalidate_freq=0`），不用重启。

站点启停：`E:\dzx5-env\start.bat` / `stop.bat` / `status.bat`

---

## 开发入口（给要写新游戏/新功能的人）

- 插件自带的开发规范：`source/plugin/gamecenter/DEVELOP.md`（最权威，先读它）
- 前台 SDK：`source/plugin/gamecenter/static/gc.js`（134 行，API 全在这）
- 后端核心：`source/plugin/gamecenter/lib/core.php`
- 最简示例：`source/plugin/gamecenter/games/_example/`
- 带服务端校验的完整例子：`source/plugin/gamecenter/games/snake/`
