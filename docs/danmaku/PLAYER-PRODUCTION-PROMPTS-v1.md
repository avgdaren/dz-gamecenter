# 天使弹幕祭 · 自机制作提示词记录 v1

日期：2026-11-11（北京时间） · 小典 / Codex。

本轮使用内置 `image_gen.imagegen`，未使用图像生成CLI或API密钥。所有调用均请求真实透明背景（`transparent_background: true`）。参考图以已确认的正背面草图为准；动作帧同时参考背面静帧源图。

这些文件是生成源图；最终像素整理和验收状态以 [自机制作记录](PLAYER-ART-PRODUCTION-v1.md) 为准。第二次正面生成仍带残留，未选作当前展示源图，原件保留在工具默认生成目录。

## 背面静帧源图

[生成源图](art/player-production-v1/player-back-idle-source-v1.png)。

```text
Use case: identity-preserve
Asset type: transparent back-facing player-character idle sprite source for the original vertical bullet-hell game 天使弹幕祭.
Input image 1: approved character design reference; use ONLY the LEFT, BACK-VIEW heroine as the subject. The right/front view is identity reference only and MUST NOT appear in this output.
Primary request: produce ONE isolated full-body back-view idle sprite on a genuinely transparent RGBA background. Preserve the approved original girl, outfit, colors and silhouette. Remove the entire navy background and the other view. This is a production sprite source, not a concept sheet.
View and pose: rear view with a gentle overhead viewing angle, facing the TOP of the playfield toward the enemy, back of head visible, NO face, no eyes. Compact hovering pose, arms slightly forward at the sides, legs close and knees gently bent. Slightly refine the oversized head toward approximately three-head-tall proportions while retaining the reference's appealing anime chibi design. The waist is the stable central visual anchor.
Invariants: cream/pale warm golden MEDIUM-LENGTH hair, shoulder-blade length, several clear chunky locks and outward tips; ONE small blue star hair ornament on the character's anatomical LEFT, therefore VIEWER LEFT in this back view. Deep navy-blue short shoulder cape with simple muted gold edge, white short pleated skirt with restrained gold hem, pale opaque stockings, small navy ankle boots. ONE compact pair of white feather wings, each three broad feather groups with cool blue shadows, attached to upper back, separated clearly from hair and cape. No new costume decorations.
Pixel construction: crisp coarse sprite pixel art, readable as if drawn on a 48 by 48 pixel cell with visible figure height 38–40 pixels and wingspan about 42 pixels, enlarged only for inspection. Consistent square pixel clusters and deliberate staircase contours; restrict to around 24 flat colors, 2–3 tones per material, dark blue-grey selective outlines. Preserve the simple low-resolution look. No finer details than useful at the target game scale.
Framing: exactly ONE centered character, equal safe transparent padding on every side, entire wings and feet visible. Neutral flat sprite lighting.
Avoid: second character, front view, text, labels, borders, game UI, hitbox marker, circles, halo, background of any kind, drawn checkerboard, ground, cast shadows, glow, particles, soft brushes, gradients, antialiased outlines, smooth painting, high-resolution miniature details, black opaque background, long waist-length hair, changing the hair ornament side.
```

## 正面展示初稿

[生成源图](art/player-production-v1/player-front-source-v1-raw.png)。

```text
Use case: identity-preserve
Asset type: isolated transparent front-facing character display art for the lower-right information panel of an original bullet-hell game.
Input image 1: approved two-view design reference. Use ONLY the RIGHT FRONT-VIEW heroine as the subject. The left back-view figure is identity reference only and must not appear.
Primary request: extract and refine this same approved girl into ONE full-body FRONT-FACING pixel-art character on a genuinely transparent RGBA background. Preserve her face, outfit, medium-length hair, proportions and warm/cool color balance. Remove the navy background and other view. Keep a calm, lightly upbeat and earnest expression, clear blue eyes.
Invariants: cream to pale warm blonde medium-length hair reaching the shoulder blades, naturally loose chunky locks with slightly outward tips, not a bob and not waist-length; exactly ONE blue star hair clip on her anatomical LEFT, which is VIEWER RIGHT in this front view. Deep blue SHORT shoulder cape with restrained gold edging and simple neck bow, white short pleated skirt with muted gold hem, small navy ankle boots and opaque pale stockings. A single compact pair of white feather wings with cool blue shadows and three broad feather groups each, close to the upper back. Keep the reference's recognizable silhouette.
Pose/composition: facing camera, centered upright hovering full body, hands relaxed beside the skirt, legs close and gently bent, both wings visible, all hair tips and feet inside the frame, generous transparent padding. Approximately three-head-tall anime chibi proportions, a little less oversized head than the sketch. This is a static decorative character display source, not an animation sheet.
Style: crisp deliberate square-pixel clusters and staircase outlines, selective blue-grey contour, simple flat pixel shading, coherent low-resolution anime game art. Keep it visually matched to the approved pixel heroine. No invented accessories or elaborate details. Strong readable face at a future display height around 160–200 pixels.
Avoid: back view, extra figures, text, UI, borders, giant wings, halos, weapons, background, drawn checkerboard, floor, shadow, soft gradients, bloom, glow, photorealism, smooth painting, blur, antialiased edges, changing the hair clip side or changing her identity.
```

## 正面初稿去柔光尝试

[生成源图](art/player-production-v1/player-front-display-source-v1.png)。

```text
Use case: background-extraction
Edit target: the supplied isolated front-facing pixel heroine PNG.
Change ONLY the unwanted soft glow/haze and transparency cleanup. Remove ALL soft gold, brown, white and blue atmospheric haze around the figure, including haze behind the head, around the wings, hands, skirt and boots. Make all space outside the exact sharp stepped character silhouette completely transparent. Preserve the entire character, every costume feature, face, pixel colors, proportions, blue star ornament on viewer RIGHT, pose and framing unchanged.
This is a clean pixel-art cutout for compositing onto a UI. Retain solid flat colors INSIDE the sprite; retain the pixel stair-step contour; do not add soft or blurred edges. The only visible pixels should belong to the girl, her hair, clothing, wings and footwear. No shadow, no halo, no background, no colored fog, no checkers, no text.
```

## 三组十二帧源图

[生成源图](art/player-production-v1/player-motion-atlas-source-v1.png)。

```text
Use case: stylized-concept
Asset type: transparent 12-frame player animation atlas SOURCE for an original anime pixel-art vertical bullet-hell game.
Input image 1: approved two-view heroine design, character identity and colors only.
Input image 2: canonical back-facing idle source. Use this back-facing sprite as the exact character and costume for EVERY frame.
Primary request: make ONE clean sprite atlas containing EXACTLY TWELVE full-body sprites of this SAME back-facing girl, arranged in EXACTLY FOUR COLUMNS and THREE ROWS of equal SQUARE cells. Overall atlas aspect ratio 4:3; target layout 1024 by 768 with 256 by 256 cells. Transparent RGBA background everywhere outside the characters. No title, no labels, no dividing lines, no decorations.
Tile alignment: each sprite fits inside its own cell with clear margins, feet never touch a cell border, no overlap between neighboring cells. Keep the WAIST anchor at precisely the same local position in every cell, about (128,152) for a 256x256 cell; body height about 208px and wingspan about 120px. Each cell is designed to be displayed later as a 48x48 game frame. All characters face UPWARD into the screen, seen from BEHIND with a gentle overhead view; NO faces or eyes.
Animation by row, four consecutive looping frames in each row:
ROW 1: neutral hovering idle. Torso and waist stable; wings gently open, raise slightly, return halfway, lower slightly; hair tips and skirt move a small amount with the cycle.
ROW 2: LEFT movement. The same hovering body leans gently toward viewer LEFT about 8 degrees. Hair and short cape trail subtly to the right. Four small wingbeat phases. No walking.
ROW 3: RIGHT movement. Body leans gently toward viewer RIGHT about 8 degrees. Hair and short cape trail subtly left. Four small wingbeat phases. No walking.
Character invariants across all twelve cells: same pale warm blonde medium-length shoulder-blade hair, exactly one blue star ornament on her anatomical LEFT and hence VIEWER LEFT in these back views; never mirror the ornament to the other side. Deep blue short cape, restrained muted gold edging, white short pleated skirt, pale opaque stockings, navy ankle boots. ONE compact pair of white feather wings, three broad feather groups each, icy blue shadows. Preserve approved silhouette and approximately three-head-tall anime chibi proportions. Same palette and garment lengths in every cell.
Pixel medium: coarse deliberate SQUARE pixel clusters, crisp staircase silhouettes, flat 2–3-tone material shading, dark blue-grey selective outlines, restrained limited palette. Consistent scale and rendering in all cells. No small high-resolution embellishments.
Avoid: any front view or side face, facial features, different characters, count other than 12, extra row or column, variation in costume or hair ornament side, enormous wings, body bouncing away from waist anchor, jumping/running/walking poses, smooth illustration, gradients, glow, fog, shadows, background, fake checkerboard, grid lines, text, labels, borders, arrows, hitbox markers or UI.
```

## 正面展示第二次生成尝试

```text
Use case: identity-preserve
Input image: approved two-view ORIGINAL design. Use the RIGHT FRONT VIEW only as character identity reference.
Create exactly ONE transparent pixel-art cutout of that SAME original girl for a game UI portrait. Match the approved blue-eyed face, medium-length pale golden hair, ONE blue star on VIEWER RIGHT, deep blue short gold-edged cape and bow, white gold-edged skirt, white stockings, navy boots, and compact white wings. Full body, hovering upright, same proportions, centered and completely visible.
Most important technical requirement: HARD, CLEAN PIXEL SILHOUETTE ON COMPLETELY CLEAR TRANSPARENCY. Every pixel outside the character is entirely empty/transparent. Do not render ANY lighting effect, soft halo, colored haze, smoky background, ambient glow, floor shadow, vignette or blur. Only solid character color clusters and crisp stair-stepped silhouette edges. Flat sprite lighting and simple flat pixel shading. No antialiasing. No background color, no checkerboard. No extra view, no text or UI.
Preserve the approved design faithfully; do not redesign clothing, face, hair length or wing size.
```
