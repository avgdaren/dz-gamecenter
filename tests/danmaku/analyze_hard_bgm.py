"""(C) 2026 Carinoasd. Offline BGM onset analysis for Hard: 小典 / Codex.

Production helper only. FFmpeg decodes the existing runtime masters; the game
does not use a microphone, FFT, random timing, or any new runtime dependency.
"""
import argparse
import array
import hashlib
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def analyze(ffmpeg, source):
    raw = subprocess.check_output([str(ffmpeg), '-v', 'error', '-i', str(source),
        '-ac', '1', '-ar', '8000', '-af', 'highpass=f=90', '-f', 'f32le', '-'])
    samples = array.array('f', raw)
    # 10 ms energy + positive energy difference, robust to stereo cancellation.
    energy = [math.sqrt(sum(v*v for v in samples[i:i+80])/80)
              for i in range(0, len(samples)-79, 80)]
    onset = [max(0, energy[i]-sum(energy[max(0,i-8):i])/min(i,8))
             if i else 0 for i in range(len(energy))]
    candidates = []
    for bpm10 in range(800, 1901):
        period = 60000/bpm10
        score = sum(onset[i]*onset[round(i-period)]
                    for i in range(math.ceil(period),len(onset)))
        candidates.append((score,bpm10/10))
    candidates.sort(reverse=True)
    peaks = [i for i in range(2,len(onset)-2)
             if onset[i] == max(onset[i-2:i+3]) and onset[i] > .003]
    blocks=[]
    for start in range(0,len(energy),400):
        block=energy[start:start+400]
        selected=sorted((i for i in peaks if start<=i<start+400),key=lambda i:onset[i],reverse=True)[:5]
        blocks.append({'at':start/100,'rms':round(math.sqrt(sum(v*v for v in block)/len(block)),5),
                       'peaks':sorted(round(i/100,2) for i in selected)})
    return {'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'seconds':len(energy)/100,'tempoCandidates':candidates[:8],
            'blocks':blocks,'onsets':[[i,round(onset[i],6)] for i in peaks]}


def main():
    p=argparse.ArgumentParser();p.add_argument('--ffmpeg',type=Path,required=True)
    p.add_argument('--output',type=Path,default=ROOT/'tmp/danmaku/hard-v1/bgm-analysis.json');a=p.parse_args()
    folder=ROOT/'docs/danmaku/audio/stage01-happyshrimp-v1'
    report={key:analyze(a.ffmpeg,folder/name) for key,name in [('stage','stage.mp3'),('boss','bossCore.mp3')]}
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for key,v in report.items():
        print(key,v['seconds'],'tempo',v['tempoCandidates'][:3])
        print(json.dumps(v['blocks'],ensure_ascii=False))


if __name__=='__main__':main()
