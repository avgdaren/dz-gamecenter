# 给小蓝｜天使讨伐队 PR #16 · 幽月 C 版正式资源与 P2 复验交接

更新时间：2026-10-27。仓库 `avgdaren/dz-gamecenter`（私有）；PR https://github.com/avgdaren/dz-gamecenter/pull/16 。

## 交接性质

这不是新需求或重新开发。P2 论坛联机候选已在 PR #16，HEAD 基线 `11c7f9586a18c3294d57213b370aa3329f4b8cd8`，base `feat/issue-12-raid-p1`（P1 PR #13 尚待合并/正式验收）。主分支保持已验收基线，严禁自动合并/生产部署。此次任务是：**补齐已选定幽月 C 原图及游戏接入，然后由小蓝在本地 Discuz 真环境复验，结果回传本 PR**。

前次 GPT Work 已完成的 P2 机制与隔离回归不推倒重做，详细见远端 `docs/raid/P2-HANDOFF.md` 和 `tests/raid/P2-README.md`。本包仅含美术增量、源码替换辅助脚本和本交接记录，不含 P2 全部 34 文件的副本。

## 资源证据与目标

原图 `reference/蚀月魔女·幽月(2).png`，1254×1254（用户从资料库补回，已确认选定 C）。

| 文件 | 目标仓库路径 | 规格 | SHA-256 |
| --- | --- | --- | --- |
| 原图 | **交接包 reference/**（需要长期留档时再定入库路径） | 1254×1254 / 3293830 B | `80e3c0366809bf7ebadc699f6860a9f8bc60920b614a843898986202646fb0b7` |
| 战斗图 | `source/plugin/gamecenter/games/raid/assets/boss.webp` | 768×768 / 144764 B（≤250KB） | `36e6a768581150843354fcb1bb4ee08dc1edd94e22991a6775fb38723875117e` |
| 大厅图标 | `source/plugin/gamecenter/games/raid/icon.webp` | 128×128 / 8924 B（≤30KB） | `1717e4c5da954ff7be57940d3f44fd767af78a8020c626c48a979ef3602f1e84` |

战斗图是原画完整缩放；图标从**同一原图**按原图坐标 `[220, 60, 980, 820]` 裁切，保持脸部和弯月发饰可辨识。未重新生成角色、不改人设。

## A. 本地接入步骤（小蓝执行）

1. 备份本地插件代码与测试数据库；查看当前分支、`git status`、`git log -1`。必须在 `feat/issue-15-raid-p2` 对应 HEAD 上操作；若远端 HEAD 已变，先核对增量，**不要强制覆盖或重置已有代码**。
2. 解压本包，在仓库根对应的 Git 工作区执行 `python <解压目录>/apply_youyue.py <本地仓库路径>`。脚本只写入上述资源和源码/文档，并不自动提交、部署或迁移数据库。
3. 逐项检查 `git diff`：`game.js` 将 `assets/boss.svg` 切换 `assets/boss.webp`、移除占位图提示；`game.json` 的 `icon` 切换到 `icon.webp`；`README.md`、美术简报、P2-HANDOFF、STATE、新增 `docs/raid/PR16-YOUYUE-HANDOFF.md` 更新。旧 `boss.svg/icon.svg` 可保留作历史备用，但不再被引用。检查引用路径、资源 200、MIME、深浅背景与缓存刷新。不得修改结算规则、数值、fixture、旧游戏资源或 SDK。
4. 在本地运行 `python -m json.tool source/plugin/gamecenter/games/raid/game.json`、`node --check source/plugin/gamecenter/games/raid/game.js`、必要的 `php -l`；运行 `node tests/raid/forum-front-check.mjs`、`node tests/raid/feedback_check.mjs forum`、`node tests/raid/music_check.mjs forum`、`php -n tests/raid/view.php`，以及 `tests/raid/P2-README.md` 中规定的回归。真实 DB 套件**仅在独立 *_gc_test 库**执行，绝不在生产库运行测试脚本。
5. 自测通过后用已有 Git 代理配置推送**同一 PR #16 分支**，回读新远端 HEAD、文件尺寸和 SHA-256，确认两个 WebP 与本表一致，贴出提交 SHA、测试项、未验项和变更说明。本机 Git 根据 AGENTS.md 带 `-c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897`。不要合并 PR #13/#16。

## B. P2 真实 Discuz 复验（按原交接继续）

- 在**独立测试站**先备份现有插件与数据库，走正常插件 1.3.0 升级流程创建新增三张 InnoDB 表，后台扫描登记 raid；默认关闭，只在测试站开放。不得只复制 `games/raid`。
- 两个不同真实论坛账号分别创建/加入房间（链接打开本身不能占位），每人只控制本人；单人/双人都做逐轮、25秒自然截止、取消/5分钟过期、刷新/断网/同请求 ID 重试、撤退和本轮结束释放资格；跨账号访问/游客/组权限/formhash/关闭游戏后非法调用须拒绝。
- 验证大厅显示的是 `icon.webp`，战斗区显示的是 `boss.webp`；无任何“轮廓占位”字样，原图身份一致；320px/390px 屏幕、深浅主题、长昵称、手机触控 44px、真实头像错误、键盘与 reduced motion，BGM 实机试听和循环衔接。
- 独立最近十次记录、单/双模式、无积分；旧 memory/snake/gomoku 实机回归。40 页面/约 20QPS/10分钟的容量检查及 worker 内存、p95/5xx 依原 `P2-HANDOFF.md` 如实记录。
- 演练**非卸载**回退：先关闭 raid，恢复旧版代码/元数据/缓存，**三张新增表与记录保留**，原九表与历史成绩不丢。不能运行插件卸载作为回退。

## C. 验收回执模板（发 PR #16）

- 提交：PR #16 最新 commit SHA / 测试环境版本 / 当前插件版本 / 分支；完整源码及美术资源 SHA-256。
- 自动化：命令、通过数、失败/跳过项；若无法运行原因需明示。
- 真人联机：场景、账号类型（不贴个人数据）、预期/实际、可复现步骤和日志（脱敏）。
- 美术/音频：大厅与战斗实拍、320/390、移动端、深浅主题、BGM 试听、故障点。
- 数据库升级与非卸载回退：实际结果及备份位置（不公开任何敏感路径或凭据）。
- 结论：`PASS` / `PASS WITH ISSUES` / `BLOCKED`，阻塞项、复现方法及待 GPT 审查问题。

小蓝发出回执后，GPT 再审查真实性、决定修复/复验/合并顺序；**不以这份补丁包替代真实 Discuz 验收**。
