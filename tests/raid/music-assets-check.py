#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。检查真实本地音轨响度；不代替耳听。"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'source/plugin/gamecenter/games/raid/assets'
checks = 0

def check(value, label):
    global checks
    if not value:
        raise AssertionError(label)
    checks += 1

tracks = {}
for name in ('battle.mp3', 'battle-phase2.mp3'):
    path = ASSETS / name
    check(path.is_file() and 0 < path.stat().st_size <= 800_000, name + ' file budget')
    run = subprocess.run([os.environ.get('FFMPEG_BIN', 'ffmpeg'), '-hide_banner', '-nostats', '-i', str(path),
                          '-af', 'loudnorm=I=-12:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'],
                         capture_output=True, text=True, check=True)
    measured = json.loads(re.findall(r'\{[^{}]+\}', run.stderr)[-1])
    integrated, peak = float(measured['input_i']), float(measured['input_tp'])
    check(-13 <= integrated <= -12, name + ' integrated loudness range')
    check(peak <= -.5, name + ' decoded true peak headroom')
    tracks[name] = {'integrated_lufs': integrated, 'true_peak_db': peak, 'bytes': path.stat().st_size,
                    'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
first, second = tracks.values()
check(abs(first['integrated_lufs'] - second['integrated_lufs']) <= .5, 'two tracks loudness matched')
check(first['sha256'] != second['sha256'], 'second phase is a different track')
print(json.dumps({'status': 'PASS', 'checks': checks, 'tracks': tracks, 'scope': 'decoded files; no listening claim'}))
