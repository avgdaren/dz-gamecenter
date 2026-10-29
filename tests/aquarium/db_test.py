#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。显式隔离库+调用方提供的原版X5驱动；无环境就SKIP。"""
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import sys

if (os.getenv('GC_AQUARIUM_TEST') != '1' or not os.getenv('GC_DZ_ROOT') or
        not re.search(r'dbname=[a-z0-9_]+_gc_test(?:;|$)', os.getenv('GC_TEST_DSN', ''), re.I)):
    print(json.dumps(dict(status='SKIP', reason='requires GC_AQUARIUM_TEST=1, original GC_DZ_ROOT and explicit *_gc_test DSN')))
    sys.exit(0)

PHP = os.getenv('PHP_BIN', 'php')
WORKER = Path(__file__).with_name('db-worker.php')
checks = 0


def check(ok, msg):
    global checks
    checks += 1
    assert ok, msg


def send(**x):
    p = subprocess.run([PHP, str(WORKER)], input=json.dumps(x)+'\n', capture_output=True, text=True, encoding='utf-8', check=True)
    assert not p.stderr, p.stderr
    r = json.loads(p.stdout)
    assert 'test_error' not in r, r
    return r


def call(uid, action, now=1000000, **data):
    return send(uid=uid, now=now, data=dict(action=action, client_version='aquarium-foundation-1', **data))


send(op='init_schema')
q = send(op='querysafe')
check(q['blocked'] and int(q['inside']) <= 2 and q['before'] == q['after'], 'querysafe and timeout restore')
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    r = list(pool.map(lambda _: call(1, 'init'), range(2)))
check(all(x['ok'] and x['snapshot']['coins'] == 122 and x['snapshot']['version'] == 1 for x in r), 'real init race single reward')
for i in range(50):
    now = 1000000 + (i+1)*120000
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        r = list(pool.map(lambda _: call(1, 'sync', now), range(2)))
    check(all(x['ok'] and x['snapshot']['catch_seq'] == i+1 for x in r), 'same window settled once')
call(2, 'init')
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    r = list(pool.map(lambda _: call(2, 'upgrade', target_level=1, expected_version=1), range(2)))
check(sum(x['ok'] for x in r) == 1 and any(x['code'] == 'conflict' for x in r), 'real purchase race')
check(call(2, 'sync')['snapshot']['coins'] == 2, 'exactly one charge')
check(call(2, 'upgrade', target_level=1, expected_version=1)['code'] == 'conflict', 'same old retry not charged')
check(call(2, 'upgrade', target_level=2, expected_version=2)['code'] == 'coins', 'no overdraft')
# 保存前后版本/损坏档不重置，以及已提交响应丢失后的原版本重试。
before = send(op='raw', uid=2)
send(op='corrupt', uid=2, json='{bad')
check(call(2, 'init')['ok'] == 0, 'corrupt fails closed')
check(send(op='raw', uid=2)['state_json'] == '{bad', 'corrupt not reset')
send(op='corrupt', uid=2, json=before['state_json'])
call(3, 'init')
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    hold = pool.submit(send, op='hold', uid=3)
    import time
    time.sleep(.15)
    read = call(3, 'sync', 1120000)
    check(hold.result()['ok'] and read['ok'], 'lock wait retry recovers')
print(json.dumps(dict(status='PASS', checks=checks, driver=os.getenv('GC_TEST_DRIVER', 'pdo'),
                     scope='actual InnoDB with original X5 driver; forum browser still excluded')))
