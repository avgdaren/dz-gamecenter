# Boss production v1 — image generation record

Generated 2026-11-12 with the built-in imagegen tool by 小典 / Codex. Transparent background requested for every asset. Original tool outputs retained; approved battle concept used as character/style reference. Body poses are generated drawings; native export only crops, aligns, reduces and quantizes these drawings.

## body-atlas

Original: `exec-6663bf48-90d9-40e3-a9cd-9f666b8552cc.png`

Use case: identity-preserve, production game sprite animation sheet.
Input reference is the user-approved Star-Ring Observer battle design. Preserve this exact adult silver-lavender-haired woman, composed half-lidded blue-violet eyes, gold star hair ornament on the viewer's LEFT, navy/ivory long gown, ivory bell sleeves, gold constellation trim, and small blue-gold orbital jewel at viewer's RIGHT waist. No new props or wings. Keep her five-to-six-head adult stylized proportions, recognizable face, colors and costume.

Create ONE clean body-only sprite animation sheet with EXACTLY FOUR COLUMNS and FOUR ROWS, SIXTEEN complete full-body figures total. All 16 equal rectangular cells in one regular grid, preferably a 1536x2048 portrait canvas (each cell 384x512). Do NOT draw grid lines, labels, text, numbers, titles or borders. A genuinely transparent background and generous clear gutters between every cell. Same character scale, same face, same head/waist/foot baselines in all cells, each body fully inside its own cell. Target native export is 96x128 per cell with the waist star near x=50%, y=37.5%; keep six native-pixel-equivalents of transparent edge margin.

Read rows top to bottom:
ROW 1: four distinct gentle floating idle frames, both hands open at waist height; coherent flowing hair and skirt motion progressing through a loop.
ROW 2: four distinct LEFT movement frames, slightly leaning toward the viewer's left, hair/sleeves lagging right, still facing toward the player; gold hair star stays on viewer's left and blue waist jewel stays on viewer's right.
ROW 3: four distinct RIGHT movement frames, slightly leaning right, hair/sleeves lagging left, still facing player; do not mirror the clothing, hair ornament or jewel.
ROW 4: four distinct charging frames, palms rise gently and sleeves draw in, controlled anticipation pose; keep face calm and the waist anchor fixed. No magical particles or glow baked around the body.

Use crisp intentional pixel-art clusters and stepped silhouettes, a restrained 32-color-looking navy/lavender/ivory/gold palette, simple readable shading. Simplify lace and embroidery into clear large stars and trim; no tiny noisy details. Maintain the same head size and consistent outfit across the whole sheet. Motion must be visible but small, with each row looping, not sixteen copies of one pose or a lineup of different characters. Omit the large astrolabe/halo entirely; it is a separate asset. No stage, ground, shadow, checkerboard painting, backgrounds, loose stars, extra limbs, cropped feet or watermark. Body sprites on actual alpha only.

## ring-back

Original: `exec-1b956cc7-1d9f-442b-bc0c-d0d6089f240c.png`

Create ONE production game sprite asset, the BACK astrolabe ring for the approved Star-Ring Observer boss. Use the attached concept ONLY as the gold/navy/ivory palette and celestial design reference. Do NOT include any woman, face, hair, clothing, silhouette or text. A beautifully restrained front-facing celestial brass astrolabe: one thin circular outer rim, a few thin crossing elliptical orbital arcs inside, four small diamond-star markers distributed at cardinal directions, muted brass and navy shadows with ivory-gold highlights. Large mostly transparent empty center. Sparse elegant geometry with readable small-pixel shapes, no bloom, fog, spark cloud, decorative dots, bloom or shadow on background. The whole circular instrument must fit inside a square transparent canvas, with at least 8% completely empty outer margin, circle centered exactly on canvas center, visible diameter about 84% of canvas width. This is the BACK layer behind an adult boss, so keep it subdued, never a bright solid disc. Crisp pixel-art edges suitable for reduction to native 128x128, at most 32 apparent colors; transparent background true alpha, no checkerboard, no magenta matte. Single object only, square composition.

## ring-front

Original: `exec-d451e90d-690f-4170-865f-ad30b55feada.png`

Create ONE production game sprite, the FRONT near-side astrolabe arc matching the attached approved boss style and the second reference back-ring. NO character or whole ring. A single shallow upward-opening bowl-shaped elliptical brass arc, occupying the LOWER HALF of a square transparent canvas, with a small four-point diamond star at its left end and a matching little diamond at the right end. The top half and center must be truly empty transparent, except these two end stars. No complete circle, no globe, no horizontal straight bar, no large central decoration. Thin muted brass line with navy shadow and ivory highlight, crisp restrained pixel art suitable for a native64x64 overlay; visible width no greater than68% of canvas, centered horizontally; arc center lies slightly below canvas center, lowest visible point at about78% canvas height. The back-ring already has a circular rim and crossing orbits; this front layer only gives a sparse near-side arc across the character's lower waist. Gold/navy/ivory same as references, no colored glow, no particles, no text. True alpha transparent background, no checkerboard, no matte, generous empty margins. One object only, square composition.

## face

Original: `exec-efb8a155-4e22-4e88-aab9-0e3ece03d0c6.png`

Create ONE transparent square head-and-shoulders portrait of the EXACT SAME adult Star-Ring Observer woman in the attached approved battle concept. This is a same-character game HUD portrait, not a redesign. Keep adult face and solemn composed expression, cool blue-violet eyes, very long silver-blue/lavender hair, the distinctive single GOLD FOUR-POINT STAR hair ornament on the VIEWER'S LEFT temple, navy fitted high-collar bodice with ivory collar and fine gold star edging, pale skin. Her gaze faces the player almost straight on. Face recognizable at64px; eyes clear, hair shape calm, no oversized anime child proportions. Head and shoulders only, crop from upper chest upwards, full hair top with generous8% transparent margin, shoulders taper cleanly at bottom edge without any scenery. Carefully rendered polished Japanese fantasy game illustration consistent with the reference's face and colors; clean pixel-art-inspired shading and slightly graphic details. No astrolabe ring behind, no weapon, no wings, no text, no rectangle or colored backdrop, no glow cloud, no checkerboard or matte. True alpha transparent background. Square image.
