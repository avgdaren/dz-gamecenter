"""(C) 2026 Carinoasd. Authored music-cued Hard rules: 小典 / Codex."""
import argparse
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'


def grid(analysis,bpm,phase,end,half=False,loop=False):
    peaks=analysis['onsets']; result=[];step=60/bpm/(2 if half else 1)
    # Fit nominal beats to nearby measured attacks (at most 45 ms), then freeze
    # to integer 60 Hz ticks. Timing never depends on a sound device at runtime.
    for n in range(int((end-phase)/step)+1):
        time=phase+n*step
        if loop and time>=204.71:continue
        close=[(abs(t/100-time)-w*.1,t/100) for t,w in peaks if abs(t/100-time)<=.045]
        hit=min(close)[1] if close else time
        block=analysis['blocks'][min(int(hit//4),len(analysis['blocks'])-1)]
        strength=0 if block['rms']<.08 else 1 if block['rms']<.11 else 2
        result.append([round(hit*60),n,strength])
    if loop:
        original=list(result);lap=1
        while 204.71+(lap-1)*203.21<end:
            for t,n,v in original:
                if t<90:continue
                tick=round(t+(204.71+(lap-1)*203.21-1.5)*60)
                if tick<=round(end*60):result.append([tick,n,v])
            lap+=1
    return sorted(result)


def main():
    p=argparse.ArgumentParser();p.add_argument('--analysis',type=Path,default=ROOT/'tmp/danmaku/hard-v1/bgm-analysis.json');a=p.parse_args()
    analysis=json.loads(a.analysis.read_text(encoding='utf-8'))
    path=SOURCE/'rules.json';r=json.loads(path.read_text(encoding='utf-8'))
    stage=grid(analysis['stage'],168,.23,71)
    boss=grid(analysis['boss'],144,.35,217,True,True)
    def nearest(t):return min(stage,key=lambda c:abs(c[0]-t))[0]
    schedule=[dict(m,at=nearest(m['at'])) for m in r['stage01']['schedule']]
    attacks={}
    for m in schedule:
        spec=r['normal02']['types'][m['type']];rows=[]
        for original in spec['attacks']:
            at=nearest(m['at']+original['at'])-m['at']
            if any(row['at']==at for row in rows):continue
            offsets=original['offsets']
            if m['type']==0:offsets=[-42,-28,-14,0,14,28,42] if not original['aimed'] else [-24,-12,0,12,24]
            elif original['aimed']:offsets=[-32,-24,-16,-8,0,8,16,24,32]
            else:offsets=list(range(-84,85,14))
            rows.append(dict(original,at=at,warning=at-30,offsets=offsets))
        attacks[str(m['id'])]=rows
    r['hard01']={'rule':'danmaku-stage01-hard-r1','ranked':False,'enemySpawnCap':24000,'preludeEnemyCap':256,
        'music':{'stage':{'bpm':168,'phaseSeconds':.23,'sha256':analysis['stage']['sha256']},
                 'boss':{'bpm':144,'phaseSeconds':.35,'sha256':analysis['boss']['sha256'],'loopStart':1.5,'loopEnd':204.71},
                 'method':'10ms positive energy onsets; authored grid; nearest onset within 45ms; integer 60Hz ticks'},
        'stageBeats':stage,'bossPulses':boss,'schedule':schedule,'attacks':attacks,
        'segments':[{'at':0,'name':'引光 · 疏拍'}, {'at':480,'name':'星流 · 逐拍交织'},
                    {'at':1920,'name':'回声 · 换位'}, {'at':2160,'name':'重拍 · 星潮'},
                    {'at':3360,'name':'间奏 · 引导回收'}, {'at':3840,'name':'尾奏 · 最后交织'},
                    {'at':4080,'name':'抵达观测台'}]}
    path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    cue=ROOT/'docs/danmaku/audio/hard-v1-cues.json'
    cue.write_text(json.dumps({'copyright':'(C) 2026 Carinoasd; 小典 / Codex',**r['hard01']['music'],
        'stageBeats':stage,'bossHalfBeats':boss},ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Hard:',len(stage),'stage beats,',len(boss),'boss half beats; 40 enemies, existing rewards retained')


if __name__=='__main__':main()
