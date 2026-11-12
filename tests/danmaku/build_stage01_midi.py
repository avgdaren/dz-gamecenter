#!/usr/bin/env python3
# (C) 2026 Carinoasd. Original electronic MIDI composition: 小典 / Codex.
"""Write real format-1 SMF files, event audit, and embedded MIDI/SFX banks.

Standard library only. MIDI is the music source and the actual runtime input.
Existing v1 music and every SFX original are preserved. Output must be new.
"""
import argparse
import base64
from collections import Counter
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/danmaku/audio/stage01-midi-v2'
SCORE = json.loads((SOURCE / 'score.json').read_text(encoding='utf-8'))
PPQ = SCORE['ppq']
PROGRAMS = SCORE['programsZeroBased']


def vlq(value):
    assert 0 <= value < 0x10000000
    parts = [value & 127]
    while value >> 7:
        value >>= 7
        parts.append((value & 127) | 128)
    return bytes(reversed(parts))


def meta(kind, value):
    return bytes([255, kind]) + vlq(len(value)) + value


def chunk(kind, value):
    return kind + struct.pack('>I', len(value)) + value


def compose(key):
    stage = key == 'stage'
    boss = key.startswith('boss')
    bpm = SCORE['stageBpm'] if stage else SCORE['bossBpm'] if boss else {'intro':160,'clear':180,'defeat':150}[key]
    bars = SCORE['stageBars'] if stage else SCORE['bossBars'] if boss else 2 if key == 'intro' else 3 if key == 'clear' else 1.5
    end = round(bars * 4 * PPQ)
    notes = []
    controls = []
    def note(track, channel, pitch, start, duration, velocity):
        at = round(start * PPQ)
        off = min(end, at + max(1, round(duration * PPQ)))
        if at < end and off > at:
            notes.append({'track':track, 'channel':channel, 'note':pitch, 'at':at, 'off':off, 'velocity':max(1,min(127,velocity))})
    if stage or boss:
        for bar in range(int(bars)):
            chord = SCORE['chords'][bar % 8]
            hook = SCORE['hooks'][bar % 8]
            start = bar * 4
            build = stage and 20 <= bar < 24
            breath = stage and 38 <= bar < 42
            full = not stage or bar >= 2
            core = key != 'bossDrive'
            drive = key != 'bossCore'
            if core:
                for step in (0,3,6,8,10,14):
                    pitch = chord[0] - 12 + (12 if step in (6,14) else 0)
                    note('bass',1,pitch,start+step/4,.19 if step%2 else .30,112 if step in (0,8) else 96)
                for pitch in chord[1:]:
                    note('pad',3,pitch+12,start+.12,3.35,54 if breath else 66)
                if full and not breath:
                    for i, (step, length) in enumerate(zip(SCORE['hookSteps'],SCORE['hookLengths'])):
                        pitch = hook[i] + (12 if boss and bar >= 16 and i in (1,5) else 0)
                        note('lead',0,pitch,start+step/4,length/4*.86,119 if i in (0,2,4) else 104)
                elif not full:
                    for i in (0,4,6):
                        note('lead',0,hook[i],start+SCORE['hookSteps'][i]/4,.22,98)
                else:
                    for i in (0,4):
                        note('lead',0,hook[i]-12,start+i/2,.62,92)
                # The core keeps a kick and backbeat even in phase one.
                for beat in range(4):
                    note('drums',9,36,start+beat,.12,122 if beat%2==0 else 112)
                    if beat%2:
                        note('drums',9,38,start+beat,.10,111)
                for eighth in range(8):
                    note('drums',9,42,start+eighth/2,.045,66 if eighth%2==0 else 88)
                if bar%8==0:
                    note('drums',9,49,start,.65,90)
            if drive:
                if not breath:
                    for step in range(1,16,2):
                        note('arp',2,chord[(step+bar)%4]+24,start+step/4,.13,76 if step%4==1 else 90)
                if boss:
                    for step in (2,5,10,13):
                        note('counter',4,chord[(step//3)%4]+24,start+step/4,.18,71)
                    note('drums',9,36,start+3.5,.12,94)
                for beat in (1,3):
                    note('drums',9,39,start+beat+.014,.10,93)
                    note('drums',9,46,start+beat+.5,.16,78)
                if build or bar%8==7:
                    count = 16 if build else 8
                    for i in range(count):
                        note('drums',9,38,start+2+i*2/count,.06,50+round(i/count*55))
                if build:
                    controls.append({'track':'lead','channel':0,'at':round(start*PPQ),'controller':74,'value':48+(bar-20)*23})
                elif bar == 24:
                    controls.append({'track':'lead','channel':0,'at':round(start*PPQ),'controller':74,'value':112})
    else:
        phrase = {'intro':[64,71,76,79,83,87,88,90], 'clear':[67,71,74,79,83,86,91,95], 'defeat':[76,71,67,64,59,52]}[key]
        for i,pitch in enumerate(phrase):
            note('lead',0,pitch,i*.5,.42 if key!='defeat' else .75,112-i*3 if key=='defeat' else 110)
        if key!='defeat':
            for beat in range(int(bars*4)):
                note('drums',9,36,beat,.12,114 if beat%2==0 else 95)
                if beat%2:
                    note('drums',9,38,beat,.1,108)
        for pitch in ([55,59,62] if key=='clear' else [52,59,64]):
            note('pad',3,pitch,0,bars*4-.2,65)
    return {'bpm':bpm,'tempo':round(60000000/bpm),'endTick':end,'notes':notes,'controls':controls}


def smf(key, music, programs=None, titles=None, key_signature=None):
    programs = PROGRAMS if programs is None else programs
    titles = {'stage':'NEON CORRIDOR','bossCore':'ASTRAL OVERDRIVE - CORE','bossDrive':'ASTRAL OVERDRIVE - DRIVE','boss':'ASTRAL OVERDRIVE','intro':'IGNITION','clear':'SKYLINE CLEAR','defeat':'REBOOT'} if titles is None else titles
    signature = bytes([1,1]) if key_signature is None else bytes([key_signature[0] & 255,key_signature[1]])
    title=titles[key]
    conductor=[(0,0,meta(3,title.encode())),(0,0,meta(2,b'Original composition: Codex / Xiaodian for avg; prototype (C) 2026 Carinoasd')),
               (0,0,meta(81,music['tempo'].to_bytes(3,'big'))),(0,0,meta(88,bytes([4,2,24,8]))),(0,0,meta(89,signature))]
    tracks=[conductor]
    names=sorted({n['track'] for n in music['notes']})
    for name in names:
        channel=next(n['channel'] for n in music['notes'] if n['track']==name)
        track=[(0,-3,meta(3,name.encode())),(0,-2,bytes([0xb0|channel,7,105])),(0,-2,bytes([0xb0|channel,10,82 if name=='arp' else 48 if name=='pad' else 64])),(0,-2,bytes([0xb0|channel,11,127]))]
        if channel!=9:
            track.append((0,-2,bytes([0xc0|channel,programs[name]])))
            track.append((0,-2,bytes([0xb0|channel,74,105])))
        for c in music['controls']:
            if c['track']==name:track.append((c['at'],-1,bytes([0xb0|channel,c['controller'],c['value']])))
        for n in music['notes']:
            if n['track']!=name:continue
            track.append((n['at'],1,bytes([0x90|channel,n['note'],n['velocity']])))
            track.append((n['off'],0,bytes([0x80|channel,n['note'],0])))
        tracks.append(track)
    result=chunk(b'MThd',struct.pack('>HHH',1,len(tracks),PPQ))
    for events in tracks:
        events.sort(key=lambda e:(e[0],e[1]))
        raw=bytearray();prior=0
        for tick,_,data in events:
            raw+=vlq(tick-prior)+data;prior=tick
        raw+=vlq(music['endTick']-prior)+meta(47,b'')
        result+=chunk(b'MTrk',raw)
    return bytes(result)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=SOURCE/'midi-v2');parser.add_argument('--install',action='store_true');args=parser.parse_args()
    destination=args.output.resolve()
    if destination.exists():raise SystemExit('Output exists; use a new directory')
    destination.mkdir(parents=True)
    titles={'stage':'霓光回廊','bossCore':'星仪超频 · 核心层','bossDrive':'星仪超频 · 推进层','boss':'星仪超频 · 完整曲','intro':'引燃','clear':'冲破天际','defeat':'重启'}
    bank={'v':2,'format':'SMF1','ppq':PPQ,'entries':{}}
    manifest={'author':'小典 / Codex','source':'Original SMF composition, no borrowed MIDI or audio','files':{}}
    for key in titles:
        composition=compose(key);data=smf(key,composition);(destination/(key+'.mid')).write_bytes(data)
        seconds=composition['endTick']*composition['tempo']/PPQ/1000000
        summary={'title':titles[key],'bpm':composition['bpm'],'seconds':seconds,'bytes':len(data),'notes':len(composition['notes']),'channels':dict(Counter(str(n['channel']+1) for n in composition['notes'])),'sha256':hashlib.sha256(data).hexdigest()}
        manifest['files'][key]=summary
        (destination/(key+'-events.json')).write_text(json.dumps(composition,separators=(',',':')),encoding='utf-8')
        if key!='boss':bank['entries'][key]={'title':titles[key],'loop':key.startswith('boss'),'kind':'midi','seconds':seconds,'data':base64.b64encode(data).decode('ascii')}
    script='/* (C) 2026 Carinoasd. Original electronic MIDI: 小典 / Codex. */\nwindow.DanmakuMidiBank='+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n'
    (destination/'midi-bank.js').write_text(script,encoding='utf-8',newline='\n')
    # Keep all 16 existing effects exactly as approved; only music switches format.
    previous=ROOT/'docs/danmaku/audio/stage01-v1/render-v1/audio-bank.js'
    audio=json.loads(previous.read_text(encoding='utf-8').split('window.DanmakuAudioBank=',1)[1].strip().removesuffix(';'))
    audio['entries']={k:v for k,v in audio['entries'].items() if v['kind']=='sfx'}
    sfx='/* (C) 2026 Carinoasd. Preserved v1 SFX, MIDI music separate: 小典 / Codex. */\nwindow.DanmakuAudioBank='+json.dumps(audio,ensure_ascii=False,separators=(',',':'))+';\n'
    (destination/'sfx-bank.js').write_text(sfx,encoding='utf-8',newline='\n')
    (destination/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    if args.install:
        runtime=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
        (runtime/'midi-bank.js').write_text(script,encoding='utf-8',newline='\n');(runtime/'audio-bank.js').write_text(sfx,encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS','midiFiles':7,'runtimeMidi':6,'sfxPreserved':len(audio['entries']),'midiBankBytes':len(script.encode()),'sfxBankBytes':len(sfx.encode()),'notes':{k:v['notes'] for k,v in manifest['files'].items()}}))


if __name__=='__main__':main()
