#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。v3 fixture导出，旧版本留档。"""
import json
from pathlib import Path
from dataclasses import asdict
from balance_check import CURRENT, initial, play
from balance_grid import choose


def current_reference():
    old=json.loads((Path(__file__).parent/'P1-REFERENCE-v1.json').read_text())
    cases={}
    for name,case in old['cases'].items():
        players=1 if case['mode']=='solo' else 2
        route=[row['actions'] for row in case['expected']['trace']]
        result=play(players,route,CURRENT)
        while result['result']=='active' and len(route)<CURRENT.limit(players):
            from balance_check import State
            state=State(tuple(result['hp']),result['boss'],tuple(result['pots']),result['trace'][-1]['exposed'])
            route.append(choose(state,len(route)+1,CURRENT,'heuristic',None));result=play(players,route,CURRENT)
        if result['result']!='win':raise AssertionError('new fixture route fails: '+name)
        cases[name]={'mode':case['mode'],'start_round':1,'initial':{**asdict(initial(players,CURRENT)),'round_limit':CURRENT.limit(players)},'expected':result}
    return {**old,'rules_status':'v3 solo18/duo16 requested by user; caps stored per room; A/B/C comparison reports no full model match; human solo trial pending', 'rules':asdict(CURRENT),'cases':cases}
