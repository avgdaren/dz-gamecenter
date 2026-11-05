# 天使讨伐令（raid）

规则、界面与音乐：GPT / Codex；1.5.0 并入游戏中心平台：Carinoasd · (C) 2026 Carinoasd

独自或与一位论坛好友组队挑战首领「蚀月魔女 · 幽月」。每轮先看预告，再选择攻击、守护或恢复；每轮最多 30 秒，所有人确认后立即结算。
单人：首领 110 生命、恢复 4 次、最多 18 轮；双人：首领 150 生命、各恢复 2 次、最多 16 轮。每人保存最近十次讨伐记录。

- 独立记录：不进排行榜、不发积分（game.json `"standalone": "raid"`，平台不显示排行与奖励，也不接受 `op=start／submit`）。
- 前端只送行动（`POST op=raid`），战斗全部在服务端结算：`lib/raid.php`（请求与房间）、`lib/raid_rules.php`（纯规则）、`lib/raid_store.php`（事务）。
- 资料表 `gamecenter_raid_room`／`gamecenter_raid_member`／`gamecenter_raid_action` 由平台的安装／更新建立，卸载时删除。
- `feedback.js`（音效、首领受击表情）、`music.js`（BGM，默认关闭，偏好存在 localStorage `gcr_bgm`）由 `game.js` 自行载入。
- BGM：nene — Boss Battle #9 [Metal]／Boss Battle 10 [Metal]，CC0（来源与授权依原作者提供的说明）。
