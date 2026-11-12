#!/usr/bin/env python3
# (C) 2026 Carinoasd. Original reference-directed MIDI composition: 小典 / Codex.
"""Independent melodies with night-stage / piano-brass finale arrangement.

Standard library only. Existing v1/v2 source files are never overwritten.
"""
import argparse
import base64
from collections import Counter
import hashlib
import json
from pathlib import Path
from build_stage01_midi import smf

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/danmaku/audio/stage01-midi-v3'
SCORE = json.loads((SOURCE / 'score.json').read_text(encoding='utf-8'))
PPQ = SCORE['ppq']
TITLES = {'stage':'星穹夜航','bossCore':'星冠终奏 · 核心层','bossDrive':'星冠终奏 · 推进层','boss':'星冠终奏 · 完整曲','intro':'星门启封','clear':'破晓星冠','defeat':'夜航再启'}
ASCII = dict(zip(TITLES, ['NOCTURNAL STARWAY','STELLAR CROWN FINALE - CORE','STELLAR CROWN FINALE - DRIVE','STELLAR CROWN FINALE','UNSEAL THE GATE','CROWN AT DAWN','RESTART THE NIGHT']))


def compose(key):
    stage = key == 'stage'
    boss = key.startswith('boss')
    theme = SCORE['stage' if stage else 'boss']
    bpm = theme['bpm'] if stage or boss else {'intro':160,'clear':180,'defeat':150}[key]
    bars = theme['bars'] if stage or boss else {'intro':2,'clear':3,'defeat':1.5}[key]
    end = round(bars * 4 * PPQ)
    notes = []
    def note(track, channel, pitch, start, duration, velocity):
        at = round(start * PPQ)
        off = min(end, at + max(1, round(duration * PPQ)))
        if at < end and off > at:
            notes.append({'track':track,'channel':channel,'note':pitch,'at':at,'off':off,'velocity':max(1,min(127,velocity))})
    if stage or boss:
        core = key != 'bossDrive'
        drive = key != 'bossCore'
        for bar in range(int(bars)):
            start = bar * 4
            section = next(s[2] for s in theme['sections'] if s[0] <= bar < s[1])
            if stage:
                phrase_bar = (bar - 2) % 8
                chord_index = phrase_bar if bar >= 2 else bar
                melody = theme['themeB'] if 22 <= bar < 30 else theme['themeA']
                intro = bar < 2
                breath = 38 <= bar < 42
                bridge = 18 <= bar < 22
            else:
                phrase_bar = (bar - 4) % 8
                chord_index = phrase_bar if bar >= 4 else [0,1,5,6][bar]
                melody = theme['themeB'] if 12 <= bar < 20 else theme['themeA']
                intro = bar < 4
                breath = False
                bridge = False
            chord = theme['chords'][chord_index]
            if core:
                # Root/fifth/offbeat bass, distinct patterns for night and finale.
                pattern = [(0,.38,0),(0.75,.20,12),(1.5,.30,7),(2,.40,0),(2.75,.20,12),(3.5,.30,7)] if stage else [(0,.38,0),(.5,.22,12),(1.5,.25,7),(2,.38,0),(2.5,.22,12),(3.25,.25,7),(3.75,.18,12)]
                for at,length,interval in pattern:
                    note('bass',1,chord[0]-12+interval,start+at,length,105 if at in (0,2) else 88)
                for pitch in chord[1:]:
                    note('pad',3,pitch+12,start+.04,3.45,51 if stage else 58)
                # Piano has changing inversion, direction and phrase endings.
                count = 8 if not intro else 16
                for i in range(count):
                    at = i * 4 / count
                    index = (i if bar % 2 == 0 else count-1-i) % 4
                    pitch = chord[index]+12+(12 if i % 8 in (5,7) else 0)
                    note('piano',2,pitch,start+at,.19 if count==16 else .31,80 if intro else 66+(8 if i%4==0 else 0))
                if not intro:
                    phrase = melody[phrase_bar]
                    if breath or bridge:
                        phrase = phrase[::3]
                    for i,(at,length,pitch) in enumerate(phrase):
                        note('lead',0,pitch-(12 if breath else 0),start+at,length,118 if not stage else 108+(6 if i==0 else 0))
                # Stage stays buoyant with a broken kick; boss has a stronger pulse.
                kick = (0,1.5,2.75) if stage and bar%2==0 else (0,.75,2,3.5) if stage else (0,1,2,3)
                for at in kick:
                    note('drums',9,36,start+at,.12,119 if at==0 else 105)
                for at in (1,3):
                    note('drums',9,38,start+at,.10,105 if stage else 114)
                for eighth in range(8):
                    note('drums',9,42,start+eighth*.5,.045,66 if eighth%2==0 else 86)
                if (bar in (0,2,22,30,42) if stage else bar in (0,4,12,20)):
                    note('drums',9,49,start,.55,86)
            if drive:
                if not breath:
                    # Answer the main melody in its rests; no unison doubling.
                    for i in range(4 if stage else 8):
                        at = .25+i*(1 if stage else .5)
                        note('counter',4,chord[(i+1)%4]+(24 if boss else 12),start+at,.13,57 if stage else 63)
                for at in (1.5,3.5):
                    note('drums',9,46,start+at,.14,67 if stage else 78)
                if boss:
                    for at in (1.015,3.015):
                        note('drums',9,39,start+at,.10,82)
                if (stage and bar in (9,17,21,29,37,44)) or (boss and bar in (3,11,19,27)):
                    for i in range(8):
                        note('drums',9,38,start+2+i*.25,.07,55+i*6)
                if boss and bar >= 12:
                    # A short descending response, restrained below the trumpet.
                    for i,pitch in enumerate([chord[2]+12,chord[1]+12,chord[0]+19]):
                        note('counter',4,pitch,start+2.5+i*.5,.23,64)
    else:
        phrase = {'intro':[67,74,70,77,75,78,81,86], 'clear':[67,74,79,82,81,86,91,86], 'defeat':[79,74,70,67,62,55]}[key]
        for i,pitch in enumerate(phrase):
            note('lead',0,pitch,i*.5,.43 if key!='defeat' else .72,110 if key!='defeat' else 108-i*4)
        for i in range(int(bars*8)):
            note('piano',2,[55,62,67,70][i%4]+12,i*.5,.30,74)
        for pitch in [55,62,70]:
            note('pad',3,pitch,0,bars*4-.2,53)
        if key!='defeat':
            for beat in range(int(bars*4)):
                note('drums',9,36,beat,.12,110)
                if beat%2:note('drums',9,38,beat,.10,105)
    return {'bpm':bpm,'tempo':round(60000000/bpm),'endTick':end,'notes':notes,'controls':[],'programs':theme['programs'],'signature':theme['signature']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=SOURCE/'midi-v3')
    parser.add_argument('--install',action='store_true')
    args = parser.parse_args()
    dest = args.output.resolve()
    if dest.exists():raise SystemExit('Output exists; use a fresh directory')
    dest.mkdir(parents=True)
    bank = {'v':3,'format':'SMF1','ppq':PPQ,'duck':.52,'entries':{}}
    manifest = {'author':'小典 / Codex','source':'Independent original melodies; two user-specified mood and arrangement references; no borrowed MIDI or samples','references':SCORE['references'],'files':{}}
    for key,title in TITLES.items():
        music = compose(key)
        data = smf(key,music,programs=music['programs'],titles=ASCII,key_signature=music['signature'])
        (dest/(key+'.mid')).write_bytes(data)
        seconds = music['endTick']*music['tempo']/PPQ/1000000
        manifest['files'][key] = {'title':title,'bpm':music['bpm'],'seconds':seconds,'bytes':len(data),'notes':len(music['notes']),'programsZeroBased':music['programs'],'channels':dict(Counter(str(n['channel']+1) for n in music['notes'])),'sha256':hashlib.sha256(data).hexdigest()}
        (dest/(key+'-events.json')).write_text(json.dumps(music,separators=(',',':')),encoding='utf-8')
        if key!='boss':bank['entries'][key]={'title':title,'loop':key.startswith('boss'),'kind':'midi','seconds':seconds,'data':base64.b64encode(data).decode('ascii')}
    script = '/* (C) 2026 Carinoasd. Original night-stage / piano-brass MIDI: 小典 / Codex. */\nwindow.DanmakuMidiBank='+json.dumps(bank,ensure_ascii=False,separators=(',',':'))+';\n'
    (dest/'midi-bank.js').write_text(script,encoding='utf-8',newline='\n')
    (dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    if args.install:(ROOT/'source/plugin/gamecenter/games/_danmaku_proto/midi-bank.js').write_text(script,encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS','midiFiles':7,'runtimeMidi':6,'bankBytes':len(script.encode()),'notes':{k:v['notes'] for k,v in manifest['files'].items()}}))


if __name__=='__main__':main()
