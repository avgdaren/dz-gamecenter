"""(C) 2026 Carinoasd. User-supplied HappyShrimp BGM preparation: 小典 / Codex.

Production-only FFmpeg; the game uses native Web Audio and bundled MP3 bytes.
Original user files stay untouched outside the repository. No account metadata,
embedded cover, work IDs or trace IDs are carried into the runtime derivatives.
"""
import argparse
import array
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / 'source/plugin/gamecenter/games/_danmaku_proto/bgm-bank.js'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def run(ffmpeg, *args):
    return subprocess.run([str(ffmpeg), '-hide_banner', '-loglevel', 'error', '-nostdin', *map(str, args)],
                          check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def pcm(ffmpeg, source, rate=22050):
    samples = array.array('f', run(ffmpeg, '-i', source, '-map', '0:a:0', '-ac', 2, '-ar', rate, '-f', 'f32le', '-'))
    if sys.byteorder != 'little':
        samples.byteswap()
    return samples


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', type=Path, required=True)
    parser.add_argument('--stage', type=Path, required=True)
    parser.add_argument('--boss', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=ROOT / 'docs/danmaku/audio/stage01-happyshrimp-v1')
    parser.add_argument('--install', action='store_true')
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit('Refusing to overwrite an existing production directory')
    originals = {'stage': args.stage, 'bossCore': args.boss}
    original_durations = {key: len(pcm(args.ffmpeg, file, 4000)) / 8000 for key, file in originals.items()}
    assert original_durations['stage'] > 72
    boss_seconds = original_durations['bossCore']
    fade = 1.5
    args.output.mkdir(parents=True)
    # Preserve the full boss arrangement on the first pass. The final 1.5s blends
    # into its own opening; subsequent laps resume at 1.5s, avoiding a second intro.
    filters = {
        'stage': 'atrim=start=0:end=72,asetpts=PTS-STARTPTS,volume=-4dB,afade=t=in:d=0.02,afade=t=out:st=71.2:d=0.8',
        'bossCore': (f'[0:a:0]atrim=end={boss_seconds:.6f},asetpts=PTS-STARTPTS,volume=-4dB[main];'
                     f'[1:a:0]atrim=end={fade},asetpts=PTS-STARTPTS,volume=-4dB[h];'
                     f'[main][h]acrossfade=d={fade}:c1=tri:c2=tri[out]')
    }
    bank = {'v': 1, 'format': 'recorded-happyshrimp', 'entries': {}}
    manifest = {'format': bank['format'], 'production': 'User supplied; composed with HappyShrimp using prompt engineering (user report).',
                'promptsProvided': False, 'ffmpegVersion': run(args.ffmpeg, '-version').decode().splitlines()[0],
                'originalsUnmodified': True, 'gainDb': -4, 'entries': {}}
    for key, source in originals.items():
        target = args.output / (key + '.mp3')
        argv = ['-i', source]
        if key == 'stage':
            argv += ['-map', '0:a:0', '-af', filters[key]]
        else:
            argv += ['-i', source, '-filter_complex', filters[key], '-map', '[out]']
        run(args.ffmpeg, *argv, '-vn', '-map_metadata', '-1', '-ar', 44100, '-ac', 2,
            '-c:a', 'libmp3lame', '-b:a', '192k', '-id3v2_version', '3',
            '-metadata', 'comment=AI-generated music; HappyShrimp; prepared for private game use', target)
        data = target.read_bytes()
        values = pcm(args.ffmpeg, target)
        seconds = len(values) / (22050 * 2)
        assert abs(seconds - (72 if key == 'stage' else boss_seconds)) < .01
        peak = max(abs(v) for v in values)
        rms = (sum(v * v for v in values) / len(values)) ** .5
        assert peak < .95 and rms > .005
        entry = {'kind': 'music', 'mime': 'audio/mpeg', 'seconds': seconds,
                 'loop': key == 'bossCore', 'loopStart': fade if key == 'bossCore' else 0,
                 'loopEnd': min(seconds, boss_seconds) if key == 'bossCore' else 0,
                 'data': base64.b64encode(data).decode('ascii')}
        bank['entries'][key] = entry
        manifest['entries'][key] = {k: v for k, v in entry.items() if k != 'data'} | {
            'title': 'ヘクサフュージョン' if key == 'stage' else '残响',
            'sourceSha256': sha(source.read_bytes()), 'sourceSeconds': original_durations[key],
            'sha256': sha(data), 'bytes': len(data), 'peak': round(peak, 7), 'rms': round(rms, 7),
            'channels': 2, 'sampleRate': 44100, 'filter': filters[key]}
    script = ('/* (C) 2026 Carinoasd. HappyShrimp music supplied by user; preparation: 小典 / Codex. */\n'
              'window.DanmakuBgmBank=' + json.dumps(bank, ensure_ascii=False, separators=(',', ':')) + ';\n')
    (args.output / 'bgm-bank.js').write_text(script, encoding='utf-8', newline='\n')
    (args.output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.install:
        RUNTIME.write_text(script, encoding='utf-8', newline='\n')
    print(json.dumps(manifest, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
