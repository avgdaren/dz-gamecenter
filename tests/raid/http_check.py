#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。真实 PHP HTTP/session 集成测试。"""
import http.cookiejar
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parents[2]
checks = 0

def check(yes, name):
    global checks
    assert yes, name
    checks += 1

with tempfile.TemporaryDirectory(prefix='raid-p1-http-') as sessions:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    process = subprocess.Popen([os.environ.get('PHP_BIN', 'php'), '-n', '-d', f'session.save_path={sessions}', '-S',
        f'127.0.0.1:{port}', str(root / 'tests/raid/prototype/router.php')], cwd=root,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def get():
        return json.load(client.open(base + '/api', timeout=3))
    counter = 0
    def request(op, **kwargs):
        global counter
        counter += 1
        return dict(token=current['token'], request_id=f'{counter:032x}', generation=current['generation'], op=op, **kwargs)
    def post(q, headers=None):
        return json.load(client.open(urllib.request.Request(base+'/api', data=json.dumps(q).encode(),
            headers={'Content-Type':'application/json', **(headers or {})}), timeout=3))
    try:
        for attempt in range(100):
            try:
                current = get()
                break
            except OSError:
                time.sleep(.02)
        else:
            raise AssertionError('PHP server failed to start')
        check(current['snapshot'] is None, 'fresh session empty')
        for path in ['/', '/app.js', '/feedback.js', '/music.js', '/style.css', '/boss.svg', '/assets/battle.mp3']:
            with client.open(base+path) as response:
                check(response.status == 200 and len(response.read()) > 100, 'static '+path)
                check("default-src 'self'" in response.headers['Content-Security-Policy'], 'local resource CSP')
        music_request=urllib.request.Request(base+'/assets/battle.mp3',headers={'Range':'bytes=0-63'})
        with client.open(music_request) as response:
            check(response.status==206 and len(response.read())==64,'music supports byte ranges')
            check(response.headers['Content-Type']=='audio/mpeg','music correct MIME')
        for path in ['/source/plugin/gamecenter/lib/raid_rules.php', '/../docs/STATE.md']:
            try:
                client.open(base+path)
                raise AssertionError('exposed filesystem')
            except urllib.error.HTTPError as error:
                check(error.code == 404, 'no arbitrary files')
        start = request('start', mode='solo')
        bad = post({**start, 'token':'bad'})
        check(not bad['ok'] and bad['snapshot'] is None and bad['code']=='token', 'token checked')
        current = post(start)
        check(current['ok'] and current['snapshot']['boss']==120 and current['snapshot']['pots']==[3], 'solo starts')
        replay = post(start)
        check(replay['code']=='replayed' and replay['snapshot']==current['snapshot'], 'start replay stable')
        clash = post({**start, 'mode':'duo'})
        check(not clash['ok'] and clash['code']=='request_conflict', 'same id other params rejected')
        move = request('act', round=1, actor=0, kind='attack', target=-1)
        current = post(move)
        check(current['snapshot']['round_no']==2 and current['snapshot']['boss']==110, 'PHP resolves solo')
        check(current['receipt']['accepted_round']==1,'receipt retains submitted round after resolution')
        again = post(move)
        check(again['code']=='replayed' and len(again['snapshot']['history'])==1, 'response lost replay no second hit')
        before = current['snapshot']
        bad = post(request('act', round=2, actor=0, kind='heal', target=9))
        check(not bad['ok'] and bad['snapshot']==before, 'invalid does not occupy intention')
        current = post(request('start', mode='duo'))
        first = request('act', round=1, actor=0, kind='attack', target=-1)
        current = post(first)
        check(current['snapshot']['intents'][0]['kind']=='attack' and current['snapshot']['round_no']==1, 'first slot locked visible')
        bad = post(request('act', round=1, actor=0, kind='guard', target=0))
        check(not bad['ok'] and bad['code']=='locked', 'second id cannot change slot')
        current = post(request('advance', ms=25000))
        check(current['snapshot']['history'][0]['defaults']==[1] and current['snapshot']['boss']==120, 'timeout keeps first slot and defaults second')
        deadline=current['snapshot']['deadline_ms']
        check(get()['snapshot']['deadline_ms']==deadline, 'refresh does not extend deadline')
        check(not post(request('act', round=1, actor=1, kind='attack', target=-1))['ok'], 'stale turn rejected')
        current=post(request('advance', ms=400000))
        check(current['snapshot']['status']==3 and len(current['snapshot']['history'])==16, 'long offline bounded')
        check(current['snapshot']['ended_ms']==deadline+14*25000, 'original logical end time')
        old_generation=request('act', round=16, actor=1, kind='attack', target=-1)
        current=post(request('start', mode='solo'))
        bad=post(old_generation)
        check(not bad['ok'] and bad['code']=='generation', 'old battle cannot mutate new')
        # Reset clock is intentionally not needed; a new battle starts at current simulation time.
        fixture=json.loads((root/'docs/raid/P1-REFERENCE.json').read_text())
        for name, case in fixture['cases'].items():
            current=post(request('start',mode=case['mode']))
            for row in case['expected']['trace']:
                for actor, (kind,target) in enumerate(row['actions']):
                    if kind=='-': continue
                    current=post(request('act',round=row['round'],actor=actor,kind={'A':'attack','G':'guard','H':'heal'}[kind],target=target))
                    check(current['ok'],name+' HTTP act')
                last=current['snapshot']['history'][-1]
                check(all(last[key]==row[key] for key in ('preview','hp','boss','pots','exposed')), name+' HTTP trace')
            check(current['snapshot']['status']==2,name+' HTTP win')
        try:
            post(request('start',mode='solo'), {'Origin':'http://other.test'})
            raise AssertionError('origin accepted')
        except urllib.error.HTTPError as error:
            check(error.code==403,'foreign origin rejected')
        print(json.dumps(dict(status='PASS', checks=checks, fixture_cases=6)))
    finally:
        process.terminate()
        process.wait()
