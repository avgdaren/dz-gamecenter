#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。真实PHP多进程+文件锁服务模型，不冒充数据库并发。"""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
from contextlib import contextmanager
import shutil
import uuid

PHP = os.environ.get('PHP_BIN', 'php')
WORKER = Path(__file__).with_name('service-worker.php')
checks = 0


def check(ok, label):
    global checks
    checks += 1
    assert ok, label


@contextmanager
def writable_test_directory():
    # Windows某些沙箱的mkdtemp权限不同；显式mkdir并允许指定可写父目录。
    parent = Path(os.environ.get('GC_TEST_TMPDIR', Path.cwd()))
    folder = parent / ('aq-service-' + uuid.uuid4().hex)
    os.makedirs(folder)
    try:
        probe = folder / 'write-probe'
        probe.write_text('ok', encoding='utf-8')
        probe.unlink()
        yield folder
    finally:
        shutil.rmtree(folder)


with writable_test_directory() as folder:
    file = Path(folder)/'state.json'

    def call(uid=1, now=1000000, allowed=True, fault='', **data):
        payload = dict(uid=uid, now=now, allowed=allowed, fault=fault,
                       data=dict(client_version='aquarium-foundation-1', **data))
        p = subprocess.run([PHP, str(WORKER), str(file)], input=json.dumps(payload),
                           capture_output=True, text=True, encoding='utf-8', check=True)
        check(not p.stderr, 'no PHP warnings')
        return json.loads(p.stdout)

    check(call(uid=0, action='init')['code'] == 'login', 'guest')
    check(call(allowed=False, action='init')['code'] == 'permission', 'group')
    for field in ['uid', 'coins', 'now_ms', 'seed_hex', 'state_json']:
        check(call(action='init', **{field: '123'})['code'] == 'input', 'spoof rejected') if field != 'uid' else check(
            call(action='init', state_json='bad')['code'] == 'input', 'spoofed whole state')
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        results = list(ex.map(lambda _: call(action='init'), range(16)))
    check(all(x['ok'] for x in results), 'concurrent init succeeds')
    check(all(x['snapshot']['version'] == 1 and x['snapshot']['coins'] == 122 for x in results), 'one initialization/reward')
    check(len(json.loads(file.read_text(encoding='utf-8'))) == 1, 'one account row')
    with concurrent.futures.ThreadPoolExecutor(8) as ex:
        results = list(ex.map(lambda _: call(action='sync', now=1120000), range(16)))
    check(all(x['ok'] and x['snapshot']['catch_seq'] == 1 for x in results), 'same window only one catch')
    check(all(x['snapshot']['version'] == 2 for x in results), 'one settlement version')
    check('seed' not in json.dumps(results), 'seed never projected')
    with concurrent.futures.ThreadPoolExecutor(2) as ex:
        results = list(ex.map(lambda _: call(action='upgrade', target_level=1, expected_version=2, now=1120000), range(2)))
    check(sum(x['ok'] for x in results) == 1, 'exactly one purchase')
    check(sorted(x['code'] for x in results) == ['', 'conflict'], 'other purchase conflicts')
    s = call(action='sync', now=1120000)['snapshot']
    check(s['rod_level'] == 1 and 0 <= s['coins'] <= 12, 'one charge and no overdraft')
    check(call(action='upgrade', target_level=1, expected_version=2, now=1120000)['code'] == 'conflict', 'old response retry not upgraded twice')
    check(call(action='upgrade', target_level=2, expected_version=s['version'], now=1120000)['code'] == 'coins', 'insufficient rejected')
    check(call(action='switch', water_id='test_bay', expected_version=s['version'], now=1120000)['code'] == 'condition', 'locked water')
    check(call(action='upgrade', target_level=1, expected_version=s['version'], now=1120000)['code'] == 'target', 'same absolute target not charged')
    before = file.read_text(encoding='utf-8')
    check(call(action='sync', now=2000000, fault='before')['code'] == 'busy', 'failure before commit')
    check(file.read_text(encoding='utf-8') == before, 'failed transaction preserves anchor/resources')
    r = call(action='sync', now=2000000)
    check(r['ok'], 'safe retry after failure')
    check(call(action='init', uid=2)['ok'], 'second account')
    check(call(uid=2, action='upgrade', target_level=1, expected_version=1, fault='after')['code'] == 'busy', 'committed purchase lost response')
    check(call(uid=2, action='upgrade', target_level=1, expected_version=1)['code'] == 'conflict', 'lost response retry rejected')
    check(call(uid=2, action='sync')['snapshot']['rod_level'] == 1, 'lost response recovers committed state')
    x = call(action='sync', now=2000000+86400000*2)['snapshot']
    check(x['summary']['effective_ms'] == 86400000 and x['summary']['discarded_ms'] == 86400000, '24h cap')
    check(call(action='sync', now=2000000+86400000*2)['snapshot']['catch_seq'] == x['catch_seq'], 'no reclaim')
    rows = json.loads(file.read_text(encoding='utf-8')); rows['1']['state_json'] = '{bad'; file.write_text(json.dumps(rows), encoding='utf-8')
    before = file.read_text(encoding='utf-8')
    check(call(action='init')['code'] == 'busy', 'corruption fails closed')
    check(file.read_text(encoding='utf-8') == before, 'corruption not reset')

print(json.dumps(dict(status='PASS', checks=checks, concurrent_requests=34,
                     scope='PHP processes + flock service model; NOT InnoDB/X5 validation')))
