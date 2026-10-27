# 天使讨伐令 · 论坛联机候选

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。私有自用。

需完整gamecenter 1.3.0候选及三张独立讨伐表，不能只复制本目录。新局单人110首领生命/恢复4次，双人150/各2次，30秒截止，单人最多18轮、双人16轮。论坛账号邀请合作，每人只控制自己；结果独立保存，不发积分或上单机榜。

前台通过`POST op=raid`，登录/组权限/formhash与房间成员身份由后端核对。原`api.start/submit`不用于本游戏。

- `game.js / style.css`：输入与渲染，无客户端结算。
- `feedback.js / music.js`：短音及独立BGM开关；前者沿用`gcm_sound`，后者使用`gcr_bgm`。
- `assets/battle.mp3`：从P1同一CC0本地文件复制，680272字节；作者nene，Boss Battle #9 [Metal]，出处/处理及许可见仓库`docs/raid/BGM-CREDITS.md`。默认关闭、基准音量0.28、交互后战斗中播放、隐藏/终局暂停；同页媒体让出不代表能侦测其他标签页声音。
- `assets/boss.webp / icon.webp`：用户选定的 C 版《蚀月魔女·幽月(2).png》同源导出。尺寸/哈希及小蓝实机复验见 `docs/raid/PR16-YOUYUE-HANDOFF.md`。

部署、测试、真实环境待验及回退见`docs/raid/P2-HANDOFF.md`和`tests/raid/P2-README.md`。旧批容量、等待过期与非卸载回退已验；本批真实音频88项和浏览器CSS样本通过。新规则版本raid-v3-solo110-p4-duo150-r18，兼容v1/v2旧局按16轮继续；新候选真Discuz/DB/回退与用户单人试听试玩仍待复验，双人真人和手机真机按用户要求不做。完整说明见docs/raid/P2-R18-HANDOFF.md。

