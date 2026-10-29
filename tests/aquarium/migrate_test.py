#!/usr/bin/env python3
"""作者：小蓝（DSH）。水族馆存档迁移工具验收：dry-run / apply / 幂等 / 断点 / 未知版本 / 备份还原。

需要 GC_AQUARIUM_TEST=1、原版 X5 根目录与以 _gc_test 结尾的隔离库；否则 SKIP。
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

if (os.getenv('GC_AQUARIUM_TEST') != '1' or not os.getenv('GC_DZ_ROOT') or
        not re.search(r'dbname=[a-z0-9_]+_gc_test(?:;|$)', os.getenv('GC_TEST_DSN', ''), re.I)):
    print(json.dumps(dict(status='SKIP', reason='requires GC_AQUARIUM_TEST=1, original GC_DZ_ROOT, *_gc_test DSN')))
    sys.exit(0)

PHP = os.getenv('PHP_BIN', 'php')
ROOT = Path(__file__).resolve().parents[2]
WORKER = Path(__file__).with_name('migrate_worker.php')
TOOL = ROOT / 'tools' / 'aquarium_migrate.php'
DSN = os.environ['GC_TEST_DSN']
USER = os.environ.get('GC_TEST_USER', '')
PASSWORD = os.environ.get('GC_TEST_PASSWORD', '')
DZ = os.environ['GC_DZ_ROOT']
TABLEPRE = 'gct_'
checks = 0


def check(ok, msg, detail=''):
    global checks
    checks += 1
    if not ok:
        print(f'FAIL {msg} {detail}')
        raise AssertionError(msg)


def worker(**x):
    p = subprocess.run([PHP, str(WORKER)], input=json.dumps(x) + '\n', capture_output=True, text=True, encoding='utf-8', check=True)
    assert not p.stderr, p.stderr
    r = json.loads(p.stdout)
    assert 'test_error' not in r, r
    return r


def tool(*args):
    cmd = [PHP, str(TOOL), '--dz-root=' + DZ, '--dsn=' + DSN, '--user=' + USER,
           '--password=' + PASSWORD, '--tablepre=' + TABLEPRE, *args]
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    return p.returncode, p.stdout, p.stderr


def migration_lines(out):
    return [json.loads(l) for l in out.strip().split('\n') if l.strip().startswith('{')]


with tempfile.TemporaryDirectory(prefix='aq-migrate-', ignore_cleanup_errors=True) as tmp:
    job = str(Path(tmp) / 'job.json')
    backup = str(Path(tmp) / 'backup.json')

    # 1. 造 12 个旧档
    worker(op='init_schema')
    worker(op='seed', n=12)
    before = worker(op='raw', uid=2)
    check(before['config_version'] == 'aquarium-foundation-v1', 'saw raw row at foundation', before['config_version'])
    state_before = json.loads(before['state_json'])
    check(len(state_before['fish']) > 1, 'seeded row has discoveries', str(len(state_before['fish'])))

    # 2. dry-run 不写库
    rc, out, err = tool('--mode=dry-run', '--job=' + job)
    check(rc == 0, 'dry-run exits 0', err[:200])
    lines = migration_lines(out)
    would = lines[-1]['would']
    check(would.get('migrated') == 12, 'dry-run would migrate 12', str(would))
    after_dry = worker(op='raw', uid=2)
    check(after_dry['state_json'] == before['state_json'], 'dry-run did not touch rows')
    check(after_dry['config_version'] == 'aquarium-foundation-v1', 'dry-run kept version')

    # 3. 备份
    rc, out, err = tool('--mode=backup', '--out=' + backup)
    check(rc == 0 and Path(backup).exists(), 'backup written', err[:200])
    check(len(json.loads(Path(backup).read_text(encoding='utf-8'))['rows']) == 12, 'backup has 12 rows')

    # 4. apply 分批迁移
    rc, out, err = tool('--mode=apply', '--yes', '--batch=5', '--job=' + job)
    check(rc == 0, 'apply exits 0', (err or out)[-300:])
    counts = {c['v']: int(c['c']) for c in worker(op='counts')}
    check(counts == {'aquarium-content-candidate-v1': 12}, 'all rows migrated', str(counts))

    # 5. 迁移保留余额/种子/序号/发现
    row = worker(op='raw', uid=2)
    state = json.loads(row['state_json'])
    check(row['config_version'] == 'aquarium-content-candidate-v1', 'row version updated')
    check(state['seed_hex'] == state_before['seed_hex'], 'seed preserved')
    check(state['catch_seq'] >= state_before['catch_seq'], 'catch_seq preserved or advanced',
          f"{state_before['catch_seq']} -> {state['catch_seq']}")
    check(state['coins'] >= state_before['coins'], 'coins preserved or advanced')
    for fid in state['fish']:
        check(not fid.startswith('test_'), 'fish id remapped', fid)
    check(state['current_water'] in ('pond', 'bay'), 'water remapped', state['current_water'])
    check(set(state['no_new_count'].keys()) == {'pond', 'bay'}, 'no_new_count remapped', str(list(state['no_new_count'])))
    check(state['last_settled_ms'] == row['updated_ms'], 'anchor equals row updated_ms')

    # 6. 重复执行幂等
    rc, out, err = tool('--mode=apply', '--yes', '--batch=5', '--job=' + job)
    check(rc == 0, 'second apply exits 0', (err or out)[-300:])
    again = {c['v']: int(c['c']) for c in worker(op='counts')}
    check(again == {'aquarium-content-candidate-v1': 12}, 'second apply idempotent', str(again))
    row2 = worker(op='raw', uid=2)
    check(row2['state_json'] == row['state_json'], 'second apply did not rewrite state')
    rc, out, err = tool('--mode=verify')
    check(rc == 0 and json.loads(out.strip())['target'] == 12, 'verify passes', out.strip()[:200])

    # 7. 未知版本行：报失败且不动
    worker(op='init_schema')
    worker(op='seed', n=4)
    worker(op='set_version', uid=3, version='weird-v9')
    Path(job).unlink(missing_ok=True)
    rc, out, err = tool('--mode=apply', '--yes', '--batch=10', '--job=' + job)
    last = migration_lines(out)[-2] if len(migration_lines(out)) > 1 else migration_lines(out)[-1]
    stats = last.get('stats', {})
    check(stats.get('failed') == 1, 'unknown version reported as failure', str(stats))
    check(worker(op='raw', uid=3)['config_version'] == 'weird-v9', 'unknown version row untouched')
    check(worker(op='raw', uid=1)['config_version'] == 'aquarium-content-candidate-v1', 'others still migrated')

    # 8. 备份还原回退
    rc, out, err = tool('--mode=restore', '--in=' + backup, '--yes')
    check(rc == 0, 'restore exits 0', err[:200])
    restored = {c['v']: int(c['c']) for c in worker(op='counts')}
    check(restored == {'aquarium-foundation-v1': 12}, 'restore brought back old rows', str(restored))

    # 9. 中断/续跑：先只跑 1 批（等于进程被杀），再续跑
    job2 = str(Path(tmp) / 'job-resume.json')
    rc, out, err = tool('--mode=apply', '--yes', '--batch=5', '--max-batches=1', '--job=' + job2)
    check(rc == 0, 'partial apply exits 0', (err or out)[-300:])
    partial = {c['v']: int(c['c']) for c in worker(op='counts')}
    check(partial.get('aquarium-content-candidate-v1', 0) == 5, 'only first batch migrated', str(partial))
    check(worker(op='raw', uid=6)['config_version'] == 'aquarium-foundation-v1', 'second batch untouched')
    job_saved = json.loads(Path(job2).read_text(encoding='utf-8'))
    check(int(job_saved['cursor_uid']) == 5, 'cursor persisted at batch boundary', str(job_saved['cursor_uid']))

    # 10. 续跑收尾，且切点不被重取
    rc, out, err = tool('--mode=apply', '--yes', '--batch=3', '--job=' + job2)
    job_after = json.loads(Path(job2).read_text(encoding='utf-8'))
    check(job_after['cutoff_ms'] == job_saved['cutoff_ms'], 'cutoff kept across runs',
          f"{job_saved['cutoff_ms']} -> {job_after['cutoff_ms']}")
    rc, out, err = tool('--mode=verify')
    check(rc == 0 and json.loads(out.strip())['target'] == 12, 'verify passes after resume', out.strip()[:200])


print(json.dumps(dict(status='PASS', checks=checks, scope='migration tool: dry-run/apply/idempotent/resume/unknown/backup-restore')))
