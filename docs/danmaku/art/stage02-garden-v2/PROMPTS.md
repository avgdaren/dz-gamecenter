# 风铃花庭 · 明亮步道与前进视差 v2 提示词

2026-11-14，小典 / Codex；原型 `(C) 2026 Carinoasd`。

用户明确要求参考原美术方向稿，纠正与第一关构图相似的问题并增加移动速度感。内置 `image_gen.imagegen`；全部只参考用户本轮提供的花庭图，不再引用第一关场景。四图分别作为远景、石铺路面、花栏、风铃花架，不改铃羽与音乐。

## sky

```text
Use case: stylized-concept. Asset type: the FAR BACKGROUND layer of the original Wind-bell Flower Garden game scene.
Image 1 is the approved environment reference. Keep its beautiful bright morning, pale blue sky, billowing white clouds, white-and-gold garden cathedral, graceful floating garden islands, pastel pink/white flowers and verdant vines. Reinterpret ONLY the distant world into a portrait 3:4 or 2:3 illustration. The cathedral and flowering terraces are far away in the UPPER RIGHT, a few smaller garden islands at the upper left, open luminous cloud sea in the middle and lower part. Wide depth, soft atmospheric perspective, high-quality 2D anime fantasy painting like the reference.
This will sit behind a separately rendered winding walkway, so there must be NO large foreground walkway or near posts, no giant close arch, no people, no game interface, no text or labels. The lower two thirds is lovely gently shaded white/pale blue cloud sea, not a dark abyss. The upper half retains small distant islands and the cathedral so it reads as a real sky garden.
Match the reference's bright, delicate colors and linework. No night sky, navy hole, symmetrical side cliffs, observatory, star rings or round boss platform. Opaque complete painting, no border, no typography, no watermark.
```

## paving

```text
Use case: stylized-concept. Asset type: an orthographic WALKWAY SURFACE TEXTURE for a perspective-projected winding bridge in a 2D anime sky-garden game.
Image 1 is a material and color reference only. Paint ONLY the warm IVORY / PALE CREAM paving stones of that garden's walkway, viewed perfectly straight down, flat orthographic lighting. Tall 1:3 rectangle, ideally 1024x3072, full opaque coverage edge to edge. Roughly six irregular square/rectangular paving slabs across the width and many slabs along its length, fine narrow grey-beige joints, subtle worn stone variation, tiny occasional green moss and a few sparse pink petals. Elegant calm material with hand-painted anime-game detail. Lighting is gentle neutral morning, no baked strong cast shadows or perspective.
This is a reusable surface map: make the top and bottom ends match smoothly for vertical repetition. No railings, columns, arches, flowers hanging into the texture, clouds, sky, water, roadsides, borders, captions, diagrams or characters. No circular medallion, star emblem, large ornamental floor motif or grid labels. Every pixel is usable pale stone surface. Keep the reference's airy sunlit feeling, not teal or dark grey. No blur, no watermark.
```

## rail

```text
Use case: stylized-concept. Asset type: ONE TRANSPARENT balustrade segment for the original Wind-bell Flower Garden, based closely on image 1.
Create a clean isolated straight section of pale ivory carved stone garden railing, FRONT ELEVATION / FRONT ON, no perspective. Wide 3:2 canvas. Two modest square end posts, a continuous rounded top handrail, a low stone plinth and five or six graceful small balusters between them. A lush but restrained spray of pale pink/white blossoms and fresh green ivy grows along the upper handrail; a few vines hang below. Match the exact refined bright anime painting style and garden materials in the reference, delicate warm stone shading, brass accent at most tiny.
The visible rail should occupy most of the width but have generous transparent padding. The base rests on one horizontal line. All holes between balusters and around leaves are genuinely transparent; no distant world, cloud, ground, background or shadow plane. Keep ivory stone fully opaque. One coherent segment only, not a sheet or display board. No text, caption, watermark, border, black background or drawn checkerboard. Output genuine RGBA transparency.
```

## arch

```text
Use case: stylized-concept. Asset type: ONE TRANSPARENT flowering wind-bell arch, matching image 1, to be passed underneath by a moving game camera.
Draw a single beautiful garden gateway FRONT ON / FRONT ELEVATION, approximately square canvas, two slim tall pale ivory carved stone posts supporting a gently curved trellis. Green vines and many restrained pastel pink/white flowers wrap around the top and upper sides. THREE small warm brass wind bells hang from the top on separate short cords, clearly visible, same garden vocabulary as the reference. The opening between the posts must be large and EMPTY/TRANSPARENT, the lower 75% of the opening clear, no floor.
Make the arch graceful and airy with fine anime illustration linework and softly painted morning shading, readable silhouette, credible connected stone feet and beam. Both posts have the same ground baseline. Entire arch, flowers and bells fully in frame with clear transparent margins. All opaque ivory stone interiors remain opaque. NO scenery, sky, white paper, clouds, walkway, people, giant opaque panel filling the arch opening, caption, labels, logo, border, watermark or drawn checkerboard. Output genuine RGBA transparency.
```
