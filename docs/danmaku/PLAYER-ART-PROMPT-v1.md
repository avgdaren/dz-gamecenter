# 天使弹幕祭 · 自机像素草图生成记录 v1

日期：2026-11-11（北京时间） · 小典 / Codex。

## 用户指令与范围

用户指定战斗朝向参考《东方 Project》，并说“我觉得可以先生个草图看一下效果了”。本次生成一张同一少女的正背面造型草图，主视图为朝向上方敌人的背面；没有接入游戏、制作动画或推进P2。

## 工具与文件

使用内置 `image_gen.imagegen`，新图生成后再做一次局部编辑；未使用CLI或API密钥。两次均为深蓝实底预览（`transparent_background: false`），没有输入Boss或其他角色图片。

- [初始草图](art/player-candidates/player-concept-v1-raw.png)。
- [修正后草图](art/player-candidates/player-concept-v1.png)：当前供用户评审的版本。
- 导出副本：`E:\GPT工作区\output\danmaku-p1-art\player-concept-v1.png`。
- 内置工具原件文件名：`exec-7bdb5b8a-d74b-4f08-87af-850813731d50.png`、`exec-f82b3468-1adf-4780-8f95-f1c99fb71d39.png`；原件保留在本对话的默认generated_images目录。

## 目视评审与边界

修正后图左侧为背面，右侧为正面；奶白浅金中长发、蓝色星饰、深蓝披肩、白裙和小羽翼均可辨认。初图把星饰放在两个视图的同一画面侧，造成解剖学左右不一致；局部编辑已将背面图的星饰移到画面左侧，使其与正面一致地位于角色左侧。

草图为1536×1024的RGB造型预览。目视上头部略大、观感偏Q萌，约三头身目标仍需校准。像素块、调色数量和网格尚未按正式素材规范逐项整理；不是原生48×48单帧、透明切图或可用动画。服装细节、最终俯视角度和战场小尺寸可读性未验收。

后续用户评审已确认“没问题”，此版可作为正式制作依据，并提出之后在右下角显示角色正面形象。右下角展示尚未实现，详见[自机人物设定](PLAYER-ART-DESIGN-v1.md)。

## 首次生成提示词（原文）

```text
Use case: stylized-concept
Asset type: a first pixel-art character concept sketch sheet for an original vertical bullet-hell game, for discussion only, not a production sprite sheet or screenshot.
Primary request: show the established original angel heroine design as readable, genuinely coarse pixel art. One image with two full-body views of THE SAME girl: the primary back-view gameplay pose on the left, and a matching front-view design reference on the right. Both views use the same approximately three-head-tall anime chibi proportions and the same scale. Plain flat deep navy background, generous clean margins.
Gameplay orientation: the left figure is a small hovering vertical-shooter player character seen FROM BEHIND and slightly FROM ABOVE, facing toward an enemy at the TOP of the screen. Back of the head and back of the outfit visible, no face showing in the main back view. A clean, compact, nearly symmetrical idle flying silhouette. This is the upward-facing player orientation familiar from Touhou Project; the heroine herself is an original design.
Character invariants: a spirited yet composed and earnest young anime girl; creamy white to pale warm blonde MEDIUM-LENGTH hair reaching roughly the shoulder blades, longer than a bob, much shorter than waist length; naturally loose hair with a few clearly separated chunky locks and slightly outward-swept tips; one small blue star-shaped hair ornament, consistent anatomical side in both views. Short DEEP BLUE shoulder cape, WHITE short pleated skirt, restrained warm gold edging, small dark blue ankle boots with opaque pale stockings. ONE small pair of white feather wings close to her upper back, three broad feather groups per wing, compact width, restrained icy-blue shadows; wings, hair and cape must read as distinct shapes. Arms relaxed slightly forward at the sides, legs close and knees slightly bent, hovering. Front reference has clear tiny blue eyes and a calm, lightly upbeat expression.
Style/medium: authentic low-resolution game pixel-art character studies. Imagine each figure originates on a roughly 48 by 48 pixel sprite grid, with a visible character height around 38 pixels, then enlarged many times with nearest-neighbor scaling. Large, consistent SQUARE pixel clusters, deliberate stair-step outlines, flat selective shading, a restrained roughly 16–24 color palette. Retain anime character design through hair silhouette, proportions and costume, not high-resolution detail. Crisp pixels throughout; a COARSE small game sprite enlarged for inspection, not a detailed large illustration decorated with pixel texture.
Color palette: warm cream hair, warm ivory skirt and wings, deep blue cape, a bright blue star accent, a few muted gold accents, dark navy-grey outlines. Separate warm hair from cooler wings. Background dark navy around #111E35. Flat lighting appropriate to sprites.
Composition: only these two clearly separated full-body views of the SAME character, no other characters, all wing tips and feet fully inside the frame. Main back view is the priority. No floor or cast shadow.
Avoid: smooth digital painting, thin high-resolution linework, gradients, glow, bloom, soft brushes, blur, antialiasing, pseudo-3D, photorealism, very long hair, bobbed short hair, giant wings, large circular halo, weapons, staff, elaborate lace, intricate jewelry, copied existing Touhou costumes, UI, bullets, gameplay backgrounds, captions, labels, logos, watermarks, grid overlays, checkerboard backgrounds.
```

## 局部修正提示词（原文）

编辑目标为上述初始草图，使用本地路径作为`referenced_image_paths`。

```text
Use case: precise-object-edit
Edit target: the supplied two-view pixel-art angel girl concept sheet.
Change ONLY the blue star hair ornament on the LEFT, BACK-VIEW character: move this single ornament from the viewer's RIGHT side of her head to the viewer's LEFT side, at the same height and same size, so it is on the same anatomical side as the ornament on the right FRONT-VIEW character. Restore the golden hair where the old back-view ornament was. The right FRONT-VIEW character and its ornament must remain completely unchanged.
Keep every other element unchanged: identical face, medium-length golden hair, three-head-tall proportions, back-facing gameplay direction, blue cape, ivory skirt, small feather wings, poses, palette, dark navy background, framing, spacing, and crisp pixel-art style.
No other edits, no added text, no additional ornaments. Exactly one blue star ornament per view.
```
