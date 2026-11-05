# memory · 翻牌记忆配对

作者：GPT / Codex。适配 gamecenter（原作者 Carinoasd，(C) 2026）。  
对应 Issue #2；实现依据：仓库 `docs/V0-MEMORY.md`。仅供本私有项目使用。

## 交付范围

仅新增 `games/memory/`。游戏资源版本 1.0.0，重播规则版本 1；不改 SDK、数据库结构或 Discuz 核心。

| 文件 | 作用 |
| --- | --- |
| game.json | 注册信息、升序计分、本地样式与图标入口 |
| game.js | 4×4 配对、暂停、开局与提交状态控制 |
| verify.php | 按 seed 重播，检查操作、终局和分数 |
| style.css / icon.svg | 容器内样式、内嵌 SVG 牌面与大厅图标 |
| index.htm / tests/index.htm | 空目录保护文件 |
| tests/check.mjs | PHP/JS/JSON 检查、固定洗牌向量和重播用例 |
| tests/game-check.mjs | 用真实 SDK 与 PHP 校验器运行离线前台状态测试，无 npm 包 |
| tests/verify-cli.php | 仅供 CLI 的校验器测试适配，HTTP 请求返回 404 |

计分是完成 8 对所用的尝试次数，8～256，越少越好。未完成不提交；相同种子按已确认的 Fisher–Yates 次序洗牌。提交仅含 v、score、moves。

## 部署与回退

1. 把本目录完整复制到测试站 `source/plugin/gamecenter/games/memory/`。
2. 后台重新扫描游戏目录；新增游戏默认未开放，可由管理员预览。
3. 确认 memory 的 `credit=0`、`ratio=0`、`weekrewards` 为空，同时关闭单局和周榜奖励。
4. 开放游戏，用普通账号与游客分别验收；入口 `plugin.php?id=gamecenter&mod=play&game=memory`。

无需执行数据库升级或导入 SQL。奖励配置属于平台后台，game.json 不能替代这项检查。

回退时先在后台关闭 memory，再撤下本次新增目录；无需回滚表结构。保留已有测试成绩，不直接改数据库。

## 可复现自测

在完整仓库根目录运行，要求 Node 与 64 位 PHP 8.3；仅用标准库，无 npm 安装步骤：

```powershell
$env:PHP_BIN = 'E:\dzx5-env\php\php.exe'
node source/plugin/gamecenter/games/memory/tests/check.mjs
node source/plugin/gamecenter/games/memory/tests/game-check.mjs
```

PHP 已在 PATH 时可省略 PHP_BIN。Linux 同样设置 PHP_BIN 后执行以上 Node 命令。

## 自测记录（2026-10-26，GPT 执行）

- **通过**：PHP 8.3.6 CLI、JS 与 JSON 语法检查；verify.php 直接访问保护。
- **通过**：73 个固定种子、合法/非法重播用例，覆盖 8～256 次、篡改分数、错误版本、非法牌位、同牌、已配对牌、未完成、终局后追加、过长/过多记录。
- **通过**：11 组离线前台状态测试，包含连续 10 局、JS/PHP 牌组一致、真实 SDK 提交到 PHP 校验器、个人最佳/榜单刷新调用、异步重复开局、重复翻牌/提交、700ms 展示、手动与模拟后台暂停、上限三条路径、游客、开局拒绝、无效种子与提交失败后新凭证开局。
- **验证边界**：前台测试使用轻量 MiniDOM 和模拟网络，无数据库；不验证实际布局、触控、键盘默认行为或真实论坛权限。PHP 版本与小蓝本地 8.3.36 不完全相同。本环境浏览器进程无法正常启动，浏览器布局和操作未验证。
- **待小蓝验证**：本地 Discuz 扫描上架；桌面/手机、触控/键盘、深浅色、无横向溢出及控制台；游客/会员；真实 token/formhash/限流；入库 verified=1；日周总榜及同分排序；积分不变；正常连玩 10 局；原贪吃蛇回归。

提交失败后不自动重发。平台会在校验前作废 token，网络失败也可能发生在服务端已处理之后；应先在“我的纪录”核对，再重新开局。

---

## 美术素材（v2.0.0 起）

`assets/` 下是 8 张牌面图，均为 320×320 WebP、白底、单张 13–19 KB：

| 文件 | 角色 |
|---|---|
| `claude.webp` | claude |
| `gpt.webp` | GPT |
| `columbia.webp` | 哥伦比亚 |
| `deepseek.webp` | deepseek |
| `chr214.webp` | 214 |
| `sora.webp` | 春日野穹 |
| `rin.webp` | 远坂凛 |
| `asuna.webp` | 亚丝娜 |

`icon.png`（128×128）与 `icon.webp` 为游戏中心大厅卡片图标，取自 `deepseek.webp`。

**素材处理约定（复现方法）**：原图为方形、部分为不透明黑底。处理流程为：边缘 flood fill 去黑底（RGB<48 且与画布边缘连通）→ 居中取正方形 → 缩放到 320×320 → 导出 WebP(q=0.86) → 卡片正面 4px 内边距 + `object-fit: contain` 保证头顶不被裁切。

**版权说明：牌面使用的是二次创作角色图，非本项目原创，仅限本论坛内部小游戏展示使用，不得商用或对外分发。**
