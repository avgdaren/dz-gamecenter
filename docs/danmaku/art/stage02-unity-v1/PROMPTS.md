# 第二关 · 向第一关对齐的标准姿态源图 v1

2026-11-14，小典 / Codex；原型 `(C) 2026 Carinoasd`。

内置 `image_gen.imagegen` 生成，三次独立请求，真实透明背景。每个角色仅制作一个标准姿态，先进行跨关卡对照，没有扩展四姿态或连续动作。

完整实际提示词与参考文件见 [generation-prompts.json](generation-prompts.json)。与上一轮区别是：每次都把第一关同类的实际运行图集作为画法／比例参考，把第二关已有设计或立绘作为身份参考，明确区分二者用途。

| 原始PNG | 参考与约束 | 实际尺寸 |
|---|---|---|
| [garden-fairy-idle-source-v1.png](garden-fairy-idle-source-v1.png) | 第一关巡星妖精运行图集＋花庭左侧精灵设计；薄像素轮廓、小脸、紧凑羽翼，保留薄荷发／粉花／绿白短裙 | 1254×1254 |
| [bell-attendant-idle-source-v1.png](bell-attendant-idle-source-v1.png) | 第一关引光侍从运行图集＋花庭中间风侍设计；窄长轮廓与细铃杖，保留浅发／绿白长袍 | 1086×1448 |
| [lingyu-idle-source-v1.png](lingyu-idle-source-v1.png) | 第一关Boss运行图集＋铃羽大立绘；恢复修长成年比例与细像素层次，保留粉发／披肩／花瓣裙／弯枝铃杖 | 1086×1448 |

三份PNG从工具输出目录逐字节复制，原图没有裁剪、重编码或重绘。尺寸、透明度和SHA256见 [source-audit.json](source-audit.json)。原图不是原生48／64／128像素素材；实际游戏缓存由Canvas根据可见范围定位身体支点、缩小、统一32色以内并转成二值alpha，再按第一关同类画布显示。此过程属于运行时绘制，不覆盖源PNG。

本轮没有直接复制第一关人物身份或改变铃羽大立绘；绘制风格与体量是否足够统一，仍待用户看 [两关实际尺寸对照](../../STAGE-02-UNITY-v1.md)。
