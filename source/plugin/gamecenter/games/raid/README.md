# 天使讨伐队 · 论坛联机候选

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。私有自用。

需完整gamecenter 1.3.0候选及三张独立讨伐表，不能只复制本目录。单人120首领生命/恢复3次，双人130/各2次，25秒截止，最多16轮。论坛账号邀请合作，每人只控制自己；结果独立保存，不发积分或上单机榜。

前台通过`POST op=raid`，登录/组权限/formhash与房间成员身份由后端核对。原`api.start/submit`不用于本游戏。

- `game.js / style.css`：输入与渲染，无客户端结算。
- `feedback.js / music.js`：短音及独立BGM开关；前者沿用`gcm_sound`，后者使用`gcr_bgm`。
- `assets/battle.mp3`：从P1同一CC0本地文件复制，680272字节；作者nene，Boss Battle #9 [Metal]，出处/处理及许可见仓库`docs/raid/BGM-CREDITS.md`。默认关闭、音量0.1、交互后战斗中播放、隐藏/终局暂停；同页媒体让出不代表能侦测其他标签页声音。
- `assets/boss.svg / icon.svg`：代码轮廓占位，不是已选C插画；补回用户原图后再换本地WebP。

部署、测试、真实环境待验及回退见`docs/raid/P2-HANDOFF.md`和`tests/raid/P2-README.md`。本候选未完成真实论坛、浏览器布局、手机、容量或完整回退验收。
