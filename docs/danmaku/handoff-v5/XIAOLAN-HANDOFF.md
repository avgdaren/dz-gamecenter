# 小蓝接手：v14独立结算与单立绘标题

2026-11-16，小典 / Codex；原型 (C) 2026 Carinoasd。

主人新增反馈：本地论坛第二关打完没有可见结算／后续预告，标题的Q版主角突兀。本次在已授权的Issue #82／PR #83交接上继续修订，新的入口是本页；不要只拿v13的封面覆盖层。[GitHub状态](GITHUB.json)、[制作说明](../CAMPAIGN-v14.md)、[浏览器报告](../campaign-v14-validation.json)。没有把本次制作写成用户已试玩v14或论坛已更新。

## 已复现的论坛问题

现行论坛仍载入`app-v11.js?v=0.3.0`，旧shadow标题壳＋light campaign结构。原生点击开始后，用局部第二关战后夹具、原生跳过按钮进入`mode=over/status=clear`。`#cover.hidden=false`但计算样式是`display:none`；分数表可见却位于视窗下方（top 1133.64px／viewport 1060px）。详见[FORUM-REPRODUCTION.json](FORUM-REPRODUCTION.json)。此为HTTP局部复现，未修改你的论坛文件或数据库，不等于新版安装验收。

论坛外壳的`.campaign-app-host #cover{display:none!important}`会同时吞掉旧结束／暂停层。单纯加一张预告图不能修复。请把新标题和结算随完整v14入口接入；撤掉对`#cover`的一刀切隐藏，按模式和`hidden`状态显示暂停／准备界面。保留一个Session和一个开始入口，不再先套旧标题壳后切进另一个界面。

## 新入口和资源

- `app-v14.js`替代`app-v13.js`：`mode=over`时令根节点`data-screen=result`，显示独立的`#endcard`；`ending()`只读取既有summary。结束对白读完／跳过后触发，关闭剧情也触发。练习／失败另分类。
- `front-screens-v14.css`替代`title-shell-v13.css`：正式标题只有原主角立绘，没有`title-companion`或`CampaignData.titleCompanion`。结算在原游戏区域展开，分数和按钮无需滚到战场下方寻找；手机单列。
- 结算DOM是`#wrap`内与`#cover`并列的独立`section#endcard`，原`#results`移入该画面；不要漏掉模板结构，只拷贝脚本会缺ID。
- 保留v12规则模块、两关v12视图、原图／音乐／字体许可及原作者署名。线上按已有资源清单提供URL，不把50MB离线HTML当论坛页面嵌入。
- 结算重开／返回／检查点都调用同一Session的现有入口，暂停和返回时的SDK生命周期按你现行平台适配。没有调用新提交接口，没有把客户端分数变成正式成绩。

最终预览：[标题桌面](previews/title-desktop.png)／[结算桌面](previews/ending-desktop.png)／[标题390](previews/title-mobile-390.png)／[结算390](previews/ending-mobile-390.png)／[标题320](previews/title-mobile-320.png)／[结算320](previews/ending-mobile-320.png)／[失败](previews/failure-desktop.png)。分数和用时来自辅助收尾夹具，不是真人通关成绩。

## 精确重建与验证

v14：49,835,255字节，SHA256 **`a0046f2340c6dfc00d15538520fd494bd38bc65f5d915f948a621f7cb6c4bfe5`**。

105份依赖包含固定的v13重建材料和v14入口／CSS／制作脚本。从完整checkout运行：

```text
python tests/danmaku/package_handoff_v5.py --output-dir tmp/danmaku/handoff-v5/review
node tests/danmaku/browser-front-v14.cjs <v14重建HTML完整路径>
```

第一条不依赖历史output、论坛、网络、npm或字体工具，可在仅有依赖文件的目录中重建同SHA。[独立验证](CHECKOUT-VALIDATION.json)。第二条需要Chrome与v13本地基线作Canvas对照；可先用`package_handoff_v4.py`重建v13，放在测试列出的基线路径中。9条原生对白收尾、重开／返回／检查点、失败与练习分类、旧CSS遮罩抑制、390／320、原生音频和6份v13状态／Canvas对照通过；0脚本异常／外部请求。

战斗、计分和规则未改，保留原15组逻辑／60命中夹具的既有证据，不冒称本轮重新整关或长局验证。Easy仍为`danmaku-campaign-easy-v6`，Normal／Hard仍为`danmaku-campaign-normal-v3`／`danmaku-campaign-hard-v3`。两关PHP与正式榜单仍未适配，新规则不混入旧榜。

待你接入后务必从论坛原生开始走到本局收尾，分别核对开启／关闭剧情、返回和重开。新版论坛安装、真实手机、长局性能、两关PHP／榜单／并发和线上部署未验；本次无DB迁移、无核心／公开API改动、不合并或部署、无新网友包。
