# 用户入水声：转码工具、来源许可与当前缺口

作者：GPT / Codex；原插件 (C) 2026 Carinoasd。2026-10-30。回应 Issue #40 评论 6503674417，沿用 PR #41。

## 当前事实

小蓝回执称用户提供《掉落水中.wav》：约4.81秒、48kHz立体声16bit、924146 bytes，原录音多处削顶；样稿已裁1.55秒、转单声道32kHz、淡出60ms并降低增益。上述是小蓝回执，本次没有原文件可独立核验。

本次已搜索资料库（精确文件名、简化标题及最近音频列表），未找到该WAV；PR #41当前音频树也没有用户文件。**尚未转码该实际素材，未新增可供上线的用户音频二进制。** 测试使用自制脉冲夹具，不是用户文件，不以夹具输出替代交付。

## 可直接运行的处理工具

`tools/transcode_aquarium_user_splash.py` 仅需要Python3标准库、ffmpeg和ffprobe。小蓝若保有原WAV，可直接运行：

```sh
python3 tools/transcode_aquarium_user_splash.py "掉落水中.wav" --out /absolute/path/to/user-splash
```

输出 `sfx_splash_user.ogg`、`sfx_splash_user.mp3`、PCM母版、QA.json以及manifest片段。工具不会下载声音、上传仓库、修改玩家界面或自动给出授权结论。

- 裁取开头1.55秒，3ms淡入、末尾60ms淡出，35Hz低切、单声道32kHz。
- 先在浮点域对齐目标RMS0.0461，再用温和压缩与look-ahead limiter限制瞬态；关闭limiter自动补增益，避免限峰后又被抬满。
- 编码OGG与64kbps MP3后重新解码，检查实际时长、RMS、采样峰值及4倍重采样峰值。必要时再降增益并重编码，目标峰值不超过0.55；最终RMS如因限峰略低会如实报告，不硬抬音量。
- 原录音已削掉的细节不能靠limiter保证恢复。报告保留源文件近满幅样本数，不把“输出不削顶”写成“原录音已修复”。
- 音效播放gain仍0.5；鱼入池只播放这一个事件音，不再叠place。原`audio/v2/sfx_splash`保留备选。

## 能否把二进制提交进仓库：结论要按这条声音的许可

耳聆网并非全站统一“可商用”：站方说明每条音频由上传者选择CC0、CC-BY或CC-BY-NC，使用者应核对该条许可；不能只根据“论坛免费”或一个商用筛选标签推断。

| 详情页实际许可 | 针对提交／随项目打包的处理 |
| --- | --- |
| CC0 | 可复制、修改和分发；记录来源与素材对应关系，按站方要求保留耳聆网来源信息 |
| CC-BY | 许可本身允许复制、改编和再分发，包含商业使用；按**具体版本**保留作者／来源／许可链接、原有声明并标明裁切、混单声道、限峰及转码等修改。声音文件继续沿用自己的许可，不被项目代码的私有版权声明覆盖 |
| CC-BY-NC 或其他限制 | 不能把“免费游戏”直接等同于已满足非商业条件；根据实际用途与许可核对，不套用上面两类结论 |
| 尚无详情页／具体许可版本 | 当前就是此状态：不能确认是否可把这条实际文件打包；也不能反过来断言站方禁止提交 |

因此，**如果这条素材确为CC0或CC-BY，二进制随项目提交并非一律被禁止**；但现在还缺这条素材的详情页、许可与作者记录，不能给它标“授权已核验”。搜索结果里存在同名声音，也不能仅凭同名就绑定到用户文件。

来源（核对日期2026-10-30）：

- 耳聆网逐条许可说明：https://www.ear0.com/home/info/keyword-license
- 耳聆网声音规范：https://www.ear0.com/home/info/keyword-standard
- 耳聆网来源声明：https://www.ear0.com/home/info/keyword-copyright
- CC0：https://creativecommons.org/publicdomain/zero/1.0/
- CC BY 4.0许可原文（示例版本；不代表当前素材已确定是4.0）：https://creativecommons.org/licenses/by/4.0/legalcode.en

本站详情页读取出现超时/521，目前仅核对到耳聆网官方许可说明的搜索内容及Creative Commons官方原文；未取到这条声音的独立详情页。

## 后续接入与署名

取得用户原WAV与详情页后，填写同目录 `source-license.template.json`，把来源记录与实际源文件SHA-256绑定，再运行转码，复核两种编码后的峰值/大小/听感。

确认许可后，在现有音频manifest中新增`sfx_splash_user`，将fish_place指向它，原`sfx_splash`继续保留。运行资源可进入audio/v3目录，保持v1/v2已认可文件不变。按许可提供第三方声音署名记录及玩家可达的致谢入口。若选择部署侧私放，网页依然会向玩家传输音频，**这不是绕开许可要求的方法**。

本次只有可运行管线、模板与测试，v2默认声音与manifest保持原样，不指向不存在的用户文件；没有部署、没有game.js或数据库改动。

## 验证边界

自制有削顶的48kHz立体声脉冲夹具：转码、1.55秒时长、32kHz单声道、OGG/MP3解码、输出无过载、编码后及4倍重采样峰值、文件体积、缺文件失败与来源hash不匹配失败。详见pipeline-test.json。

用户原WAV处理、用户试听、源文件原许可、真实浏览器和实站接入：全部未验证，等待原文件及详情页。


## 2026-10-30 Windows 兼容修订（评论 6503975540）

许可 JSON 改为显式 `utf-8-sig` 读取，兼容中文、UTF-8 BOM；输出 JSON 固定 UTF-8。
FFmpeg 路径优先级：`--ffmpeg` > `AQUARIUM_FFMPEG` > `FFMPEG` > PATH；FFprobe 同理（`--ffprobe` / `AQUARIUM_FFPROBE` / `FFPROBE`）。使用参数数组调用，不拼 shell，带空格的可执行路径可用。

```powershell
python tools/transcode_aquarium_user_splash.py "掉落水中.wav" --out "splash-output" --ffmpeg "E:\tool\BBDownloader_Windows_1.3.2\BB\windows\ffmpeg\ffmpeg.exe" --license-record "source-license.json"
```

FFprobe 缺失、启动失败（含缺 DLL）或探测失败时，PCM WAV 用 Python 标准库读取精确格式/时长；其他音频回退 FFmpeg 源音轨信息与实际解码长度。FFmpeg 本体仍必须可运行；失败不会伪造探测值。原限峰/转码处理参数不变。

24 项自制夹具检查通过：新增中文 BOM、带空格的工具路径、环境变量和命令行、缺 probe 的 WAV/OGG、模拟坏 probe、非法 FFmpeg 路径。运行环境为 Linux；没有声称原生 Windows 测过。

小蓝已在本机用真实 WAV 跑出 OGG 17,728 B、MP3 13,292 B，4 倍重采样峰值最高 0.492，符合 0.55 上限；这是小蓝回执，本环境没有原 WAV 或这两个输出，未独立复测。许可仍未核验。本次只修工具，不要求重新做已通过的主观试听；请用修订脚本复核真实文件的报告即可。

“部署侧放文件”同样会向浏览器提供音频，不能代替授权核验。许可不明确期间交付继续保留合成 `sfx_splash` 备选，第三方素材不激活进发布 manifest。
