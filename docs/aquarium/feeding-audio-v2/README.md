# 吃食/入水音效 v2：短脆卡通方向

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-11-01。Refs #54 / #53。

v1的eat_01..03仅留历史，本轮使用 **feeding/v2/bite_01..04**。v1饲料美术保持不变，BGM《气泡小步舞》不改。实际播放请打开同目录preview.html逐段试听。

| id | 母版时长 | 母版峰值 | 母版全段RMS |
|---|---:|---:|---:|
| bite_01 | 82ms | -8dBFS | -17.86dBFS |
| bite_02 | 97ms | -8dBFS | -19.93dBFS |
| bite_03 | 72ms | -8dBFS | -18.46dBFS |
| bite_04 | 117ms | -8dBFS | -20.85dBFS |
| drop_01 | 107ms | -10dBFS | -23.52dBFS |
| drop_02 | 132ms | -10dBFS | -24.86dBFS |
| pop_01 | 147ms | -12dBFS | -24.70dBFS |

时长包括2ms起始留白。44.1kHz单声道，PCM16 WAV母版；各有OGG优先和MP3回退。全部14个有损导出已解码并检查有限值、时长/峰值/RMS、削波数0，精确编码指标与SHA见manifest.json/audio-metrics.json，表内不是有损导出峰值。

## 声音设计与接入

bite是三次紧凑微冲击组成的原创咬合声：带限短噪声、紧阻尼不谐波与低频小冲击，轻度非线性压缩后低通，主能量很快结束，无金属铃声长尾。4变体的微冲击间隔、频率和噪声种子不同。drop用短下滑气泡+少量水声；pop是轻散场声，已给但默认不启用。无第三方采样或录音，不是其他游戏音效复刻。

- bite：消费一粒食物时确认一次，volume=.45起，4变体避免连续重复，140ms全场节流。
- drop：成功放下1粒时响，volume=.32起，100ms独立节流；满8粒拒绝时不响。
- pop：volume=.22，默认off；若启用，仅自然完成且有实际吃食、空场4秒后一次；取消、后台或全部过期不响。
- 所有投喂声音合计最多2个并发，bite优先；忙时丢低优先级声音，不排队补播。复用音效开关；取消/离开清理所有旧场对象。
- 默认固定音高轮换足够。可选Web Audio playbackRate=.92–1.08；别仅设置HTMLAudio playbackRate便声称实现了随机音高，其preservesPitch可能保持音高。最慢变速下最长bite仍约127ms。
- 峰值选择-8dBFS而非-12，为短促咬合增加存在感；不要再把它normalize到0dB。BGM现有音量保持，不能仅凭峰值推断相对BGM响度，实机混听再调音效总线。

合成可复现：`python tools/build_aquarium_feeding_audio_v2.py`。只离线需要Python/NumPy/SciPy/ffmpeg，运行端不增加依赖。未独立进行真实游戏主观听感/手机Safari/与BGM混听验收，提交后由用户/小蓝试听确认。

单粒投喂、图鉴、运动、迁移、兼容关闭包与发布顺序以 `../release-1-spec/HANDOFF.md` 为准。换素材不代替聚团/过期/重复发声等运行修复。
