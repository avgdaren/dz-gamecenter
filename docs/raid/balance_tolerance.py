#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。受控偏离与显式失误模型，非真人胜率。"""
from functools import lru_cache
from itertools import combinations, product
import random
from balance_check import initial, resolve
from balance_grid import choose, legal_actions, outcome, summarize, evaluate


def reference(players,rules):
    if players==1:
        witness=evaluate(1,rules,1,0)['optimal']['witness']
        if witness is None:return []
        return [((code,-1 if code=='A' else 0),) for code in witness['route']]
    state=initial(2,rules);rows=[]
    for n in range(1,rules.round_limit+1):
        row=choose(state,n,rules,'heuristic',None);rows.append(row);state=resolve(state,row,n,rules)
        if outcome(state,n,rules)!='active':break
    return rows


def deviated(players,rules,rows,changes):
    state=initial(players,rules)
    for n in range(1,rules.round_limit+1):
        base=rows[n-1] if n<=len(rows) else choose(state,n,rules,'heuristic',None)
        actions=[]
        for actor,hp in enumerate(state.hp):
            action=changes.get((n-1,actor),base[actor])
            actions.append(action if hp>0 else ('-',-1))
        state=resolve(state,tuple(actions),n,rules)
        if state is None:return 'invalid'
        result=outcome(state,n,rules)
        if result!='active':return result
    raise AssertionError('unresolved')


@lru_cache(maxsize=None)
def tolerance(players,rules):
    rows=reference(players,rules)
    slots=[(n,actor) for n,row in enumerate(rows) for actor,a in enumerate(row) if a[0]!='-']
    # Three nominal A/G-self/H-self choices; preserve cross-guard baseline when unmodified.
    options={slot:tuple((code,-1 if code=='A' else slot[1]) for code in 'AGH' if code!=rows[slot[0]][slot[1]][0]) for slot in slots}
    def tally(order):
        counts={'win':0,'loss':0,'invalid':0,'retreat':0}
        for selected in combinations(slots,order):
            if order==2 and players==2 and selected[0][1]==selected[1][1]:continue
            for alternatives in product(*(options[slot] for slot in selected)):
                counts[deviated(players,rules,rows,dict(zip(selected,alternatives)))]+=1
        denominator=counts['win']+counts['loss']+counts['retreat']
        return {**counts,'total_variants':sum(counts.values()),'valid_variants':denominator,'all_variant_rate':round(100*(counts['win']+counts['retreat'])/sum(counts.values()),6) if counts and sum(counts.values()) else None,
                'legal_rate':round(100*(counts['win']+counts['retreat'])/denominator,6) if denominator else None,
                'rate':round(100*(counts['win']+counts['retreat'])/sum(counts.values()),6) if sum(counts.values()) else None}
    return {'reference':rows,'decisions':len(slots),'delta1':tally(1),'delta2':tally(2),
            'definition':'fixed suffix through actual winning reference length; adaptive heuristic continuation up to16; invalid inputs separately reported, not classified as combat defeat; rate uses all nominal variants as conservative bound; legal_rate excludes invalid; duo delta2 changes different seats'}


@lru_cache(maxsize=None)
def mistakes(players,rules,games,seed):
    results={}
    for probability in (1.,.9,.8,.7,.6):
        rng=random.Random(seed+players*1000003+round(probability*100)*10007);runs=[]
        for _ in range(games):
            state=initial(players,rules)
            for n in range(1,rules.round_limit+1):
                normal=choose(state,n,rules,'heuristic',None)
                row=tuple(normal[i] if hp<=0 or rng.random()<probability else rng.choice(legal_actions(state,i)) for i,hp in enumerate(state.hp))
                state=resolve(state,row,n,rules)
                assert state is not None
                result=outcome(state,n,rules)
                if result!='active':
                    runs.append({'result':result,'rounds':n,'hp':state.hp,'boss':state.boss});break
        results[str(probability)]=summarize(runs,probability==1)
    return results


def enrich(report,games,seed):
    from dataclasses import replace
    from balance_grid import GridRules, distance
    eligible=[]
    for row in report['grid']:
        p=row['params'];strict=p['round_limit_rule']=='strict_16'
        row['eligible_for_recommendation']=strict
        row['legacy_distance']=row.pop('weighted_distance');row.pop('distance_components')
        if not strict:
            row['qualified']=False;row['weighted_distance']=None;row['scoring_note']='hypothetical retreat reference only; excluded from recommendation';continue
        sr=GridRules(solo_boss_hp=p['solo_boss_hp'],solo_potions=p['solo_potions'],heal=p['heal'])
        dr=GridRules(boss_hp=p['duo_boss_hp'],heal=p['heal'])
        metrics={'solo':{'tolerance':tolerance(1,sr),'mistakes':mistakes(1,sr,games,seed)},'duo':{'tolerance':tolerance(2,dr),'mistakes':mistakes(2,dr,games,seed)}}
        row['metrics']=metrics
        s,d=metrics['solo'],metrics['duo']
        components={'solo_delta1':distance(s['tolerance']['delta1']['rate'],60,100,10),
                    'solo_delta2':distance(s['tolerance']['delta2']['rate'],25,100,10),
                    'duo_delta1':distance(d['tolerance']['delta1']['rate'],70,100,10),
                    'solo_p1':distance(s['mistakes']['1.0']['win_rate'],100,100,10),
                    'solo_p08':distance(s['mistakes']['0.8']['win_rate'],55,65,5),
                    'solo_p06':distance(s['mistakes']['0.6']['win_rate'],10,25,5),
                    'duo_rounds':distance(row['policies']['duo']['heuristic']['avg_rounds'],8,11,3)}
        row['distance_components']=components;row['weighted_distance']=round(sum(components.values()),6);row['qualified']=all(v==0 for v in components.values());eligible.append(row)
    baseline=dict(solo_boss_hp=120,solo_potions=3,heal=28,duo_boss_hp=130,round_limit_rule='strict_16')
    chosen=min(eligible,key=lambda r:(r['weighted_distance'],sum(r['params'][k]!=baseline[k] for k in baseline),r['params']['heal']!=28))
    report.update(status='PASS' if chosen['qualified'] else 'NO_MATCH',metric_version=2,
                  recommended={**chosen,'applied':False,'reason':'strict16 only; minimum unweighted normalized interval distances for explicit A/B targets and duo8..11; ties prefer fewer baseline changes then unchanged healing per lever priority; model only'},
                  assumptions={'deviations':'Actual optimal reference length, not assumed15; A/G/H type substitutions with self target. Illegal input is rejected and counted separately, not classified as combat defeat. Primary rate conservatively divides wins by all nominal variants; legal_rate excludes invalid.',
                               'mistakes':'Per living actor each round: p normal adaptive heuristic, otherwise uniformly any legal action including the normal choice; explicit synthetic error model, not measured player population.',
                               'duo_reference':'existing cover policy, not claimed exhaustive optimum; duo delta1 one slot/one seat, delta2 one slot in each seat',
                               'ranking':'retreat rows are reference-only, not eligible; equal weights for normalized A/B interval shortfalls plus duo round target; no hidden error fitting'},
                  sequential_levers=[])
    # Every adjacent step changes a single parameter, whether applied later or rejected as unnecessary.
    for label,rules in [('baseline',GridRules()),('solo_hp110',GridRules(solo_boss_hp=110)),('then_solo_potions4',GridRules(solo_boss_hp=110,solo_potions=4)),('then_duo150',GridRules(solo_boss_hp=110,solo_potions=4,boss_hp=150)),('then_heal32',GridRules(solo_boss_hp=110,solo_potions=4,boss_hp=150,heal=32))]:
        report['sequential_levers'].append({'label':label,'rules':rules.__dict__,'solo_tolerance':tolerance(1,rules),'duo_tolerance':tolerance(2,rules),'solo_mistakes':mistakes(1,rules,games,seed)})
    from balance_check import CURRENT, CANDIDATE
    from dataclasses import asdict
    actual={'solo_boss_hp':CURRENT.solo_boss_hp,'solo_potions':CURRENT.solo_potions,'heal':CURRENT.heal,'duo_boss_hp':CURRENT.boss_hp,'round_limit_rule':'strict_16'}
    report['metric_definition'].update(weights={k:1 for k in chosen['distance_components']},tie_break='fewest baseline changes, then unchanged heal28 per requested lever priority, then stable grid order')
    report.update(source_rules=asdict(CURRENT),rules_version_changed=CURRENT.version!=CANDIDATE.version,reference_regenerated=True)
    report['recommended'].update(applied=actual==report['recommended']['params'],application_scope='repository source only; no deployment or human acceptance')
    report['source_sha256']['docs/raid/balance_tolerance.py']=__import__('hashlib').sha256(__import__('pathlib').Path(__file__).read_bytes()).hexdigest()
    return report
