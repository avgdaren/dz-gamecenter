# 一键布景：9套新增与3套旧组合修正

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-10-30。回应 Issue #44 评论 6512172977。

## 九套新组合

| 名称 | 背景 | 后景 back | 前景 front | 主景 | 概念 |
|---|---|---|---|---|---|
| 春汀花影 | tank_day | scape_wood / plant_fern | plant_lily / plant_meadow / trinket_pearl | scape_wood | 以低矮花枝和水草做一处轻盈的春日浅汀。 |
| 绯叶溪桥 | tank_day | building_bridge / scape_moss | plant_crimson / scape_pebbles | building_bridge | 一丛绯红叶映着石桥，像走进微暖的秋日溪谷。 |
| 珊瑚拾光 | tank_day | scape_coral / plant_tide | trinket_shell / trinket_pearl | scape_coral | 珊瑚、贝壳和珍珠组成小而明亮的海湾角落。 |
| 幽潭听泉 | tank_moon | scape_cave / plant_ribbon / scape_moss | plant_meadow / trinket_crystal | scape_cave | 月色下的岩洞留出暗亮对比，水晶像一处小小泉光。 |
| 月下潮亭 | tank_moon | building_pavilion / plant_fern | plant_lily / trinket_crescent / trinket_star_lamp | building_pavilion | 远处小亭与近处弯月、暖灯构成安静的观景角。 |
| 圆门望月 | tank_moon | building_moon_gate / plant_ribbon | trinket_pearl / trinket_crystal | building_moon_gate | 圆门框住清透水色，珍珠与晶簇轻轻呼应。 |
| 星痕遗庭 | tank_moon | building_ruin_arch / scape_layers | scape_pebbles / trinket_wings | building_ruin_arch | 断拱旁的羽翼像遗留的纪念物，带一点故事感。 |
| 沉眠神殿 | tank_moon | building_columns / plant_tide | trinket_crystal / trinket_crescent | building_columns | 完整列柱组与一点星晶，营造沉睡神殿的纵深。 |
| 羽光圣庭 | tank_day | building_angel_gate / plant_fern | trinket_wings / trinket_star_lamp / plant_lily | building_angel_gate | 明亮庭门和近处羽翼、暖灯组成柔和的天使主题。 |

## 三套旧组合修正

| 旧名称 | 合法 back | 合法 front | 主景 |
|---|---|---|---|
| 自然水景 | scape_wood / building_bridge | scape_pebbles / plant_meadow / trinket_star_lamp | building_bridge |
| 遗迹秘境 | building_ruin_arch / scape_layers / plant_ribbon | scape_pebbles / trinket_shell | building_ruin_arch |
| 月光庭院 | building_angel_gate | scape_pebbles / plant_lily / trinket_star_lamp | building_angel_gate |

卵石 scape_pebbles 仅 front；长叶 plant_ribbon 仅 back。上表按服务端内容表核对，不依赖自动换层来掩盖非法配置。旧组合不是另算3套新布景；合计12套，其中新增9套。旧界面若有不同内部ID，请按名称对应替换层列表，不能擅改既有存档字段。

## 读取与构图

机器表：`assets/layout/decor-presets-v1.json`。每套含 name/background/back/front/concept/main、陪衬列表、逐件柔性 anchor_x、构图说明。使用原 decor-layout-v1 的宽度、ground_y、透明图锚点和昼夜叠色；本表只提示横向位置，不改变素材大小或持久化坐标协议。主景先占位，陪衬再摆，不能每一件都按“离其他物品最远”把主景挤到边角。位置为推荐，不能禁止玩家选择其他摆法。

这9套不是夜景/雪景的新美术，不承诺不存在的雪花、泉水或动态特效。全部只用现有24件装饰及免费日光/月光背景，和PR #48四套可购买背景分开交付；不依赖购买新背景才可使用。后续如要给本表换PR #48背景，应先检查该账号已拥有，不能暗中解锁或扣金币。

## 应用规则

- 布景组合本身免费，只使用已拥有的装饰；缺件列出名称并跳过，不购买、不发放、不静默替成另一件。主景缺失时明确显示“缺少主景，应用后为简化布景”，保留用户是否应用的正常按钮，不弹额外收费/强制购买流程。所有装饰都缺失时应用为no-op，不清空旧布景或改背景。
- **“清空再摆”只适用于候选装饰列表，不包括鱼。** 保留layout.fish全部槽位、重复鱼实例/相位、当前钓点、金币、捕获进度。最好在layout写入payload只提交decor和background，省略fish，避免把异步旧鱼数组覆盖回去。
- 在内存构建完整目标 back/front 数组，再对这个最终目标一次写入/一次version更新；不要先保存清空、再多次保存每个装饰。UI可即时显示最终候选；请求失败回退到之前已保存状态，结果不明先读最新状态再处理。不能把中间空缸写成最终布局。
- 重复点击同一目标不额外增殖或扣币；两标签冲突后基于最新状态重算可用装饰。切布景只变化装饰/背景，不销毁鱼播放器重建鱼。需要重新计算遮挡时复用现有实例。
- 每层最多3件；全套无重复，层位必须在服务端layers中。静态校验失败的预设应停用并报告，运行时发现目录变化时跳过不再支持的装饰并提示；不要悄悄挪层制造新的遮挡构图。最终仍由服务端校验拥有权/背景/层位/版本。
- 应用一次最多给一个成功反馈；不能按5件装饰响5次place。是否即时保存沿用当前玩家界面已定交互，但不能要求玩家再次从布置列表逐件找一遍。

## 每套构图重点

- 春汀花影：沉木是主景；蕨叶放远处左缘，珍珠台留小，中央上方让给鱼。
- 绯叶溪桥：桥保持横向舒展；红叶偏右点色，苔石靠左，别把桥夹成狭窄门洞。
- 珊瑚拾光：珊瑚主景偏右；海藻是远处轮廓，贝壳与珍珠分散点缀，不铺满底边。
- 幽潭听泉：保住岩洞入口可辨；长叶不插在洞口，水晶偏右当次要亮点，不新造喷泉特效。
- 月下潮亭：亭子保持远景的小尺度；暖灯只作点光，避免把灯放在亭子正下方遮住轮廓。
- 圆门望月：圆门主景居中偏后；门洞内不再塞建筑，近景小件分置两侧。
- 星痕遗庭：主景残拱偏右，台阶偏左；羽翼近景做小焦点，不能放大成第二座门。
- 沉眠神殿：列柱本身已经是组合主景，不复制、不再叠一座大门；左边海藻保持轻薄。
- 羽光圣庭：庭门是唯一建筑；羽翼和灯分开摆，睡莲贴右缘，保住门内的清空区域。

## 检查与未验项

测试将机器表逐件与独立服务端层位快照及现有美术规格对照，检查9新+3旧、名称4～6字、免费背景、每层最多3件、全套去重、主景/陪衬覆盖、24件素材覆盖，以及推荐可见轮廓在三种尺寸中不越界。另用非法层位、跨层重复、超容量、重复ID/名称和缺失主景夹具验证校验确实拒绝。

本轮不增加服务器字段、配置经济或数据库SQL；没有修改真实UI/后端。静态通过不代表实际24件合成或实站通过。小蓝需逐套测试360px和桌面、主景缺件/全部缺件、原有12条鱼保留、一次原子应用、失败/冲突回退和背景音乐不自动开启；真实构图、最大装饰遮挡与手机帧率未验证。
