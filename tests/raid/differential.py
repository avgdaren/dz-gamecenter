#!/usr/bin/env python3
"""作者：GPT / Codex；保留原插件 (C) 2026 Carinoasd 署名。随机合法/非法路径对照。"""
import importlib.util
import json
import os
from pathlib import Path
import random
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('raid_model', root / 'docs/raid/balance_check.py')
model = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = model
spec.loader.exec_module(model)
rng = random.Random(20261026)
cases, expected = [], []
for i in range(6000):
    players = 1 if i % 2 == 0 else 2
    rules = (model.CURRENT,model.V2,model.CANDIDATE)[i//2000]
    state = model.initial(players,rules)
    route, trace, invalid = [], [], False
    for round_no in range(1, rules.limit(players)+1):
        row = []
        for actor in range(players):
            if state.hp[actor] <= 0:
                row.append(('-', -1))
                continue
            options = [('A', -1)] + [('G', j) for j in range(players) if state.hp[j] > 0]
            options += [('H', j) for j in range(players) if 0 < state.hp[j] < 40 and state.pots[actor] > 0]
            row.append(rng.choice(options))
        if i % 11 == 0 and round_no == 2:
            row[0] = ('G', 9)  # Deliberately invalid target; state must not resolve.
        route.append(row)
        preview = model.intent(state, round_no,rules)
        after = model.resolve(state, row, round_no,rules)
        if after is None:
            invalid = True
            break
        state = after
        trace.append(dict(preview=preview, hp=state.hp, boss=state.boss, pots=state.pots, exposed=state.exposed))
        if state.boss == 0 or not any(state.hp):
            break
    cases.append(dict(rules_version=rules.version, mode='solo' if players == 1 else 'duo', route=route))
    expected.append(dict(invalid=invalid, trace=trace))
php = os.environ.get('PHP_BIN', 'php')
# Bound the harness memory rather than requiring a larger production PHP memory_limit.
actual = []
for offset in range(0,len(cases),500):
    result = subprocess.run([php, '-n', str(root / 'tests/raid/rules.php'), '--batch'], input=json.dumps(cases[offset:offset+500]), capture_output=True, text=True)
    if result.returncode:
        raise AssertionError(f'PHP batch at {offset} failed: stdout={result.stdout[:400]!r} stderr={result.stderr[:400]!r}')
    actual.extend(json.loads(result.stdout))
expected = json.loads(json.dumps(expected))
for i, (a, b) in enumerate(zip(actual, expected, strict=True)):
    assert a == b, f'case {i}: {a} != {b}'
print(json.dumps(dict(status='PASS', cases=len(cases), rounds=sum(len(x['trace']) for x in expected))))
