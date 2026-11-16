# 两关剧情版 · Boss文字精修与版本精简 v7

2026-11-16，小典 / Codex；原型 `(C) 2026 Carinoasd`。

用户已确认v6自机框没问题，要求继续精修Boss框文字和设计，并清理过多留存版本。[当前v7试玩](<E:/GPT工作区/output/天使弹幕祭/当前试玩/danmaku-campaign-easy-v7-offline.html>)为本轮交付：53,949,225字节，SHA256 `9ec0d3a08535be7387d363611a2739baa68aa83afa44cc5be137cb4ebc801758`。右侧“演出回看”可直接查看；本轮没有制作网友包。

## Boss框

旧Boss标题使用系统宋体加粗，招式前缀与长名字挤在一行，姓名、宣告、式号水印和底部小字分散注意力。本轮把姓名与式号整成一行，分开“星雨／星幕”等前缀和主招名；花庭以关卡名作为类别。主名使用实际中等字重、固定字距与测量后的宽度，减少伪加粗和过度缩字。

加入11,012字节、52字符的离线WOFF2标题子集，等待加载后才开放游戏。源自本机Noto Serif SC，使用其OFL许可，静态化为500字重并改名为“Danmaku Spell Serif”；版权与完整许可保存在字体目录和单文件HTML注释中，来源与哈希见[字体审计](fonts/spell-serif-v7/source-audit.json)、[OFL](fonts/spell-serif-v7/OFL.txt)。构建工具仅用于生成这个小文件，不成为游戏运行依赖。

设计上减弱外框与投影、圆润切角，去掉大号罗马数字、竖分隔线、底部重复文案；保留低对比度星环／五瓣底纹，底部改成简洁星仪／铃铛印记。立绘、换式四段节奏及实际战斗不改。

## 已确认内容与验证

自机框的绘制段、`bomb-view-v6.js`及布局保持。断网Chrome两关大招完整Canvas与v6同点逐字节一致；正常铃羽战斗、换式模型及下方自机区域也一致。四个Boss招名均通过测量适配，内嵌字体实际加载成功；四次大招击破阶段时双框分开，光效不覆盖招名。简化动态、320／390px、回看停止、暂停冻结通过，脚本异常与外部请求0；已查看桌面与窄屏截图。完整记录见[campaign-v7-validation.json](campaign-v7-validation.json)。未重跑整关自然通关，也未将技术检查当作真人对新Boss框的验收。

新增`notice-frames-v7.js`、`spell-change-v7.js`、`app-v7.js`，入口`review/CAMPAIGN-v7.html`，打包`tests/danmaku/package_campaign_v7.py`。流程标识仍是`danmaku-campaign-easy-v5`；呈现修订7。剧情、祈祷过场、敌人、弹幕、B规则、素材图片和音乐均保持。

## 输出保留

工作区不再保留所有旧试玩和每轮包。当前留v7、上一版v6回退、最新既有网友包v4，以及内容仍独立的第一关Normal／Hard专项试玩。源码交接、原始图像／MIDI、独有素材与生产报告保留。旧Hard v1／v2包装HTML所需的模拟模块已原样提取成约50KB夹具，原包与提取模块的哈希记录在`tests/danmaku/fixtures/legacy-hard/manifest.json`；8组相同阶段快照对照通过。

过时正式版本和生成副本实际删除，不是再移动进一层归档。旧链接改指向[清理记录](RETIRED-BUILDS-20261116.md)，明确旧二进制已不再保留；不会把旧版本入口悄悄指成新游戏。完整清单、保留文件核对及释放空间见[工作区精简记录](<E:/GPT工作区/.workspace-maintenance/2026-11-16-version-trim/README.md>)。

未验真实手机／长期性能／PHP榜单，未上传、提交、合并或部署。后续继续收Boss框观感反馈，已确认的自机框保持。
