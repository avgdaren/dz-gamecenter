#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。v3单人18轮A/B/C复算，非真人胜率。"""
from dataclasses import asdict
from pathlib import Path
import hashlib
import json
from balance_check import CURRENT
from balance_grid import GridRules, evaluate, run
from balance_tolerance import tolerance, mistakes


def compare(games=2000,seed=20261027):
    if games<1:raise ValueError('games must be positive')
    rows=[]
    for name,hp,potions,cap in [('v2',110,4,16),('A',110,4,18),('B',110,3,18),('C',115,4,18)]:
        rules=GridRules(solo_boss_hp=hp,solo_potions=potions,boss_hp=150,round_limit=cap,duo_round_limit=16)
        t=tolerance(1,rules);m=mistakes(1,rules,games,seed)
        row={'label':name,'params':{'solo_hp':hp,'solo_potions':potions,'solo_round_limit':cap,'duo_hp':150,'duo_round_limit':16,'heal':28},
             'tolerance':t,'mistakes':m,'policies':evaluate(1,rules,games,seed)}
        row['targets']={'delta1':t['delta1']['rate']>=60,'delta2':t['delta2']['rate']>=25,'p08':55<=m['0.8']['win_rate']<=65}
        row['qualified']=all(row['targets'].values());rows.append(row)
    choices={row['label']:row for row in rows}
    # User expressly limited this round to changing the cap; B is permitted only if all three targets pass.
    selected=choices['B'] if choices['B']['qualified'] else choices['C'] if choices['C']['qualified'] else choices['A']
    root=Path(__file__).resolve().parents[2]
    paths=['docs/raid/balance_check.py','docs/raid/balance_grid.py','docs/raid/balance_tolerance.py','docs/raid/balance_round_limit.py','source/plugin/gamecenter/lib/raid_rules.php','source/plugin/gamecenter/lib/raid.php']
    return {'status':'PASS' if selected['qualified'] else 'NO_FULL_MATCH','games_per_probability':games,'seed':seed,
            'scope':'explicit synthetic error/deviation model; not observed player win rates or human acceptance',
            'definition':{'delta':'wins/all nominal variants; illegal actions separately counted, not classified as combat defeat; legal_rate also reported',
                          'reference':'earliest solo victory then highest remaining HP; use actual reference length, not assumed15',
                          'mistakes':'per living actor each round p heuristic, otherwise uniformly any legal action including the heuristic choice',
                          'means':'successful runs only; *_all includes failures',
                          'selection':'B if all three requested targets pass, otherwise C if all pass, otherwise A preserving current HP/potions and explicitly failing unmet targets'},
            'comparisons':rows,'selected':{'label':selected['label'],'params':selected['params'],'qualified':selected['qualified'],
                'applied_to_source':CURRENT.solo_boss_hp==selected['params']['solo_hp'] and CURRENT.solo_potions==selected['params']['solo_potions'] and CURRENT.limit(1)==18 and CURRENT.limit(2)==16 and CURRENT.boss_hp==150 and CURRENT.heal==28,
                'reason':f"No full match: A preserves user-approved HP/potions and changes only solo cap. B p=.8={choices['B']['mistakes']['0.8']['win_rate']}%; C delta1={choices['C']['tolerance']['delta1']['rate']}%. No seed changes or rounding to force PASS." if not selected['qualified'] else 'Requested targets passed; B has priority.'},
            'production_rules':asdict(CURRENT),'duo_unchanged':{'tolerance':tolerance(2,GridRules(boss_hp=150,solo_boss_hp=110,solo_potions=4,round_limit=18,duo_round_limit=16)),'heuristic':run(2,GridRules(boss_hp=150),'heuristic')},
            'source_sha256':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}}


def table(report):
    lines=['label hp pots cap delta1% delta2% p1% p.9% p.8% p.7% p.6% qualified']
    for row in report['comparisons']:
        p=row['params'];t=row['tolerance'];m=row['mistakes']
        curve=' '.join(f'{m[str(x)]["win_rate"]:.2f}' for x in (1.,.9,.8,.7,.6))
        lines.append(f'{row["label"]:5} {p["solo_hp"]} {p["solo_potions"]} {p["solo_round_limit"]} {t["delta1"]["rate"]:.6f} {t["delta2"]["rate"]:.6f} {curve} {row["qualified"]}')
    lines.append('status='+report['status']+' selected='+report['selected']['label']+'; no human playtest')
    return '\n'.join(lines)+'\n'
