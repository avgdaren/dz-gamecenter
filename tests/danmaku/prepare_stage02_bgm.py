"""(C) 2026 Carinoasd. Stage 2 supplied-music intake: 小典 / Codex.

Production helper only. Remuxes complete MP3 audio without re-encoding, removes
metadata/artwork, and checks decoded PCM against each original. No runtime edits.
"""
import argparse
import hashlib
from html import escape
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def run(binary, *args):
    return subprocess.run([str(binary), *map(str, args)], check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def probe(binary, file):
    return json.loads(run(binary, '-v', 'error', '-show_streams',
                          '-show_format', '-of', 'json', file))


def decoded(binary, file):
    job = subprocess.Popen([str(binary), '-v', 'error', '-nostdin', '-i',
        str(file), '-map', '0:a:0', '-ac', '2', '-ar', '44100',
        '-c:a', 'pcm_s16le', '-f', 's16le', '-'],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    digest = hashlib.sha256()
    size = 0
    while data := job.stdout.read(131072):
        digest.update(data)
        size += len(data)
    error = job.stderr.read()
    assert job.wait() == 0, error.decode(errors='replace')
    assert size > 0 and size % 4 == 0
    return {'sha256': digest.hexdigest(), 'frames': size // 4,
            'seconds': size / (4 * 44100), 'format': 's16le/44100Hz/stereo'}


def preview(entries):
    cards = []
    for key, label in [('stage', '道中'), ('boss', 'Boss · 铃羽')]:
        e = entries[key]
        seconds = e['decodedPcm']['seconds']
        cards.append(f'''<article><h2>{label}</h2>
<p>{escape(e['title'])} · {int(seconds // 60)}分{seconds % 60:.1f}秒 · 完整音频</p>
<audio controls preload="metadata" src="{e['file']}"></audio>
<p><a href="{e['file']}" download>保存音频</a></p></article>''')
    return '''<!doctype html>
<!-- (C) 2026 Carinoasd. Stage 2 music review: 小典 / Codex. -->
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>风铃花庭 · 第二关音乐</title>
<style>*{box-sizing:border-box}body{margin:0;background:#eef2e8;color:#25473f;
font:16px/1.8 system-ui,"Microsoft YaHei",sans-serif}main{max-width:850px;margin:40px auto;
padding:0 22px}h1{font-size:30px}h2{font-size:21px;margin:0}p{margin:10px 0}
article{background:#fffdf7;border:1px solid #cad7ca;border-radius:14px;padding:23px;
margin:22px 0}audio{display:block;width:100%;margin:15px 0}a{color:#256352}
.note{font-size:14px;color:#536d62}li{margin:8px 0}</style></head><body><main>
<h1>风铃花庭 · 第二关音乐</h1>
<p>由 avg达人提供的两首成品，分别用于道中与铃羽Boss战。完整保留音频内容，供后续关卡、美术与弹幕编排复听，不自动播放。</p>
''' + '\n'.join(cards) + '''
<article><h2>值得复听的位置</h2><ul>
<li>道中约1:20、1:56附近：短时能量明显回落，观察这里是否适合换景、留白或重新引出主题。</li>
<li>Boss约1:40附近：有明显能量回落，可复听其前后的展开与收束关系。</li>
<li>两首后段都有再次增强的区间，可与前段的变化一起比较。</li>
</ul><p class="note">以上来自4秒能量统计，是复听候选位置。尚未通过听感核定乐句、拍号、BPM或循环点，也未设定实际关卡时长。</p></article>
<p class="note">本页不包含游戏。没有变速、变调、裁切、淡化或重新编码；已移除封面与原文件元数据，解码后的PCM与原件一致。原件仍在工作区根目录。</p>
<footer class="note">2026-11-14 · 音乐提供：avg达人；音频整理：小典 / Codex。原型 (C) 2026 Carinoasd。</footer>
</main></body></html>\n'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', type=Path, required=True)
    parser.add_argument('--ffprobe', type=Path, required=True)
    parser.add_argument('--stage', type=Path, required=True)
    parser.add_argument('--boss', type=Path, required=True)
    parser.add_argument('--analysis', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT/'docs/danmaku/audio/stage02-user-v1')
    parser.add_argument('--review-copy', type=Path)
    args = parser.parse_args()
    assert not args.output.exists(), 'Use a new versioned output folder'
    if args.review_copy:
        assert not args.review_copy.exists(), 'Review output already exists'
    signals = json.loads(args.analysis.read_text(encoding='utf-8'))
    originals = {'stage': args.stage, 'boss': args.boss}
    before = {key: sha(file) for key, file in originals.items()}
    runtime = ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
    protected = {p.relative_to(runtime).as_posix(): sha(p)
                 for p in runtime.rglob('*') if p.is_file()}
    args.output.mkdir(parents=True)
    entries = {}
    for key, source in originals.items():
        assert signals[key]['sha256'] == before[key], 'Analysis belongs to a different source'
        original_info = probe(args.ffprobe, source)
        original_pcm = decoded(args.ffmpeg, source)
        target = args.output/(key+'.mp3')
        run(args.ffmpeg, '-v', 'error', '-nostdin', '-i', source, '-map', '0:a:0',
            '-c:a', 'copy', '-map_metadata', '-1', '-map_chapters', '-1',
            '-id3v2_version', '0', '-write_id3v1', '0', target)
        info = probe(args.ffprobe, target)
        audio = info['streams']
        assert len(audio) == 1 and audio[0]['codec_type'] == 'audio'
        # MP3 Xing headers can expose the muxer's generic "Lavf" encoder tag.
        # No source account tags or embedded artwork should remain.
        assert not info['format'].get('tags')
        assert set(audio[0].get('tags', {})) <= {'encoder'}
        clean_pcm = decoded(args.ffmpeg, target)
        assert clean_pcm == original_pcm, 'Decoded audio changed during remux'
        entries[key] = {'file': target.name, 'sourceFile': source.name,
            'sourceSha256': before[key], 'title': original_info['format'].get('tags', {}).get('title', 'Majestic Bullet Storm'),
            'sha256': sha(target), 'bytes': target.stat().st_size,
            'codec': audio[0]['codec_name'], 'sampleRate': int(audio[0]['sample_rate']),
            'channels': audio[0]['channels'], 'decodedPcm': clean_pcm,
            'audioContentUnchanged': True, 'metadataAndCoverRemoved': True}
    manifest = {'version': 1, 'date': '2026-11-14', 'author': '小典 / Codex',
        'prototypeCopyright': '(C) 2026 Carinoasd', 'providedBy': 'avg达人',
        'production': 'User-supplied completed music; generation tool and prompts not specified for this pair.',
        'entries': entries, 'processing': 'MP3 stream copy only, full duration, metadata/artwork removed',
        'signalAnalysis': 'signal-analysis.json', 'tempoConfirmed': False,
        'listeningReviewPerformed': False, 'loopPointsChosen': False,
        'stageDurationChosen': False, 'runtimeIntegrated': False,
        'originalsUnchanged': True, 'gameRuntimeFilesUnchanged': len(protected)}
    assert {key: sha(file) for key, file in originals.items()} == before
    assert {p.relative_to(runtime).as_posix(): sha(p)
            for p in runtime.rglob('*') if p.is_file()} == protected
    (args.output/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    (args.output/'signal-analysis.json').write_text(json.dumps(signals, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    (args.output/'preview.html').write_text(preview(entries), encoding='utf-8', newline='\n')
    if args.review_copy:
        shutil.copytree(args.output, args.review_copy)
        for p in args.output.iterdir():
            assert p.read_bytes() == (args.review_copy/p.name).read_bytes()
    print(json.dumps({'status': 'PASS', 'entries': {k: {'seconds': v['decodedPcm']['seconds'],
        'bytes': v['bytes'], 'decodedAudioUnchanged': True} for k, v in entries.items()},
        'runtimeFilesUnchanged': len(protected)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
