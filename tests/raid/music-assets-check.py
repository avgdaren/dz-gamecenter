#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。真实音轨检查；缺FFmpeg报SKIP，不代替耳听。"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'source/plugin/gamecenter/games/raid/assets'

def executable():
    candidate = os.environ.get('FFMPEG_BIN', 'ffmpeg').strip().strip('"')
    return shutil.which(candidate) or (candidate if Path(candidate).is_file() else None)

def parse_loudnorm(stderr, stdout=''):
    decoder = json.JSONDecoder()
    for output in (stderr or '', stdout or ''):
        for offset, char in enumerate(output):
            if char != '{':
                continue
            try:
                value, _ = decoder.raw_decode(output[offset:])
                if isinstance(value, dict) and 'input_i' in value and 'input_tp' in value:
                    return value
            except (ValueError, TypeError):
                continue
    raise ValueError('loudnorm JSON missing; stderr[:200]=' + repr((stderr or '')[:200]) + '; stdout[:200]=' + repr((stdout or '')[:200]))

def main():
    ffmpeg = executable()
    if not ffmpeg:
        print(json.dumps({'status': 'SKIP', 'reason': 'FFmpeg unavailable; set FFMPEG_BIN to its executable path'}))
        return 0
    checks = 0
    def check(value, label):
        nonlocal checks
        if not value:
            raise AssertionError(label)
        checks += 1
    tracks = {}
    for name in ('battle.mp3', 'battle-phase2.mp3'):
        path = ASSETS / name
        check(path.is_file() and 0 < path.stat().st_size <= 800_000, name + ' file budget')
        run = subprocess.run([ffmpeg, '-hide_banner', '-nostats', '-i', str(path),
                              '-af', 'loudnorm=I=-12:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'],
                             capture_output=True, text=True, encoding='utf-8', errors='replace', check=True)
        measured = parse_loudnorm(run.stderr, run.stdout)
        integrated, peak = float(measured['input_i']), float(measured['input_tp'])
        check(-13 <= integrated <= -12, name + ' integrated loudness range')
        check(peak <= -.5, name + ' decoded true peak headroom')
        tracks[name] = {'integrated_lufs': integrated, 'true_peak_db': peak, 'bytes': path.stat().st_size,
                       'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    first, second = tracks.values()
    check(abs(first['integrated_lufs'] - second['integrated_lufs']) <= .5, 'two tracks loudness matched')
    check(first['sha256'] != second['sha256'], 'second phase is a different track')
    print(json.dumps({'status': 'PASS', 'checks': checks, 'tracks': tracks, 'scope': 'decoded files; no listening claim'}))
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, AssertionError, OSError, subprocess.CalledProcessError) as exc:
        print(json.dumps({'status': 'FAIL', 'reason': str(exc),
                          'stderr_preview': (getattr(exc, 'stderr', None) or '')[:200]}, ensure_ascii=False))
        raise SystemExit(1)
