#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。正式ID的独立Python HMAC/保底/时间对照。"""
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
data = json.loads((root/'source/plugin/gamecenter/games/aquarium/data/content-v1-candidate.json').read_text())
c = data['config']
canonical = 'aquarium-pools-v1\n'+''.join(f'{w}\t{f}\t{v["weight"]}\n' for w, water in sorted(c['waters'].items()) for f, v in sorted(water['fish'].items()))
assert hashlib.sha256(canonical.encode()).hexdigest() == c['pool_hash']
plain = {k: v for k, v in c.items() if k != 'config_hash'}
assert hashlib.sha256(json.dumps(plain, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() == c['config_hash']
php = '''define('IN_DISCUZ',true);require 'source/plugin/gamecenter/lib/aquarium_content.php';
$x=json_decode(stream_get_contents(STDIN),true);$c=gamecenter_aquarium_content::rules_config();
$s=gamecenter_aquarium_rules::initial($x['uid'],'000102030405060708090a0b0c0d0e0f',1000000,$c);
if($x['water']==='bay'){$s['unlocked_waters']=['bay','pond'];$s['current_water']='bay';}
echo json_encode(gamecenter_aquarium_rules::settle($s,87400000,$c),JSON_THROW_ON_ERROR);'''
checks = 2
for water in ['pond', 'bay']:
    for uid in [1, 2, 7, 12345, 2147483647]:
        run = subprocess.run([os.getenv('PHP_BIN', 'php'), '-r', php], input=json.dumps(dict(uid=uid, water=water)), encoding='utf-8', capture_output=True, cwd=root, check=True)
        assert not run.stderr, run.stderr
        actual = json.loads(run.stdout)
        fish = {'pond_blue': dict(discovered_at=1000000, catch_count=1)}
        coins, no_new, catches = 122, 0, []
        pool = c['waters'][water]['fish']
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
            for fid, f in sorted(eligible.items()):
                if ticket < f['weight']:
                    break
                ticket -= f['weight']
            is_new, at = fid not in fish, 1000000+seq*120000
            if is_new:
                fish[fid] = dict(discovered_at=at, catch_count=0)
            fish[fid]['catch_count'] += 1
            coins += pool[fid]['coins']
            no_new = 0 if is_new else min(80, no_new+1) if missing else no_new
            catches.append(dict(fish_id=fid, coins=pool[fid]['coins'], is_new=is_new, caught_ms=at))
        assert actual['catches'] == catches
        assert actual['save']['fish'] == fish
        assert actual['save']['coins'] == coins
        assert actual['save']['no_new_count'][water] == no_new
        checks += 4+len(catches)
print(json.dumps(dict(status='PASS', checks=checks, captures=7200, scope='independent Python vs actual PHP; formal candidate IDs, both waters')))
