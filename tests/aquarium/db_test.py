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
if os.getenv('GC_TEST_CONFIG') == 'aquarium-content-v2-candidate-v1':
    call(10, 'init')
    healthy = send(op='raw', uid=10)
    base = json.loads(healthy['state_json'])
    import copy
    bad_states = []
    for key, value in [('inventory_schema',99),('inventory_anomaly',True),('config_version','aquarium-content-candidate-v1')]:
        state = copy.deepcopy(base); state[key] = value; bad_states.append(state)
    state=copy.deepcopy(base); state['fish']['pond_blue']['sold_count']=1; bad_states.append(state)
    state=copy.deepcopy(base); state['layout']['fish']=['pond_blue','pond_blue',None,None]; bad_states.append(state)
    state=copy.deepcopy(base); state['fish']['pond_curl_seahorse']=dict(discovered_at=1000000,catch_count=4,owned_count=4,sold_count=0); bad_states.append(state)
    for state in bad_states:
        send(op='corrupt',uid=10,json=json.dumps(state))
        before=send(op='raw',uid=10)
        for action in ['init','catalog','sync','layout','upgrade','expand','unlock','switch','buy','sell']:
            extra={} if action in ['init','catalog','sync'] else dict(expected_version=1)
            extra.update(dict(layout=base['layout']) if action=='layout' else dict(target_level=1) if action=='upgrade'
                else dict(water_id='bay') if action in ['unlock','switch'] else dict(decor_id='plant_meadow') if action=='buy'
                else dict(fish_id='pond_blue',qty=1) if action=='sell' else {})
            check(call(10,action,1120000,**extra)['code']=='config', 'v2 corrupt '+action+' refused')
        check(send(op='raw',uid=10)==before, 'v2 invalid row byte-for-byte unchanged')
    send(op='corrupt',uid=10,json=healthy['state_json'])
    check(call(10,'sync',1120000)['ok']==1,'healthy v2 continues after invalid-row checks')
print(json.dumps(dict(status='PASS', checks=checks, driver=os.getenv('GC_TEST_DRIVER', 'pdo'),
                     config=os.getenv('GC_TEST_CONFIG','aquarium-foundation-v1'),
                     scope='actual InnoDB with original X5 driver; forum browser still excluded')))
