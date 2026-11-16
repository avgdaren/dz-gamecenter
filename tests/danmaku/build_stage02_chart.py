"""(C) 2026 Carinoasd. Author draft cues from existing signal data: 小典 / Codex."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT/'source/plugin/gamecenter/games/_danmaku_stage02_draft'


def main():
    folder = ROOT/'docs/danmaku/audio/stage02-user-v1'
    signals = json.loads((folder/'signal-analysis.json').read_text(encoding='utf-8'))
    manifest = json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    chart = {'version': 1, 'author': '小典 / Codex', 'prototypeCopyright': '(C) 2026 Carinoasd', 'rule': 'danmaku-stage02-draft-r1', 'ranked': False,
             'method': 'authored 0.75s pulse; strongest positive onset within +/-0.10s; rounded to 60Hz',
             'tempoConfirmed': False, 'phraseBoundariesConfirmed': False, 'loop': False,
             'sampleStarts': [12, 112, 172], 'sampleSeconds': 32, 'tracks': {}}
    stage = [(0,4,'花庭入口','入场留白'),(4,40,'风中巡游','交替巡游编队'),
             (40,80,'交错风路','风侍与巡游精灵交替'),(80,88,'风息','清屏空间与拾取'),
             (88,116,'花瓣回廊','花形展开与侧向移动'),(116,128,'花间留白','稀疏小队与补给'),
             (128,152,'风铃守卫','大型铃卫与两侧小队'),(152,164,'回风','低密度回落'),
             (164,200,'花庭合奏','三种敌人交错进入'),(200,208.84,'收束拾取','停止出敌、收取掉落')]
    boss = [(0,6.5,'铃羽登场','沿用已确认停顿'),(6.5,48,'风流引入','宽弧扫动'),
            (48,100,'风流展开','移动风廊与转向'),(100,108,'回落','疏开图案、减少辅弹'),
            (108,160,'花瓣舒展','五瓣结构与反向飘移'),(160,192,'铃声回响','主弧、回声与摆动发射源'),
            (192,216,'回响展开','保留通道的密集收句'),(216,223.35,'尾声','减少新弹')]
    for key, sections in [('stage', stage), ('boss', boss)]:
        source = signals[key]
        assert source['sha256'] == manifest['entries'][key]['sourceSha256']
        seconds = manifest['entries'][key]['decodedPcm']['seconds']
        onsets = [(i/100, strength) for i, strength in source['onsets']]
        pulses = []
        n = 0
        while n*.75 < seconds-.4:
            nominal = .5+n*.75
            choices = [(strength, at) for at, strength in onsets if abs(at-nominal) <= .10]
            strength, at = max(choices, default=(0, nominal))
            tick = round(at*60)
            if tick < round(seconds*60) and (not pulses or tick > pulses[-1][0]):
                block = source['blocks'][min(int(at//4), len(source['blocks'])-1)]
                pulses.append([tick, n, 0 if block['rms'] < .12 else 2 if block['rms'] > .21 else 1])
            n += 1
        chart['tracks'][key] = {'seconds': seconds, 'ticks': round(seconds*60),
            'sha256': manifest['entries'][key]['sha256'], 'pulses': pulses,
            'sections': [{'start': a, 'end': b, 'name': name, 'event': event} for a,b,name,event in sections]}
    DEST.mkdir(parents=True, exist_ok=True)
    target = DEST/'chart.json'
    target.write_text(json.dumps(chart, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'PASS', 'file': str(target), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'pulses': {k: len(v['pulses']) for k,v in chart['tracks'].items()}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
