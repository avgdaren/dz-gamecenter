# 天使讨伐令 · 受击表情、演出与交接收口
作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-10-27。
表情批基于727e7f4，P0修复为3b95b7f/0.1.5；本页保留该批历史记录。

## 最新结论：P0已通过真Chrome，转音效与难度网格

[6442526216复验](https://github.com/avgdaren/dz-gamecenter/pull/16#issuecomment-6442526216)已确认计时器P0修复：p1 30ms出现/218ms隐藏，p2 31ms换套显示，飘字/位移类、reduce与404回退通过；连击取最强仍由替身测试覆盖。六张图片无需重做，手机真机不做。

当前下一批为0.1.6音效候选+72组离线难度扫描，详见[P2-AUDIO-GRID-HANDOFF.md](P2-AUDIO-GRID-HANDOFF.md)。音效真实离线峰值/试听未验；网格NO_MATCH，探索候选未应用。以下旧“待Chrome复验”均为当时状态，已由上述回执取代。

## 727e7f4 复验阻塞与本次修复

- [小蓝复验6442071473](https://github.com/avgdaren/dz-gamecenter/pull/16#issuecomment-6442071473) 确认P0：默认未绑定setTimeout/clearTimeout作为实例方法调用，在Chrome抛Illegal invocation，阻断present后续视觉反馈。此前301项通过仅是所列替身/文件检查，不能说明战斗视觉正常；本次修复仍待真实Chrome复验。
- 默认计时器改成箭头包装，显式通过globalThis调用设置与清除，保留注入计时器的测试接口。game.json升0.1.5，使view.php的feedback.js版本查询更新，避免复验沿用旧缓存。
- face_check从14增加到23项：原14项保留；新增不注入计时器的默认路径、真实Node计时/主动清除/自动复位、要求全局接收者的宿主模拟、第二次受击，以及分别恢复旧set/clear默认值时必须报错的两条反向检查。宿主模拟不是Chrome验收。
- face-assets-check缺Pillow时输出JSON SKIP、checks=0和python -m pip install Pillow提示并退出0；SKIP不等于PASS。真实图片37项PASS，python -S禁用site-packages实测SKIP。
- 本轮针对性回归：表情23、真实图片37、体验93、音效62、音乐31，合计246项；JS/JSON/Python语法通过。不重复更改六张已通过图片、单人UI或已验收BGM。

### 小蓝立即复验

1. 更新完整运行目录与game.json，确认feedback.js请求?v=0.1.5，控制台无Illegal invocation；无需数据库升级。
2. 两阶段ready后≤50ms显示表情、200ms窗口复位（220ms已隐藏）、连击取最强不续时、第二次受击；动态reduce、404回退与换房清除。
3. 确认飘字节点实际创建，首领位移/闪光、破绽、阶段、胜负视觉均执行，控制台无异常；新SFX耳听仍待验。
4. 运行face_check.mjs（23项）和原论坛/PHP回归；图片脚本若SKIP按提示装Pillow，或明确记录等价核对，不能计为PASS。

以下为0.1.4原批交付与历史自测记录；真实浏览器视觉结论以上述P0及后续复验为准。

## 本批交付

- 六张局部表情层已生成、导出、接入，14–20KB/张，总103660字节；两套三档均明显可辨。768px、quality88、两阶段独立ROI、14px羽化，无收缩、无位移。详见art-brief-face-layer.md与art/faces/manifest.json（每张SHA256、质量、对照图路径）。
- 整图编辑与脚本mask出层，edited全图/掩膜/脚本/提示记录/六张三联图和强度对比都在docs/raid/art/faces。运行包仅收assets内六张WebP，docs/tests不进包。
- RaidFaceLayer包含在既有feedback.js中，不增加PHP脚本加载项。固定200ms窗口，取最强、换阶段/房间/隐藏清除；预加载就绪立即显示，未就绪/错误退回零素材反馈；reduce下禁止显示。
- 单人局（进行中及终局）隐藏加入表单、房间面板/房间号；保留两个模式入口，进行中置灰。等待房仍可直接换模式；历史“返回当前讨伐”移到房间面板外，避免单人历史隐藏后失去返回入口。
- 新增首领120ms位移/90ms闪光、600ms飘字、确认攻击前摇、阶段横幅/交叉淡化/红色脉冲、破绽两次描边脉冲、胜利金色晕光/失败静态灰度、6秒呼吸。新增DOM仅一个portrait包裹和一个face img（两层），效果用伪元素。关键帧只动transform/opacity；受击滤镜/失败灰度是短暂或静态状态，不做filter插值。reduce禁用动画与脸层。
- 音效拆为确认时的挥击与结算命中，保留同轮攻击/受击；≥21实际伤害使用更低频重命中，首领重击有55Hz/10ms前置，破绽上扫；压限-18dB/ratio6/attack3ms/release150ms、24声部上限、静音取消保留。BGM本批不再更改，旧音乐耳验已收口；新SFX仍需听。
- music-assets-check兼容性：FFmpeg找不到报SKIP/退出0；stderr为空、JSON在stdout、噪声花括号均支持；解析失败明确FAIL并输出前200字符诊断，不把失败写成通过。可设FFMPEG_BIN，含空格Windows路径由参数数组传递。

## 已有证据已同步，不再反复当未验

- 评论6440541460：小蓝4a1092e真Discuz/Chrome复验；视图10、音乐31、体验92、论坛前台192通过；20QPS×613秒同会话混合请求12019次全200、0超时，p95 93.1ms，worker内存稳定。它不是40个独立登录会话的等价证据。
- 评论6440829777：用户确认BGM音量/循环接缝没问题，正式收口。
- 非卸载回退此前在6436646907通过；手机真机不做，320/390仅布局兜底。
- P2-HANDOFF已改相应验收项，历史原交付未验记录保留历史标记，不覆盖新结论。

## 本环境实际自测

- 图像真实文件检查37项：尺寸、RGBA alpha、透明边界/四角、≤40KB、SHA与六张数量。
- 表情生命周期14项（DOM/时钟替身）：预取、就绪即显示、固定200ms、连击最强/不续时、p2、换房、reduce、解码错误。
- 体验93项、音效62项、音乐31项、原型音乐19项、五子棋前台31项。
- 响度解析跨版本6项、真实音轨解码8项；缺FFmpeg实测SKIP。
- 合计301项，外加JS/JSON/Python语法与diff检查。导出对照图逐张目检。
- 无PHP/MariaDB；未重跑完整论坛/DB/HTTP套件。Chromium下载返回损坏归档，浏览器实际opacity/50ms/布局/动画及新SFX听感未验，不能用上述替身冒充。

## 小蓝接续清单

1. 拉取0.1.5候选完整运行目录，确认六张assets均存在、哈希与manifest一致；docs素材不进运行包。无需新表或数据库升级。
2. 跑face-assets-check.py、face_check.mjs、experience-check.mjs、feedback_check.mjs forum、music_check.mjs forum、music_assets_parser_test.py、music-assets-check.py，以及原PHP/DB/HTTP/论坛前台回归。SKIP不等于PASS，真听已过的BGM不反复要求返工。
3. Chrome分别两阶段造成10/20/≥21伤，按art-brief的八条验收：ready后50ms可见、220ms已隐藏、取最强、p2专套、reduce动态/静态均opacity0、404不抛异常有零素材反馈、几何预算、pointer-events不挡点击。
4. 深浅色桌面和320/390窄窗口：首领位移/呼吸/玩家前摇不产生滚动条；飘字不压回合；横幅保留空间；伪元素不遮结果；solo战斗/终局看不到房间UI，模式按钮战斗中置灰/结束后恢复。
5. 耳听新版挥击/命中/重击/破绽，攻击受击同时能听清、静音立即停、无叠爆。BGM保持原已验收的文件/音量。
6. 大厅fresh=1/不恢复旧终局的优化按用户原话留到下一轮，本批未做；“核验功能”仍待指认；单人难度仍只规划。

收到后直接复验回PR，不需要再次搬运提示词或下载后转交素材。
