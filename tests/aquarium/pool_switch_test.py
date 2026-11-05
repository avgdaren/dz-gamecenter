#!/usr/bin/env python3
"""作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。池切换 CLI，限隔离 *_gc_test 库。"""
import json, os, re, subprocess, sys
from pathlib import Path
if os.getenv('GC_AQUARIUM_TEST') != '1' or not os.getenv('GC_DZ_ROOT') or not re.search(r'dbname=[a-z0-9_]+_gc_test(?:;|$)',os.getenv('GC_TEST_DSN',''),re.I):
    print(json.dumps(dict(status='SKIP',reason='explicit isolated X5 test DB required')));sys.exit(0)
ROOT=Path(__file__).resolve().parents[2]
PHP=os.getenv('PHP_BIN','php');WORKER=Path(__file__).with_name('migrate_worker.php')
checks=0
def check(ok,label):
    global checks
    checks+=1
    assert ok,label
def worker(**data):
    p=subprocess.run([PHP,str(WORKER)],input=json.dumps(data)+'\n',capture_output=True,text=True,encoding='utf-8',check=True)
    assert not p.stderr,p.stderr
    r=json.loads(p.stdout);assert 'test_error' not in r,r
    return r
cmd=[PHP,str(ROOT/'tools/aquarium_pool_switch.php'),'--dz-root='+os.environ['GC_DZ_ROOT'],
    '--dsn='+os.environ['GC_TEST_DSN'],'--user='+os.environ.get('GC_TEST_USER',''),
    '--password='+os.environ.get('GC_TEST_PASSWORD',''),'--plugin-dir='+str(ROOT/'source/plugin/gamecenter'),'--tablepre=gct_']
def tool(*args):
    p=subprocess.run(cmd+list(args),capture_output=True,text=True,encoding='utf-8')
    return p.returncode,[json.loads(x) for x in p.stdout.splitlines() if x.startswith('{')],p.stderr
base=1700000000000;cut=base+50*120000
worker(op='init_schema');worker(op='seed',n=4,base_ms=base,config='aquarium-content-candidate-v1')
before=[worker(op='raw',uid=i) for i in range(1,5)]
import time
for bad in [None,'nonsense','0','-1','1.5','1e12',' 1700000000000','1700000000000x','9'*100,str(int(time.time()*1000)+86400000)]:
    args=['--apply']+([] if bad is None else ['--cutoff='+bad])
    rc,lines,err=tool(*args)
    check(rc==2,'reject missing/invalid/future cutoff '+str(bad))
    check([worker(op='raw',uid=i) for i in range(1,5)]==before,'invalid cutoff no writes')
rc,lines,err=tool('--cutoff='+str(cut))
check(rc==0 and lines[-1]['migrated']==4,'fixed dry run sees four healthy rows')
check([worker(op='raw',uid=i) for i in range(1,5)]==before,'dry run no writes')
rc,lines,err=tool('--apply','--cutoff='+str(cut))
check(rc==0 and lines[-1]['migrated']==4,'v1 to v2 applied')
after=[worker(op='raw',uid=i) for i in range(1,5)]
for row,old in zip(after,before):
    s=json.loads(row['state_json']);prior=json.loads(old['state_json'])
    check(row['config_version']==s['config_version']=='aquarium-content-v2-candidate-v1','both headers upgraded')
    check(s['catch_seq']==50 and s['last_settled_ms']==cut,'settled source exactly to fixed N')
    check(s['seed_hex']==prior['seed_hex'] and s['layout']==prior['layout'],'seed and layout preserved')
    check(all(f['catch_count']==f['owned_count']+f['sold_count'] for f in s['fish'].values()),'stock conserved')
rc,lines,err=tool('--apply','--cutoff='+str(cut))
check(rc==0 and lines[-1]['skipped']==4,'repeat skipped')
check([worker(op='raw',uid=i) for i in range(1,5)]==after,'repeat byte-for-byte unchanged')
# A target version alone never implies valid inventory.
s=json.loads(after[0]['state_json']);s['inventory_schema']=99
worker(op='replace_state',uid=1,state=s);badrow=worker(op='raw',uid=1)
rc,lines,err=tool('--apply','--cutoff='+str(cut))
check(rc==3 and lines[-1]['stopped'] and lines[-1]['uid']==1,'bad target stops apply')
check(worker(op='raw',uid=1)==badrow,'bad target unchanged')
# A future source anchor cannot advance the task-wide cutoff or be migrated.
s=json.loads(before[0]['state_json']);s['last_settled_ms']=cut+1
worker(op='replace_state',uid=1,state=s);badrow=worker(op='raw',uid=1)
rc,lines,err=tool('--apply','--cutoff='+str(cut))
check(rc==3 and lines[-1]['reason']=='anchor-after-cutoff','future source anchor rejected')
check(worker(op='raw',uid=1)==badrow,'future source unchanged')
print(json.dumps(dict(status='PASS',checks=checks,driver=os.getenv('GC_TEST_DRIVER','pdo'),scope='actual pool-switch CLI + isolated InnoDB synthetic rows')))
