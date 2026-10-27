# 天使讨伐令 · 更名、二阶段BGM与战损差分交接

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-10-27。
基于PR #16候选7a2a196接续，本轮不自动合并/部署。

## 本轮结果

1. 显示名统一改为“天使讨伐令”：game.json、大厅/游戏页动态标题、我的记录硬编码链接、插件元数据描述、原型标题和相关文档。内部gkey仍为raid，房间/邀请/存档不换标识。纯规则源码的历史注释保留原名，不影响玩家展示。
2. 新增二阶段BGM：nene的Boss Battle 10 [Metal]，本地battle-phase2.mp3，511940字节。第一阶段继续原Boss Battle #9。来源/CC0/处理/哈希见BGM-CREDITS.md。
3. 使用单个HTMLAudio元素：按服务端snapshot.preview.phase切换；同阶段轮询不重开；静音切阶段不自动开声；隐藏切阶段只记住选择；恢复/刷新后遵从偏好与首次手势；新房恢复一阶段，终局暂停。切曲先停再换源，不做双播放器叠加。
4. 重做二阶段立绘：愤怒眉眼、张口施法、明显缺损的披肩/袖部、裸露肩臂与红色月蚀，保留内层不透明躯干覆盖。保留月饰侧别、发色/眼色、书与人物识别。一阶段与大厅图标不动。
5. 已压缩成assets/boss-phase2.webp，768x768，159248字节；SHA256 551f7a290c6a757e4827a238851065537203173b989f4eed883340e17b0c623b。运行目录删除旧boss-phase2.png，移除一次性导出脚本。新生成源保留docs/raid/art/youyue-phase2-v2-source.png，不进入运行包。
6. 前端版本0.1.2刷新JS/CSS缓存，无数据库结构/战斗规则/数值修改。

## 自动化与限制

- Node音乐替身：论坛版31项、P1原型19项通过。
- Node体验回归38项，新增真实游戏源对两阶段音乐路径与新房恢复的联动检查；包含立绘加载/失败回退检查。
- 音效59项、五子棋前台31项通过。
- 修改JS/JSON/Python语法与diff检查通过；768px/250KB预算通过。MP3实际解码与峰值检查通过；浏览器/人耳未验。
- 本环境仍无PHP；view.php只改玩家链接中的名称字符串，未执行PHP语法或完整PHP/DB/HTTP回归。之前B段通过对应旧提交，不覆盖本轮改动。

## 小蓝复验

1. 拉取候选完整运行代码，确认游戏名、0.1.2及两个新增运行资源；旧PNG/一次性导出器已移除，不用再跑压缩脚本。manifest每请求读取；如后台列表仍有旧显示，更新插件/游戏管理缓存后复核，不改gkey或重建表。
2. 运行node tests/raid/music_check.mjs forum、experience-check.mjs、feedback_check.mjs forum、原论坛前台与PHP视图套件；php -l source/plugin/gamecenter/lib/view.php。再跑原要求的完整回归。
3. 真浏览器开BGM：一阶段原曲→半血二阶段新曲、二阶段刷新恢复、新房回原曲；同阶段轮询不从头播放。静音进入二阶段仍静音；隐藏/返回、其它媒体占用和播放拒绝提示正常，终局停止。
4. 真耳听新曲音量、切换延迟与循环接缝；当前没有声明人耳验收通过。确认新曲不遮盖攻击/受击音效。
5. 深浅色320/390/桌面检查战损与表情辨识、边缘融入、不遮血条。新WebP加载失败仍保留底图；尊重减少动态效果。
6. 原有单人难度讨论稿继续仅规划，本轮不改。10分钟容量与手机真机触控原未验项保留。

## 立绘生成记录

使用内置imagegen编辑（不是CLI）。以幽月原C图约束身份、以上轮红月差分为编辑目标。提示核心：same adult identity, ornament side, silver-lavender hair/crimson eyes; dramatically furious furrowed brows and open-mouth casting; substantial missing outer cape panels/shredded sleeves exposing shoulders and upper arms; opaque ivory bodice securely covers bust/torso; no erotic pose, gore, text or watermark; red eclipse/deep plum background; square crop.生成后仅做768px缩放与WebP编码，不用代码重画人物。
