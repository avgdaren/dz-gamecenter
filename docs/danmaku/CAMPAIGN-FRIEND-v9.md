# 两关Easy网友测试版 v9

2026-11-16，小典 / Codex；原型 `(C) 2026 Carinoasd`。

后续交接实查：原ZIP已不在，当前为[网友RAR](<E:/GPT工作区/output/天使弹幕祭/网友试玩包/天使弹幕祭demo-两关Easy-试玩v9.rar>)及同名展开目录。展开内容校验同v9，RAR自身未重新解压复验；详情见[当前文件记录](friend-v9-current-files.json)。下文保留原ZIP打包时的验证数据。

用户明确要求“打包一份网友测试版”。本轮仅包装当前[素材优化v9](ASSETS-OPTIMIZATION-v1.md)，游戏字节、规则、素材与音乐保持，不另调难度，不接论坛或榜单。

[下载网友ZIP](<E:/GPT工作区/output/天使弹幕祭/网友试玩包/天使弹幕祭-demo-两关Easy-网友试玩-v9.zip>)，35,570,576字节（约35.6MB），SHA256 `bb8d7936e0f27548e27ad28a8edbc35585c934c6bc564acb31d1bedf0ed10039`。

解压后双击`开始游戏.html`，点击“从第一关启程”。两关Easy、六段剧情、三式Boss、关间祈祷、资源继承、练习和检查点重试均保留。内置图像、字体与音乐，断网可玩。包内另附`试玩说明.txt`、`试玩反馈模板.txt`、`版本说明.txt`、`FRIEND-DEMO-MANIFEST.json`，共5文件，中文TXT为UTF-8 BOM／CRLF。反馈涵盖Easy定位、两关节奏、弹幕／演出辨识与加载／缺声问题；允许不通关或只填部分。

`开始游戏.html`与当前v9逐字节相同：47,666,849字节，SHA256 `082205fae9f90313a2f6dfea667adbc5498da73bd82725b8dc152a2d45c6e93c`。游戏规则仍`danmaku-campaign-easy-v5`，表现沿用v8，资源加载修订9。

已查ZIP CRC、5文件内容／哈希、中文文件名UTF-8标记、解压HTML一致性、5份生产源哈希与静态外部资源引用。在隔离断网Chrome打开实际解压出的中文HTML，验证标题、默认Easy／无敌关闭、第一关3命／2B／P0、开场／跳过、自动射击、曲首播放与非零声音、只准备当前曲而备用关卡不解码、暂停冻结。脚本异常与外部请求0；标题截图已查看。报告见[campaign-friend-v9-validation.json](campaign-friend-v9-validation.json)。

未自动整关通关、重新标定难度或验证真实手机；不将本次打包写成新的真人验收。脚本为`package_campaign_friend_v9.py`、`browser-campaign-friend-v9.cjs`。

按既有留存要求，只保留最新网友ZIP v9，旧v4包退役，原SHA元数据保存于工作区`.workspace-maintenance/2026-11-16-friend-v9/`。当前v9、v8回退、原件与独立Normal／Hard保持。本轮未代用户转发、上传、提交或部署。
