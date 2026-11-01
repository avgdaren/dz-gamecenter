# 给小蓝：四种新生物美术补交（本批集成专用）

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-11-01。Refs #56 / #53 / PR #50。

原交付在PR #50（457ea7e），但核对1f884c9时，集成分支里四种新生物的图像文件均缺失，且game.js仍读旧资源目录。本PR将美术单独补进当前发布基线，不夹带旧候选概率/金币配置，不改小蓝的运行代码。这次不再要求先合入整个旧预研PR才能取图。

## 四种与稳定ID

| 名称 | fish_id | 索引 | 主姿态 |
|---|---|---:|---|
| 卷尾海马 | pond_curl_seahorse | 13 | 直立、卷尾悬停 |
| 铃伞水母 | pond_bell_jelly | 14 | 伞盖朝上、漂浮 |
| 软糖章鱼 | bay_gummy_octopus | 15 | 低层缓滑 |
| 月汐人鱼 | bay_moon_mermaid | 16 | 横向滑行、脸部稳定 |

## 文件已实际补齐，不只是指向另一个PR

- `assets/fish-next/v1/`：每种sprite512、mobile256、icon128、silhouette128，共16张WebP与原manifest。
- `assets/fish/<fish_id>.webp`：额外4个兼容入口，直接复用对应512px sprite原始blob。
- `assets/thumbs/fish/<fish_id>.webp`：额外4个兼容入口，直接复用对应128px icon原始blob。
- `assets/fish-next/v1/runtime-map.json`：纯美术路径与facing/size_axis/size_ratio、可见包围盒，不含经济或捕获概率。
- 本目录masters/含4张PNG母版，art-review.jpg为原浅深底联系图。

当前game.js的mountSprite无MOTION记录时会读fish/<id>.webp，图鉴会读thumbs/fish/<id>.webp；因此这8个兼容入口能补齐现有调用，不需要为路径迁移覆盖game.js。素材路径只补新增ID，旧12种文件不改。

## 小蓝接入时核对这几处

1. 合入后逐个确认四种sprite和icon请求200、可解码，未发现卡灰剪影与放入鱼缸均能显示。不要用其他鱼贴图临时代替。
2. 当前createFish对所有种类都写width=10%。后续按runtime-map/原manifest的size_axis区分：海马和水母以可见高度控制，人鱼/章鱼以可见宽度控制；size_ratio沿用已交规格，不把人鱼和海马一律放到相同方框宽度。
3. 四种均是**静态完整纹理**。sprite/mobile/icon/silhouette是四种用途，绝不是四帧。先用现有分物种位移/悬停表现；不接水平鱼warp、不复制尾部、不将四种用途图片顺序播放。
4. 目前未给新种MOTION序列，保留单纹理回退即可；未来另交动态帧时再注册fish-motion。纹理可以共享，每个slot的位置/相位独立，收起时正确dispose。
5. 原manifest里weight/coins是PR #50历史候选，仅留作来源记录，**不作为运行鱼池配置**。本批实际lifetime_cap=3、鱼竿门槛、概率和哈希以小蓝已实现的服务端配置为准，不能从美术manifest覆盖。
6. 12条新旧/重复混合、360px和浅/深水景实际检查尺寸、边缘、脸部/腕足、遮挡、喂食姿态；这里没有声称真实浏览器已验通过。

## 验证边界

这次直接重用原仓库blob，16张运行图、4张母版、联系图与来源逐项同SHA，不做重新生成、转码或改色；8个兼容入口分别与原sprite/icon完全同blob。原图尺寸/透明信息和SHA-256见原manifest。

这解决“美术未进入本次集成分支/当前路径找不到图”的交付缺口。未改代码、未合并、未部署；小蓝合入后仍须验真实加载和显示，不把素材在仓库等同已经上线。
