#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。独立标准库参考；不修改生产冻结值。"""
import hashlib
import hmac
import json


def fixture():
    c = dict(version='aquarium-foundation-v1', cap_ms=86400000,
             periods_ms=[120000, 108000, 96000, 84000, 72000],
             rod_costs=[0, 120, 260, 600, 900], initial_coins=120,
             initial_water='test_pond', initial_fish='test_pond_a', waters={})
    for wid in ['test_bay', 'test_pond']:
        pond = wid == 'test_pond'
        c['waters'][wid] = dict(cost=0 if pond else 2000,
                               requires_water='' if pond else 'test_pond',
                               requires_count=0 if pond else 4, fish={})
        for i, w in enumerate([34, 28, 18, 12, 6, 2]):
            c['waters'][wid]['fish'][f'{wid}_{chr(97+i)}'] = dict(
                weight=w, coins=([2, 2, 3, 3, 5, 10] if pond else [4, 4, 5, 6, 10, 18])[i])
    canonical = 'aquarium-pools-v1\n' + ''.join(
        f'{wid}\t{fid}\t{f["weight"]}\n'
        for wid, water in c['waters'].items() for fid, f in water['fish'].items())
    c['pool_hash'] = hashlib.sha256(canonical.encode()).hexdigest()
    c['config_hash'] = hashlib.sha256(json.dumps(c, separators=(',', ':')).encode()).hexdigest()
    return c


if __name__ == '__main__':
    vectors = []
    for n in range(1, 5):
        msg = f'12345:{n}:0'
        digest = hmac.new(bytes(range(16)), msg.encode(), hashlib.sha256).digest()
        x = int.from_bytes(digest[:4], 'big')
        vectors.append(dict(message=msg, digest=digest.hex(), x=x, ticket=x % 100))
    print(json.dumps(dict(config=fixture(), vectors=vectors), indent=2))
