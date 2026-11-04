# 给小蓝：Issue #17 胜利 BGM

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-10-28。

基线 main `e25c399208610c4a8a7fe09e31fd7a7e2a17cd20`（PR #16 已合并）。独立分支 `feat/issue-17-victory-bgm`；前端 **0.1.13**。不需要数据库升级，不改战斗规则、数值、立绘、打击音效，也不实现 #18/#19。等待真实 Discuz 复验，不自动合并/部署。

## 最终行为

- `status=2`：一／二阶段战斗曲 250ms 淡出；先暂停同一 HTMLAudio，再换 victory.mp3、从零 250ms 淡入并循环。只用一个播放器，重复终局响应不重启曲目。
- 失败、回合耗尽、撤退、取消等待：暂停，不播放胜利曲。再来一局返回一阶段；双人再开局先等待，加入后才播放。
- 关闭 BGM 不因切曲开声；隐藏、pagehide、其他有声媒体抢占时暂停，并取消尚未完成的包络。隐藏期间不会留下一个稍后启动的播放回调。
- 刷新结算页不播放；保留开启偏好者首次普通页面点击／键盘交互后恢复胜利曲。`fresh=1` 大厅不会播放历史结算曲。
- 404／解码失败／play 拒绝均捕获；资源失败保持静音，避免每次点击重试坏文件；新局仍可播放正常战斗曲。浏览器自己可能记录 404 网络诊断，应用没有主动报错或未捕获异常。
- 旧曲的 0.28 增益和 duck 参数保持不变；胜利曲不接收迟到的战斗 duck。game.json 与三条资源 URL 均为 0.1.13。

## 音轨

cynicmusic — Victory Theme for RPG（CC0）。来源、处理脚本与授权见 BGM-CREDITS.md。

| 文件 | 字节 | 解码时长 | 综合响度 | 真峰值 |
|---|---:|---:|---:|---:|
| victory.mp3 | 509118 | 31.75s | -12.35 LUFS | -1.33 dBTP |

SHA-256：`eb85cff324fbef3403006af26d91b445316e1328dc6104848026ebe83fae409f`。

## 实际自测

- `node tests/raid/music_check.mjs forum`：PASS 67；包含 250ms 两段包络采样、取消、静音、后台、恢复、资源故障。HTMLAudio 替身，不等同浏览器。
- `node tests/raid/experience-check.mjs`：PASS 193；生产 game.js 的状态映射、普通交互、成功／失败／撤退／取消、再开局和 fresh 大厅；脚本接口 + MiniDOM。
- `python tests/raid/music-assets-check.py`：PASS 13；三条实解码音轨，-13 至 -12 LUFS、真峰值 ≤-1.0dBTP、三曲差 ≤0.5LUFS、预算、胜利时长和边界去点击。输出见 reports/victory-bgm-20261028.json。
- `node tests/raid/music_check.mjs`：历史样稿 PASS 19，样稿仍用原来的播放器逻辑。
- `node tests/raid/feedback_check.mjs forum`：PASS 89；`node tests/raid/face_check.mjs`：PASS 23。
- JS／Python／JSON 语法和 diff 空白检查通过。

`victory-browser-check.mjs`：Chromium 151.0.7922.34 **PASS 12**，真实 HTMLAudio + 生产 game.js，验证成功播放、再开局、失败／撤退／取消、刷新交互恢复、静音击杀与404。测试使用生产前端与本地 MP3，但接口由脚本服务器提供，不是 Discuz。

## 小蓝复验

1. 正常击杀：旧曲下降后切 victory.mp3?v=0.1.13，只有一个 HTMLAudio，循环开启；再次同步不从头播放。
2. 关闭 BGM 后击杀，全程静音；终局再手动开启能够播放胜利曲。
3. 失败（倒地与18轮耗尽）、撤退、取消等待均无胜利曲。
4. 再来一局：单人切 battle.mp3；双人等待无声，入场后才切战斗曲。
5. 保留 BGM 开启偏好刷新成功结算页：无自动播放；点普通文案或键盘后恢复。
6. 真后台／恢复、切换中静音／再开局、同页其他媒体、404／解码失败；无叠播或未捕获应用异常。
7. 用户试听旋律、情绪、扬声器音量与循环乐句；指标通过不代表听感通过。实机和人耳仍待验证。

真实浏览器脚本可用已有 Playwright 运行（不向项目引入依赖）：`PLAYWRIGHT_MODULE=<已安装模块绝对路径> CHROME_BIN=<Chromium可执行文件> node tests/raid/victory-browser-check.mjs`。默认也支持已有环境的 `playwright`。
