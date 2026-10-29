#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。独立Python捕获模型对照实际PHP结算。"""
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess
from reference import fixture

root = Path(__file__).resolve().parents[2]
config = fixture()
php = '''define('IN_DISCUZ',true);require 'source/plugin/gamecenter/lib/aquarium_config.php';
$uid=(int)trim(stream_get_contents(STDIN));$c=gamecenter_aquarium_config::load();
$s=gamecenter_aquarium_rules::initial($uid,'000102030405060708090a0b0c0d0e0f',1000000,$c);
echo json_encode(['config'=>$c,'result'=>gamecenter_aquarium_rules::settle($s,87400000,$c)],JSON_THROW_ON_ERROR);'''
checks = 0
for uid in [1, 2, 7, 12345, 2147483647]:
    p = subprocess.run([os.getenv('PHP_BIN', 'php'), '-r', php], input=str(uid), capture_output=True, text=True, cwd=root, check=True)
    assert not p.stderr, p.stderr
    actual = json.loads(p.stdout)
    assert actual['config'] == config
    fish = {'test_pond_a': dict(discovered_at=1000000, catch_count=1)}
    coins, no_new, catches = 122, 0, []
    pool = config['waters']['test_pond']['fish']
    for seq in range(1, 721):
        missing = {k: v for k, v in pool.items() if k not in fish}
        eligible = missing if missing and no_new >= 80 else pool
        total = sum(v['weight'] for v in eligible.values())
        limit = (2**32//total)*total
        draw = 0
        while True:
            msg = f'{uid}:{seq}:{draw}'.encode()
            x = int.from_bytes(hmac.new(bytes(range(16)), msg, hashlib.sha256).digest()[:4], 'big')
            if x < limit:
                ticket = x % total
                break
            draw += 1
        cumulative = 0
        for fid in sorted(eligible):
            cumulative += eligible[fid]['weight']
            if ticket < cumulative:
                break
        at = 1000000+seq*120000
        is_new = fid not in fish
        if is_new:
            fish[fid] = dict(discovered_at=at, catch_count=0)
        fish[fid]['catch_count'] += 1
        coins += pool[fid]['coins']
        no_new = 0 if is_new else min(80, no_new+1) if missing else no_new
        catches.append(dict(fish_id=fid, coins=pool[fid]['coins'], is_new=is_new, caught_ms=at))
    result = actual['result']
    assert result['catches'] == catches
    assert result['save']['fish'] == fish
    assert result['save']['coins'] == coins
    assert result['save']['no_new_count']['test_pond'] == no_new
    checks += 5+len(catches)
print(json.dumps(dict(status='PASS', checks=checks, captures=3600, scope='independent Python vs actual PHP')))
