#!/usr/bin/env python3
"""Aquarium audio v1. Original score/synthesis: GPT / Codex, 2026-10-30.
Original gamecenter plugin (C) 2026 Carinoasd. No external samples.
Offline production only; numpy/scipy/ffmpeg are NOT runtime dependencies.
Usage: python3 render_audio.py --out /absolute/path/to/output
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BPM = 80
BEAT = 60 / BPM
BARS = 48
DURATION = BARS * 4 * BEAT
SEED = 20261030


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def edge_fade(x, attack=0.006, release=0.055):
    a = min(len(x), max(2, round(attack * SR)))
    r = min(len(x), max(2, round(release * SR)))
    x[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    x[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return x


def voice(midi, seconds, kind, velocity=1):
    t = np.arange(round(seconds * SR), dtype=np.float64) / SR
    f = hz(midi)
    if kind == 'keys':
        # Rounded electric-key/piano-like tones, deliberately little high energy.
        x = np.sin(2*np.pi*f*t + 0.42*np.sin(2*np.pi*f*t)*np.exp(-t*4))
        x += .22*np.sin(2*np.pi*f*2*t)*np.exp(-t*2.4)
        x += .065*np.sin(2*np.pi*f*3*t)*np.exp(-t*4)
        x *= np.exp(-t/1.65)
    elif kind == 'mallet':
        x = np.sin(2*np.pi*f*t)*np.exp(-t/.65)
        x += .14*np.sin(2*np.pi*f*2.78*t)*np.exp(-t/.15)
        x += .04*np.sin(2*np.pi*f*4.12*t)*np.exp(-t/.09)
    elif kind == 'harp':
        x = np.zeros_like(t)
        for k in range(1, 7):
            x += np.sin(2*np.pi*f*k*t + .13*k)/(k**1.9)*np.exp(-t*(.95+.7*k))
    elif kind == 'bass':
        x = (np.sin(2*np.pi*f*t)+.16*np.sin(2*np.pi*f*2*t))*np.exp(-t/1.7)
    elif kind == 'pad':
        x = (np.sin(2*np.pi*f*t)+.28*np.sin(2*np.pi*f*1.0018*t)+.08*np.sin(2*np.pi*f*2*t))
        x *= np.minimum(1, t/.8) * np.minimum(1, (seconds-t)/1.3)
    else:
        raise ValueError(kind)
    return edge_fade(x * velocity, .012 if kind == 'keys' else .005,
                     .25 if kind == 'pad' else .075).astype(np.float32)


def stereo(x, pan=0):
    theta = (pan+1)*np.pi/4
    return np.stack((x*np.cos(theta), x*np.sin(theta)), axis=1)


def add_wrap(track, signal, offset):
    start = round(offset*SR) % len(track)
    while len(signal):
        count = min(len(signal), len(track)-start)
        track[start:start+count] += signal[:count]
        signal = signal[count:]
        start = 0


def lowpass(x, cutoff):
    return sosfilt(butter(2, cutoff, fs=SR, output='sos'), x, axis=0).astype(np.float32)


def finish(track, rms_db=-23, peak_db=-4):
    track -= track.mean(axis=0)
    rms = np.sqrt(np.mean(track.astype(np.float64)**2))
    track *= 10**(rms_db/20) / max(rms, 1e-9)
    peak = np.max(np.abs(track))
    if peak > 10**(peak_db/20):
        track *= 10**(peak_db/20)/peak
    return track


def compose():
    rng = np.random.default_rng(SEED)
    track = np.zeros((round(DURATION*SR), 2), np.float32)
    chords = [
        (38, [62,66,69,73,76]), (35, [59,62,66,69,73]),
        (31, [55,62,66,69,71]), (33, [57,64,69,71,76]),
        (30, [57,61,66,69,73]), (35, [59,62,66,69,74]),
        (28, [55,59,62,66,69]), (33, [57,61,64,69,71]),
    ]
    melody_a = [
        [(0,74,1.2),(1.5,78,.7),(2.5,76,.5),(3.25,73,.6)],
        [(0,71,1.1),(1.5,74,.7),(2.75,78,.9)],
        [(.5,79,.7),(1.5,78,.6),(2.5,74,1.2)],
        [(0,76,1.3),(2,73,.7),(3,69,.65)],
        [(.5,73,.7),(1.5,76,.7),(2.75,78,.9)],
        [(0,74,1.2),(1.75,73,.6),(2.75,71,.9)],
        [(.5,71,.8),(1.75,74,.7),(3,76,.7)],
        [(0,73,1.2),(1.75,71,.6),(3,69,.7)],
    ]
    melody_b = [
        [(.5,78,1.1),(2,81,.7),(3,78,.7)],
        [(0,78,.7),(1,76,.7),(2.5,74,1.2)],
        [(0,74,.8),(1.5,71,.8),(3,69,.65)],
        [(.5,71,.7),(1.5,73,.7),(2.5,76,1)],
        [(0,78,1.3),(2,76,.7),(3.25,73,.55)],
        [(.5,74,.8),(2,78,.8),(3.25,74,.55)],
        [(0,76,.9),(1.5,74,.7),(2.75,71,.9)],
        [(.5,73,1),(2,71,.7),(3,69,.65)],
    ]
    events = []
    def note(beat, midi, seconds, kind, amp, pan):
        off = beat*BEAT
        signal = stereo(voice(midi, seconds, kind, amp), pan)
        add_wrap(track, signal, off)
        events.append({'beat':round(beat,4),'midi':midi,'seconds':seconds,
                       'instrument':kind,'amplitude':round(amp,5),'pan':round(pan,4)})

    for bar in range(BARS):
        phrase, pos = divmod(bar, 8)
        root, chord = chords[pos]
        # Six eight-bar sections: A, A variation, B, breathing space, A', B'.
        energy = [0.82, 1.0, 1.03, .70, .94, .86][phrase]
        note(bar*4, root+12, 2.65, 'bass', .075*energy, -.05)
        if pos in (1,3,5,7) and phrase != 3:
            note(bar*4+2.5, root+19, 1.1, 'bass', .022*energy, .05)
        for j, m in enumerate(chord[:4]):
            note(bar*4+j*.035, m, 3.3, 'keys', .036*energy, -.30+j*.19)
        # Spacious, asymmetric plucks, with occasional missing beats.
        arp = [(0.75,1),(1.5,2),(2.75,3),(3.5,4)]
        for j,(offset,index) in enumerate(arp):
            if phrase == 3 and j % 2: continue
            human = rng.uniform(-.016,.016)
            note(bar*4+offset+human, chord[index], 1.15, 'harp',
                 .030*energy*rng.uniform(.86,1.06), -.5 if j%2==0 else .42)
        mel = melody_b if phrase in (2,5) else melody_a
        for k,(offset,m,dur) in enumerate(mel[pos]):
            if phrase == 3 and k > 0: continue
            if phrase == 4 and pos in (2,6) and k == 0: m += 2
            note(bar*4+offset+.025, m, dur*BEAT+.7, 'keys',
                 .105*energy*rng.uniform(.92,1.05), .07)
        # A soft answering wooden tone, not a constant bell ostinato.
        if pos in (1,3,6) and phrase in (1,2,4,5):
            note(bar*4+3.35, chord[2]+12, 1.1, 'mallet', .035*energy, -.25)
        for j,m in enumerate(chord[1:4]):
            note(bar*4, m-12, 4.5, 'pad', .0095*energy, [-.65,0,.65][j])

    dry = track.copy()
    # Circular early reflections preserve tails across the exact 144s boundary.
    for delay,gain in [(.071,.065),(.113,.058),(.179,.052),(.263,.045),
                       (.379,.037),(.503,.030),(.677,.022),(.887,.016)]:
        wet = np.roll(dry, round(delay*SR), axis=0)
        if int(delay*1000)%2: wet = wet[:,::-1]
        track += wet*gain
    # Use periodic pre-roll for IIR continuity, then remove it.
    track = lowpass(np.concatenate((track[-SR:], track)), 5600)[SR:]
    track = finish(track, -23, -4)
    return track, events


def effects():
    rng = np.random.default_rng(SEED+1)
    # A small bubble, not a large realistic splash.
    t = np.arange(round(.48*SR))/SR
    f = 180 + 450*np.exp(-t*17)
    bubble = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*16)
    noise = lowpass(rng.normal(0,.045,len(t)), 2200)*np.exp(-t*24)
    place = edge_fade(bubble*.48+noise, .004, .1)
    place += np.pad(voice(86,.16,'mallet',.025),(round(.14*SR),len(t)-round(.30*SR)))
    # Quiet tactile click/pop; avoids a high, hard bell.
    t2 = np.arange(round(.16*SR))/SR
    click = edge_fade(np.sin(2*np.pi*np.cumsum(520-240*t2/.16)/SR)*np.exp(-t2*48), .003,.035)
    # Three gentle rising notes, a clear successful-operation cue.
    success = np.zeros(round(.95*SR),np.float32)
    for start,m,amp in [(0,74,.42),(.13,78,.34),(.29,81,.28)]:
        x = voice(m, min(.65,.95-start),'mallet',amp)
        a=round(start*SR);success[a:a+len(x)] += x
    return {
        'sfx_place':finish(stereo(place),-22,-7),
        'sfx_select':finish(stereo(click),-26,-10),
        'sfx_success':finish(stereo(success),-23,-7),
    }


def write_wav(path, x):
    with wave.open(str(path),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR)
        w.writeframes(np.round(np.clip(x,-1,1)*32767).astype('<i2').tobytes())


def encode(wav, dest, fmt):
    codec=['-c:a','libvorbis','-q:a','3'] if fmt=='ogg' else ['-c:a','libmp3lame','-b:a','96k']
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),
                    '-map_metadata','-1',*codec,str(dest)],check=True)


def decode(path):
    r=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(path),
                      '-f','f32le','-ar',str(SR),'-ac','2','pipe:1'],
                     check=True,stdout=subprocess.PIPE)
    return np.frombuffer(r.stdout,dtype='<f4').reshape(-1,2)


def stats(x):
    rms=np.sqrt(np.mean(x.astype(np.float64)**2))
    return {'duration_seconds':round(len(x)/SR,6),
            'peak_dbfs':round(float(20*np.log10(max(np.max(np.abs(x)),1e-12))),3),
            'rms_dbfs':round(float(20*np.log10(max(rms,1e-12))),3),
            'dc_abs_max':float(np.max(np.abs(x.mean(axis=0)))),
            'clipped_samples':int(np.count_nonzero(np.abs(x)>=1)),
            'finite':bool(np.isfinite(x).all())}


def main():
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);a=p.parse_args()
    out=Path(a.out); out.mkdir(parents=True,exist_ok=True)
    masters=out/'masters';masters.mkdir(exist_ok=True)
    bgm,events=compose()
    items={'bgm_sunlit_fish':bgm,**effects()}
    report={'author':'GPT / Codex','date':'2026-10-30','sample_rate':SR,
            'bpm':BPM,'bars':BARS,'seed':SEED,'files':{},
            'limitations':['No live forum/browser or subjective listening acceptance claimed.']}
    for name,x in items.items():
        wav=masters/(name+'.wav');write_wav(wav,x)
        for fmt in ['ogg','mp3']:
            dest=out/(name+'.'+fmt);encode(wav,dest,fmt)
            decoded=decode(dest); info=stats(decoded)
            info.update({'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),
                         'git_blob_sha':hashlib.sha1(b'blob '+str(dest.stat().st_size).encode()+b'\0'+dest.read_bytes()).hexdigest()})
            if name.startswith('bgm'):
                # Continuity metric against local ordinary-sample steps.
                jump=float(np.max(np.abs(decoded[0]-decoded[-1])))
                window=np.concatenate((decoded[-SR//10:],decoded[:SR//10]))
                local=float(np.percentile(np.abs(np.diff(window,axis=0)),99))
                info['loop_boundary_step']=jump
                info['local_sample_step_p99']=local
                info['loop_step_ratio']=jump/max(local,1e-9)
            assert info['finite'] and info['clipped_samples']==0
            assert abs(info['duration_seconds']-len(x)/SR)<.08
            report['files'][dest.name]=info
    # A 24s audition excerpt and a loop-boundary proof, both exact WAV.
    write_wav(masters/'preview_24s.wav',bgm[:24*SR])
    write_wav(masters/'loop_boundary_12s.wav',np.concatenate((bgm[-6*SR:],bgm[:6*SR])))
    encode(masters/'preview_24s.wav',out/'preview_24s.mp3','mp3')
    write_wav(masters/'sfx_audition.wav',np.concatenate((items['sfx_place'],np.zeros((SR//2,2)),items['sfx_select'],np.zeros((SR//2,2)),items['sfx_success'])))
    encode(masters/'sfx_audition.wav',out/'sfx_audition.mp3','mp3')
    (out/'score.json').write_text(json.dumps({'title':'晴光里的小鱼','bpm':BPM,'bars':BARS,'events':events},ensure_ascii=False,indent=2)+'\n')
    (out/'qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'duration':DURATION,'event_count':len(events),'files':{k:{q:v[q] for q in ['bytes','duration_seconds','peak_dbfs','rms_dbfs']} for k,v in report['files'].items()}},ensure_ascii=False))


if __name__=='__main__':
    main()
