# 星环观测者 · 战斗形象首稿提示词 v1

2026-11-12。图像生成：内置 `image_gen.imagegen`；提示词与规格：小典 / Codex；原型 `(C) 2026 Carinoasd`。

参考1：`../production-candidates/boss-body-v1.png`，人物身份、服装与配色。参考2：当前自机正面图，**只参考像素表现，不借用自机的年龄、发色、羽翼或三头身比例**。

输出：`boss-battle-body-concept-v1.png`。透明背景，战斗主体单张形象首稿；没有生成正式星仪层、头像或原生动画图集，没有接入游戏，旧稿未覆盖。

本次实际提示词：

```text
Use case: stylized-concept, identity-preserving game sprite concept.
Asset type: ONE transparent full-body enemy-boss battle-pose design for the existing original game 天使弹幕祭.
Input image 1 is the existing Star-Ring Observer BODY PORTRAIT: use it as the identity, hairstyle, adult age, costume and palette reference. Input image 2 is the existing PLAYER pixel portrait: use only its crisp pixel-cluster rendering language, never its young face, short body proportions, blonde hair or wings.
Primary request: Adapt the SAME adult Star-Ring Observer from image 1 into a readable front-facing pixel-art BOSS key pose suitable for a 480x640 top-down bullet-hell battlefield. This is a new battle-design candidate; preserve the original large portrait unchanged.
Subject invariants: calm, solemn adult woman; long silver-blue/lavender hair; cool pale blue-violet eyes; the gold star hair ornament on the same side as image 1; navy fitted bodice, long ivory bell sleeves, ivory central skirt with navy side panels and restrained gold constellation trim; keep the small astronomical jewel at the waist. No new weapon, wings, crown, or different character.
Pose/framing: five-to-six-head adult stylized proportions, visibly taller and more mature than the three-head player; entire body and both shoes visible. A nearly frontal view with a slight overhead game-camera hint, looking downward toward the player. Both hands open outward around waist height in a composed commanding pose. Keep the face legible; group hair into about five broad flowing shapes, simplify embroidery into a few large gold stars and hem lines.
Pixel treatment: crisp, deliberate square pixel clusters and stepped contours, restrained roughly 32-40-color look, two or three clear shading levels per material, thin dark/navy edge with sparse pale rim pixels. Think of an enlarged nearest-neighbor presentation of a 96x128 native sprite: clear readable chunky shapes, not a smooth painting, not a traced or blurred rescale of the portrait. Keep a balanced silhouette that would occupy roughly 80x112 inside that frame, with transparent margins. Place the visual waist/central targeting area near the upper-middle of the body. No grid lines and no text.
Layer separation: BODY ONLY. Omit the large floating golden astrolabe/halo completely; it will be a separate layer. Keep only costume jewelry. No ground shadow, floor magic circle, stars, particles, scenery, panels, inset close-ups, repeated poses, sprite sheet labels, captions, logos or watermark.
Background: genuinely transparent alpha everywhere outside the character, including gaps between arms, sleeves and hair; no painted checkerboard, no white or colored matte. One complete character only.
```
