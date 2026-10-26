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

**当前里程碑：v0 已交付；v1a 五子棋候选待本地验收** —— 详见 [docs/STATE.md](docs/STATE.md)

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


## 五子棋候选版

本分支新增好友五子棋房间与三张联机表，插件候选版本 1.2.0。现有单机 SDK、memory 与 snake 保持原样；部署需要完整插件升级，不能只复制游戏目录。

- 规则、接口、升级与回退：[docs/V1A-GOMOKU.md](docs/V1A-GOMOKU.md)
- 自测结果、隔离数据库测试与小蓝验收：[tests/gomoku/README.md](tests/gomoku/README.md)
- 本轮不发对战积分，不写单机最高分榜；通过本地集成验收后再合入 main。


## 天使讨伐队 P2 论坛联机候选

以 P1 `62bc37536b8078a1584cd72d505d065efc8fe3f5` 为基线，新增论坛单人／双人合作邀请、服务器结算、刷新恢复、幂等和独立结果。插件候选 1.3.0，raid 0.1.0；新增三张独立表，原9表不ALTER，首版不发积分。[Issue #15](https://github.com/avgdaren/dz-gamecenter/issues/15) 对应分支 `feat/issue-15-raid-p2`；以P1分支为PR基线，尚未部署或合并。

- [完整变更、部署／回退与小蓝验收单](docs/raid/P2-HANDOFF.md)
- [隔离测试复现与边界](tests/raid/P2-README.md)
- 用户已选幽月立绘 C；原图尚未入库，本轮保留明确占位，不能称为美术定稿。
