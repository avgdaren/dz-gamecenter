#!/usr/bin/env python3
# (C) 2026 Carinoasd. Original audio asset checks: 小典 / Codex.
from array import array
import base64
import hashlib
import json
from pathlib import Path
import wave

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/danmaku/audio/stage01-v1/render-v1'
manifest = json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8'))
script = (SOURCE / 'audio-bank.js').read_text(encoding='utf-8')
bank = json.loads(script.split('window.DanmakuAudioBank=', 1)[1].strip().removesuffix(';'))
runtime = (ROOT / 'source/plugin/gamecenter/games/_danmaku_proto/audio-bank.js').read_text(encoding='utf-8')
runtime_bank = json.loads(runtime.split('window.DanmakuAudioBank=', 1)[1].strip().removesuffix(';'))
midi_runtime = (ROOT / 'source/plugin/gamecenter/games/_danmaku_proto/midi-bank.js').is_file()
bgm_path = ROOT / 'source/plugin/gamecenter/games/_danmaku_proto/bgm-bank.js'
recorded_runtime = bgm_path.is_file() and 'src="bgm-bank.js"' in (bgm_path.parent / 'index.html').read_text(encoding='utf-8')
if midi_runtime:
    assert runtime_bank['entries'] == {key:value for key,value in bank['entries'].items() if value['kind']=='sfx'}
else:
    assert runtime_bank == bank
assert len(bank['entries']) == 22
for name, meta in bank['entries'].items():
    p = SOURCE / (name + '.wav')
    assert base64.b64decode(meta['data']) == p.read_bytes()
    assert hashlib.sha256(p.read_bytes()).hexdigest() == manifest['entries'][name]['sha256']
    with wave.open(str(p), 'rb') as audio:
        assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate()) == (1, 2, 22050)
        frames = audio.getnframes()
        values = array('h', audio.readframes(frames))
    assert abs(frames / 22050 - meta['seconds']) < 1e-7
    assert max(abs(v) for v in values) <= .66 * 32768
    assert manifest['entries'][name]['rms'] > .005
    if meta['loop']:
        assert abs(values[0] - values[-1]) / 32768 < .02
    else:
        assert values[0] == 0 and values[-1] == 0
out = ROOT / 'tmp/danmaku/stage01-audio'
out.mkdir(parents=True, exist_ok=True)
if recorded_runtime:
    production = ROOT / 'docs/danmaku/audio/stage01-happyshrimp-v1'
    assert bgm_path.read_bytes() == (production / 'bgm-bank.js').read_bytes()
    recorded = json.loads(bgm_path.read_text(encoding='utf-8').split('window.DanmakuBgmBank=', 1)[1].strip().removesuffix(';'))
    details = json.loads((production / 'manifest.json').read_text(encoding='utf-8'))
    assert set(recorded['entries']) == {'stage', 'bossCore'}
    for name, entry in recorded['entries'].items():
        raw = (production / (name + '.mp3')).read_bytes()
        assert base64.b64decode(entry['data']) == raw
        assert hashlib.sha256(raw).hexdigest() == details['entries'][name]['sha256']
        assert details['entries'][name]['peak'] < .95
        assert entry['mime'] == 'audio/mpeg'
    assert recorded['entries']['stage']['seconds'] == 72
    loop = recorded['entries']['bossCore']
    assert loop['loop'] and 0 < loop['loopStart'] < loop['loopEnd'] <= loop['seconds']
report = {'status':'PASS', 'archivedMusic':6, 'sfx':16, 'currentMusicFormat':'recorded MP3 + MIDI stingers' if recorded_runtime else 'MIDI' if midi_runtime else 'PCM', 'sfxSampleRate':22050, 'sfxBits':16, 'pcmFiniteAndNoClipping':True, 'legacyLoopJumpUnder':.02, 'sfxBankMatchesOriginalWav':True, 'recordedTracks':2 if recorded_runtime else 0}
(out / 'asset-checks.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
