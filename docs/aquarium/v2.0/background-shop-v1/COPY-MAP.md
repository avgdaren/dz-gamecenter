# 背景商店 UI 缩略图复制映射

作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。2026-11-08。

三张文件均为从原主图导出的 320×200 WebP，不覆盖美术交付包原文件。旧四景的缩略图已齐，继续用现有路径。

| 本目录文件 | 正式接入目标（插件 games/aquarium 下） | 主图来源 |
| --- | --- | --- |
| `thumbs/tank_day.webp` | `assets/background/tank_day_thumb.webp` | `assets/background/tank_day.webp` |
| `thumbs/tank_moon.webp` | `assets/background/tank_moon_thumb.webp` | `assets/background/tank_moon.webp` |
| `thumbs/tank_firefly_grove.webp` | `assets/background/tank_firefly_grove_thumb.webp` | 美术包 runtime/v1/background/tank_firefly_grove.webp |

正式 catalog 的 thumbnail 字段按上表登记。不要将本目录 catalog.js 整份覆盖正式配置；它含内存演示用路径，不是生产目录。
