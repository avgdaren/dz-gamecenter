# 天使讨伐令 · P2 试玩体验修订交接

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-10-27。

基于 PR #16 分支 feat/issue-15-raid-p2，父提交 4a2f68cff986f8cb85054e6c2f47027f67496e98。
需求来源：https://github.com/avgdaren/dz-gamecenter/pull/16#issuecomment-6432175312

## 本批实现

| 反馈 | 本批结果 |
| --- | --- |
| ① 界面难理解 | 开局与声音按钮分区；移除手动同步，保留自动轮询/失败退避；正常连接提示隐藏，错误仍显示。玩家称呼改为你/队友，记录压缩为轮次伤害与行动两段；伤害飘字挂在血条专用容器。侧栏改为战术提示，不复述规则。 |
| ② 等待房 | 房间号大字显示，分别复制房间号/邀请链接；默认不显示原始URL，剪贴板失败才提供可选文字。倒计时分:秒，说明等待不计战斗用时。过期/取消可一键重新建房。 |
| ③ 30秒 | TURN_MS=30000；16轮最多480秒。同步模型、重生成fixture、PHP规则边界、HTTP/DB截止断言、并发测试时钟、原型按钮与文档。战斗轨迹逐字段比较完全相同，规则版本沿用 raid-v1-p1-balanced。 |
| ④ 音效 | 攻击失真下扫加强，受击78Hz短低频与噪声瞬态，破绽亮上扫加短延迟尾音；原限幅/24声部/静音取消保留。BGM未变。 |
| ⑤ 测试内容 | 两种解释一并处理：移除同步按钮、玩家页面“试玩/不发积分/规则版本”展示；音乐署名保留。未增加积分，后台与结算契约不变。原型辅助仅在tests中，不在论坛入口。 |
| ⑥ 阶段差分 | 本批按交接建议实现零新素材方案：250ms色调过渡、月蚀光晕、红血条、阶段横幅；预留横幅空间避免出现时挤动血条。第二张同构图新立绘仍属P3，未生成、未声称完成。 |
| ⑦ 台词 | 单/双人开场原句、二阶段原句；横幅“月蚀加深，幽月进入第二阶段。”；破绽、胜利、失败台词。总计8类文字（胜利称呼随人数变化）。 |

## 当前环境实际验证

- Python 数值模型运行完成，重生成 P1-REFERENCE.json。
- 新旧 fixture JSON 比较：仅 common.turn_ms 从25000变30000，所有轨迹不变。
- node tests/raid/experience-check.mjs：PASS，30项（脚本化网络响应+MiniDOM）。
- node tests/raid/feedback_check.mjs forum：PASS，55项（AudioContext替身）。
- node tests/raid/music_check.mjs forum：PASS，19项（HTMLAudio替身）。
- node tests/gomoku/front-check.mjs：PASS，31项。
- 修改JS/JSON/Python语法检查与 git diff --check：通过。

**本环境没有PHP、MariaDB、真实Discuz或浏览器布局工具。** PHP套件、DB套件、P1 HTTP/前台和memory完整回归没有通过声明：memory前台执行时因 spawnSync php ENOENT 未能完成。系统软件源不可达，未能安装PHP。PHP语法检查也尚未执行；本候选必须先过下面检查再验收/合并。不得沿用此前提交的全绿数字。

## 小蓝下一步复验

1. 拉取PR分支，只在已备份的本地测试站更新。无新增/修改数据库结构，无插件版本升级要求。已有房间保存的本轮deadline不会被重置；先结束旧房，用新房验30秒。
2. 先跑PHP语法：lib/raid.php、raid_rules.php、view.php及tests/raid/rules.php、prototype/router.php。
3. 跑原完整套件：
   - php -n tests/raid/rules.php（新增25秒仍可提交/30秒拒绝的边界断言）
   - python tests/raid/differential.py
   - python tests/raid/http_check.py
   - node tests/raid/front_check.mjs
   - node tests/raid/experience-check.mjs
   - node tests/raid/feedback_check.mjs forum
   - node tests/raid/music_check.mjs forum
   - php -n tests/raid/view.php
   - node tests/raid/db-check.mjs（PDO及mysqli，各自独立测试库）
   - node tests/raid/forum-front-check.mjs（已适配移除同步按钮、终局台词和隐藏连接提示）
   - memory/gomoku原完整回归。数据库凭据只走进程环境，使用原测试库护栏。
4. 真两账号按fixture完成双人6轮、单人16轮。25秒不结算、30秒自然截止；双方确认齐仍立即结算；连续没选提示、刷新/断网/原ID重试不扣重。
5. 等待房：初始5:00、4:58、0:00到过期，资格释放、旧邀请拒绝、一键重建。分别验HTTPS剪贴板与HTTP失败后选择复制。
6. 320/390、桌面、深浅色与减少动态效果：飘字位于血条、不会遮住回合数；横幅出现不推移布局；长昵称不撑破。低宽度首领区改为上下排布。
7. 耳听音效：打击层次/音量/爆音、静音立即停止、隐藏暂停、重复点击声部上限；BGM试听与循环接缝。替身测试不能代替耳听。
8. 线上交付仅使用source/plugin/gamecenter所需运行资源，不打包根目录tests/docs/开发脚本；本批不新增发布压缩包、不自动合并、不部署。

复验失败请报告具体命令、断言、截图与提交SHA；把通过/未验逐项回传PR #16。
