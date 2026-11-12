#!/usr/bin/env python3
# (C) 2026 Carinoasd. Original score rendering: 小典 / Codex.
"""Render original PCM music/SFX and a file://-safe JS bank, stdlib only.

An authoring utility, never required at runtime. Source notes stay untouched.
The output directory must be new. --install updates only the local audio bank.
"""
import argparse
from array import array
import base64
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import struct
import wave

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/danmaku/audio/stage01-v1'
SCORE = json.loads((SOURCE / 'score.json').read_text(encoding='utf-8'))
RATE = SCORE['sampleRate']
TAU = math.tau


@lru_cache(maxsize=256)
def tone(kind, midi, duration):
    frequency = 440 * 2 ** ((midi - 69) / 12)
    count = max(1, round(duration * RATE))
    result = array('f')
    for i in range(count):
        t = i / RATE
        phase = TAU * frequency * t
        attack = min(1, t / (.045 if kind == 'pad' else .006))
        release = min(1, (duration - t) / (.18 if kind == 'pad' else .045))
        if kind == 'pad':
            value = (.72 * math.sin(phase) + .19 * math.sin(phase * 1.0018) + .09 * math.sin(phase * 2)) * math.sin(math.pi * t / duration) ** .5
        elif kind == 'bass':
            value = (math.sin(phase) + .19 * math.sin(phase * 2)) * math.exp(-1.8 * t / duration)
        elif kind == 'bell':
            value = (math.sin(phase) + .25 * math.sin(phase * 2.006) + .08 * math.sin(phase * 3.01)) * math.exp(-5 * t / duration)
        elif kind == 'arp':
            value = (math.sin(phase) + .15 * math.sin(phase * 3)) * math.exp(-4 * t / duration)
        else:
            value = (math.sin(phase) + .22 * math.sin(phase * 2) + .11 * math.sin(phase * 3)) * math.exp(-1.4 * t / duration)
        result.append(value * attack * release)
    return result


@lru_cache(maxsize=32)
def drum(kind, duration):
    result = array('f')
    seed = 81317
    phase = 0
    for i in range(round(duration * RATE)):
        t = i / RATE
        seed = (seed * 1664525 + 1013904223) & 0xffffffff
        noise = seed / 2147483648 - 1
        if kind == 'kick':
            phase += TAU * (52 + 85 * math.exp(-t * 38)) / RATE
            value = math.sin(phase) * math.exp(-t * 21)
        elif kind == 'snare':
            value = (noise * .65 + math.sin(TAU * 180 * t) * .35) * math.exp(-t * 36)
        else:
            value = noise * math.exp(-t * 90)
        result.append(value * min(1, t / .002) * min(1, (duration - t) / .012))
    return result


def add(target, voice, when, gain, loop=False):
    start, n = round(when * RATE), len(target)
    if loop:
        for i, value in enumerate(voice):
            target[(start + i) % n] += value * gain
    else:
        end = min(len(voice), n - start)
        for i in range(max(0, end)):
            target[start + i] += voice[i] * gain


def music(name):
    meta = SCORE['tracks'][name]
    target = array('f', [0]) * round(meta['seconds'] * RATE)
    loop = meta['loop']
    if name in ('stage', 'bossCore', 'bossDrive'):
        stage = name == 'stage'
        beat = 60 / SCORE['stageBpm' if stage else 'bossBpm']
        bars = SCORE['stageBars' if stage else 'bossBars']
        for bar in range(bars):
            phrase = (bar - 2) % 8 if stage else bar % 8
            chord = SCORE['chords'][phrase]
            start = bar * 4 * beat
            closing = stage and bar >= 31
            energy = .5 if stage and bar < 2 else .58 if closing else 1
            if name != 'bossDrive':
                for note in chord[1:]:
                    add(target, tone('pad', note, round(4.2 * beat, 4)), start, .048 * energy, loop)
                for pulse in (0, 2):
                    add(target, tone('bass', chord[0] - 12, round(1.6 * beat, 4)), start + pulse * beat, .13 * energy, loop)
                if not closing:
                    for eighth in range(8):
                        note = chord[(eighth * 3 + bar) % 4] + 12
                        add(target, tone('arp', note, round(.72 * beat, 4)), start + eighth * beat / 2, .046 * energy, loop)
                if (not stage or bar >= 2) and not (stage and bar >= 34):
                    melody = SCORE['phrases'][phrase]
                    for eighth, note in enumerate(melody):
                        if stage and bar < 10 and eighth == 7:
                            continue
                        if closing and eighth % 2:
                            continue
                        offset = .06 * beat if not stage and eighth % 2 else 0
                        length = beat * (.75 if closing else .46)
                        add(target, tone('bell' if stage and bar < 18 else 'lead', note, round(length + .12, 4)), start + eighth * beat / 2 + offset, .135 * energy, loop)
                if not stage or 10 <= bar < 31:
                    for pulse in (0, 2):
                        add(target, drum('kick', .22), start + pulse * beat, .09 * energy, loop)
                if stage and bar >= 34:
                    for i, note in enumerate([74, 77, 81, 86]):
                        add(target, tone('bell', note, .9), start + i * beat, .09 * energy)
            else:
                for pulse in (1, 3):
                    add(target, drum('snare', .16), start + pulse * beat, .12, loop)
                for sixteenth in range(16):
                    add(target, drum('hat', .055), start + sixteenth * beat / 4, .035 if sixteenth % 2 else .05, loop)
                    if sixteenth % 2:
                        add(target, tone('arp', chord[sixteenth % 4] + 24, .19), start + sixteenth * beat / 4, .055, loop)
                add(target, tone('bass', chord[0] - 12, .32), start + 3.5 * beat, .09, loop)
    else:
        sequences = {'intro': ([50, 57, 62, 65, 69, 73], .31), 'clear': ([65, 69, 72, 77, 81, 84, 89], .36), 'defeat': ([74, 69, 65, 62, 57], .35)}
        notes, interval = sequences[name]
        for i, note in enumerate(notes):
            add(target, tone('bell' if name != 'defeat' else 'pad', note, 1.1), i * interval, .18)
        chord = [53, 60, 65, 69] if name == 'clear' else [50, 57, 62]
        for note in chord:
            add(target, tone('pad', note, meta['seconds'] - .1), 0, .07)
    return target


SFX = {
    'shot': ('自机射击', .055), 'hit': ('命中目标', .075), 'enemy': ('敌人发射', .09),
    'graze': ('擦弹', .12), 'pickup': ('强化拾取', .23), 'upgrade': ('火力提升', .65),
    'hurt': ('自机受击', .38), 'bomb': ('星翼绽放', 1.0), 'kill': ('小怪击破', .18),
    'elite': ('守卫击破', .6), 'charge': ('蓄力锁定', .4), 'supply': ('大招补给', .4),
    'phase': ('阶段突破', .8), 'menu': ('菜单确认', .12), 'win': ('胜利提示', .85), 'lose': ('终局提示', .65)
}


def effect(name, seconds):
    target = array('f', [0]) * round(seconds * RATE)
    if name in ('pickup', 'upgrade', 'supply', 'phase', 'menu', 'win', 'elite'):
        notes = {'pickup':[86,93], 'upgrade':[74,77,81,86], 'supply':[74,81,84,89], 'phase':[69,74,77,81,86], 'menu':[77,81], 'win':[77,81,84,89], 'elite':[62,69,74,81]}[name]
        interval = seconds * .6 / len(notes)
        for i, note in enumerate(notes):
            add(target, tone('bell', note, round(seconds * .55, 4)), i * interval, .32)
    else:
        params = {'shot':(1700,950,.05), 'hit':(470,230,.3), 'enemy':(800,430,.08), 'graze':(1500,2300,.55), 'hurt':(230,70,.6), 'bomb':(100,650,.35), 'kill':(350,120,.5), 'charge':(330,880,.04), 'lose':(260,80,.25)}
        low, high, noise_gain = params[name]
        phase, seed = 0, 54881
        for i in range(len(target)):
            t = i / RATE
            progress = t / seconds
            phase += TAU * (low + (high - low) * progress) / RATE
            seed = (seed * 1664525 + 1013904223) & 0xffffffff
            noise = seed / 2147483648 - 1
            envelope = min(1, t / .006) * (1 - progress) ** 2
            target[i] = (math.sin(phase) * (1 - noise_gain) + noise * noise_gain) * envelope
        if name == 'bomb':
            for i, note in enumerate([62, 69, 74, 81]):
                add(target, tone('bell', note, .7), i * .055, .16)
    return target


def write_track(path, samples, loop, peak):
    if not loop:
        for i in range(len(samples)):
            samples[i] *= min(1, i / (RATE * .012), (len(samples) - 1 - i) / (RATE * .06))
    maximum = max(abs(v) for v in samples)
    scale = peak / maximum if maximum else 0
    pcm = array('h', (round(v * scale * 32767) for v in samples))
    import sys
    if sys.byteorder != 'little':
        pcm.byteswap()
    with wave.open(str(path), 'wb') as output:
        output.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        output.writeframes(pcm.tobytes())
    rms = math.sqrt(sum((v * scale) ** 2 for v in samples) / len(samples))
    return {'seconds':len(samples) / RATE, 'samples':len(samples), 'peak':round(peak, 4), 'rms':round(rms, 5), 'loopJump':round(abs(samples[0] - samples[-1]) * scale, 6), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=SOURCE / 'render-v1')
    parser.add_argument('--install', action='store_true')
    args = parser.parse_args()
    destination = args.output.resolve()
    if destination.exists():
        raise SystemExit('Output exists; use a new version/path')
    destination.mkdir(parents=True)
    bank = {'v':1, 'sampleRate':RATE, 'entries':{}}
    report = {'author':'小典 / Codex', 'source':'score.json and mathematical synthesis', 'sampleRate':RATE, 'channels':1, 'bits':16, 'entries':{}}
    for name, meta in SCORE['tracks'].items():
        path = destination / (name + '.wav')
        stats = write_track(path, music(name), meta['loop'], .45 if name == 'bossDrive' else .62)
        bank['entries'][name] = {'title':meta['title'], 'loop':meta['loop'], 'kind':'music', 'seconds':stats['seconds'], 'data':base64.b64encode(path.read_bytes()).decode('ascii')}
        report['entries'][name] = stats
        print('Rendered '+name, flush=True)
    for name, (title, seconds) in SFX.items():
        path = destination / (name + '.wav')
        stats = write_track(path, effect(name, seconds), False, .65)
        bank['entries'][name] = {'title':title, 'loop':False, 'kind':'sfx', 'seconds':stats['seconds'], 'data':base64.b64encode(path.read_bytes()).decode('ascii')}
        report['entries'][name] = stats
    script = '/* (C) 2026 Carinoasd. Original audio bank: 小典 / Codex. Generated by build_stage01_audio.py. */\nwindow.DanmakuAudioBank='+json.dumps(bank, ensure_ascii=False, separators=(',', ':'))+';\n'
    (destination / 'audio-bank.js').write_text(script, encoding='utf-8', newline='\n')
    (destination / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.install:
        (ROOT / 'source/plugin/gamecenter/games/_danmaku_proto/audio-bank.js').write_text(script, encoding='utf-8', newline='\n')
    print(json.dumps({'status':'PASS', 'music':len(SCORE['tracks']), 'sfx':len(SFX), 'bankBytes':len(script.encode('utf-8')), 'loopJumps':{k:v['loopJump'] for k,v in report['entries'].items() if k.startswith('boss')}}))


if __name__ == '__main__':
    main()
