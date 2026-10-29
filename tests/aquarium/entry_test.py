#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。路由/HTML模型；不等同HTTP或实站。"""
import json
import os
from pathlib import Path
import subprocess
worker = Path(__file__).with_name('entry_worker.php')
n = 0


def call(**kw):
    global n
    p = subprocess.run([os.getenv('PHP_BIN', 'php'), str(worker)], input=json.dumps(kw),
                       capture_output=True, text=True, encoding='utf-8', check=True)
    assert not p.stderr, p.stderr
    n += 1
    return p.stdout


data = dict(action='sync', client_version='aquarium-foundation-1', formhash='fixture-formhash')
assert json.loads(call(data=data))['code'] == 'uninitialized'
assert json.loads(call(data=data, method='GET'))['ok'] == 0
assert json.loads(call(data=dict(data, formhash='wrong')))['ok'] == 0
assert json.loads(call(data=data, uid=0))['code'] == 'login'
assert json.loads(call(data=data, adminid=0))['code'] == 'permission'
assert json.loads(call(data=data, vars=dict(limitplay=1, playgroups=[])))['code'] == 'permission'
for op in ['start', 'submit', 'room', 'raid', 'unknown']:
    assert json.loads(call(data=data, route_op=op))['ok'] == 0
assert '不提供排行榜' in call(data=data, route_op='board')
assert json.loads(call(data=dict(data, uid='999')))['code'] == 'input'
assert json.loads(call(data=dict(data, now_ms='999')))['code'] == 'input'
x = json.loads(call(test='core'))
assert x['start']['ok'] == x['submit']['ok'] == 0 and x['rewards'] == []
html = call(test='view')
assert '底盘诊断' in html and '测试说明' in html and 'game.js?v=0.0.2' in html
assert '本周第一' not in html and '好友约战' not in html and '讨伐手记' not in html
assert 'data-rivals="[]"' in html
restricted_html = call(test='view', vars=dict(limitplay=1, playgroups=[]))
assert '建立或查看水族馆' in restricted_html and '后挑战' not in restricted_html
print(json.dumps(dict(status='PASS', checks=n, scope='entry and view model; NOT real HTTP/Discuz')))
