# 主角高清标题立绘 v1

2026-11-12，小典 / Codex。使用内置 image_gen，透明背景；不是CLI／API密钥生成。原型 `(C) 2026 Carinoasd`。

用户要求标题用主角，没有高清立绘可以补做。已找到1024×1536正面生成源图与游戏图标，二者仍为像素风，因此沿已有角色设计补高清二次元立绘，未改战斗小图或旧源图。

参考1：[已确认正面源图](../player-production-v1/player-front-display-source-v1.png)，人物／服装；参考2：[游戏图标母图](../game-icon-v1/icon-source-v1.png)，面部／气质。以下为本次完整实际提示词。

```text
Use case: stylized-concept. Asset type: transparent high-resolution full-body protagonist illustration for an existing anime danmaku game's landscape title screen. Reference image 1 is the approved main character's full-body design; reference image 2 is the same character's face and personality. Create a polished NON-PIXEL anime illustrated standing character, preserving these exact identity features: warm pale golden medium-length hair a little past the shoulders, blue eyes, a blue five-point star hair clip on the VIEWER'S RIGHT side of the head, a short navy blue capelet with restrained gold edging, a modest white short pleated dress with navy accents and gold hem, white stockings, navy ankle boots with gold accents, and a pair of small white feathered wings. Young adult heroine, cheerful and focused, no regal long hair or long gown. The character must clearly be the blonde star-messenger protagonist in the references, not the silver-haired boss. Style: refined 2D anime game key art, clean fluid linework, soft cel shading, delicate highlights, detailed but restrained fabric, natural 5.5-head tall anime proportions, not super-deformed, no pixel blocks. Full body from hair to boots with all wings inside the image and generous transparent margins. Floating gently upright, slight three-quarter turn toward the viewer's right so she faces the title menu, friendly confident smile, one hand relaxed and the other softly open forward. Character centered in a tall portrait composition, around 1024 by 1536, clearly separated silhouette, readable face. Actual transparent RGBA background, clean alpha, no floor, no cast shadow/background, no text, no logos, no frame, no halo, no weapon, no extra character. Preserve outfit and hair clip placement from the reference.
```

产物：[运行立绘](../../../../source/plugin/gamecenter/games/_danmaku_proto/assets/player-title-portrait-v1.png)。从Codex生成目录原样复制，未用Python或其他脚本编辑图片。尺寸／SHA与透明通道检查在同目录 `manifest.json`；源文件保留在Codex生成目录。
