# 原创弹体图集 v1

(C) 2026 Carinoasd（既有游戏）；本轮原创材质制作：小典 / Codex，内置 imagegen。用户于2026-11-13确认本轮材质小样，现用于Hard v3。原始生成图集1536×1024，透明RGBA，按原字节复制到 `assets/projectile-atlas-v1.png`。没有导入参考游戏的贴图。

原始提示词：

```text
Use case: stylized-concept.
Asset type: original production-ready 2D bullet-hell projectile texture atlas, transparent RGBA, landscape 1536 by 1024.
Create ONE atlas containing exactly SIX isolated projectile sprites in an exact 3-column by 2-row grid. Equal cells 512 by 512. Sprite centers at (256,256), (768,256), (1280,256), (256,768), (768,768), (1280,768). Large empty transparent gutters, no overlaps, no separators, no text. Keep every sprite fully visible.
The art direction is elegant classic Japanese bullet-hell luminous sprite textures, newly authored, no copied game assets. These should look like small emissive beads and light needles, NOT flat vector icons, not stickers, not ornamental jewels, not photoreal marbles.
ROW 1 all icy BLUE / CYAN with almost WHITE luminous cores. ROW 2 matching shapes all warm GOLD / YELLOW with ivory-WHITE luminous cores.
COLUMN 1: one small round light bead, circular silhouette, modest pearly luminous white inner body, narrow saturated colored edge with smooth internal brightness rolloff, a very short soft translucent fringe. Compact and readable at 12-16 pixels. Visual footprint around 230x230 within its cell. Not a hollow ring.
COLUMN 2: one vertically oriented short pointed rice / needle projectile, top points upward. Slender elongated white luminous body, saturated blue (top) or gold (bottom) side walls, gentle tapered ends, a very restrained transparent halo; coherent near-symmetric 2D light sprite. Body about 105 pixels wide by 255 pixels long within the cell. No long trail.
COLUMN 3: one medium-large round ENERGY ORB, about 285 pixels across including its halo; bright white concentrated core transitioning into colored inner body and a layered translucent luminous aura. A subtle softly scalloped corona / faint star glint can provide a distinctive texture but it must remain an easy-to-read round orb. Slightly softer and more atmospheric than column 1, with a crisp readable inner body. Not a solid white disk, no huge fog cloud.
Across all six: make the edge gradients and translucent falloff intrinsic to the bitmap. Compact light emission, no dark outline and no thick white outline. No cast shadows, no ground reflections, no bevelled UI frame, no sparkle particles detached from the bodies, no labels, no background, no checkerboard baked in. Actual transparent alpha with zero-alpha space around all sprites and partially transparent antialiased glow pixels. Keep the colored edge sufficiently vivid to remain visible when scaled down. Six clean usable sprite silhouettes, one coherent material family, the two color rows exactly corresponding.
```
