#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。离线参数扫描，绝不写生产规则。

入口 balance_check.py --grid。确定性策略不伪造人群胜率；随机策略仅代表均匀合法动作。
"""
from dataclasses import dataclass, asdict
from itertools import product
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import random
from statistics import mean

from balance_check import Rules, State, initial, intent, resolve, CANDIDATE


@dataclass(frozen=True)
class GridRules(Rules):
    round_limit_rule: str = 'strict_16'


def outcome(state, round_no, rules):
    # Same lethal priority as production: a killing player attack prevents counterattack.
    if state.boss == 0:
        return 'win'
    if not any(state.hp):
        return 'loss'
    if round_no >= rules.limit(len(state.hp)):
        if rules.round_limit_rule == 'retreat_below_20pct' and state.boss * 5 < rules.boss_max_hp(len(state.hp)):
            return 'retreat'
        return 'loss'
    return 'active'


def legal_actions(state, actor):
    if state.hp[actor] <= 0:
        return (('-', -1),)
    alive = [i for i, hp in enumerate(state.hp) if hp > 0]
    return (('A', -1),) + tuple(('G', i) for i in alive) + tuple(
        ('H', i) for i in alive if state.pots[actor] > 0 and state.hp[i] < 40)


def choose(state, round_no, rules, policy, rng):
    if policy == 'random':
        return tuple(rng.choice(legal_actions(state, actor)) for actor in range(len(state.hp)))
    if policy in ('blind', 'guard'):
        return tuple(('-', -1) if hp <= 0 else (('A', -1) if policy == 'blind' else ('G', i))
                     for i, hp in enumerate(state.hp))
    preview = intent(state, round_no, rules)
    if len(state.hp) == 1:
        # Existing balance_check.heuristic / solo_reasonable fixture, threshold 20.
        code = 'G' if preview['kind'] == 2 else ('H' if preview['kind'] != 3 and state.hp[0] <= 20 and state.pots[0] > 0 else 'A')
        return ((code, -1 if code == 'A' else 0),)
    # Existing duo_cover fixture: focused player attacks, partner wards focus on heavy turns.
    focus = preview['targets'][0] if preview['targets'] else None
    return tuple(('-', -1) if hp <= 0 else ('G', focus) if preview['kind'] == 2 and i != focus else ('A', -1)
                 for i, hp in enumerate(state.hp))


def run(players, rules, policy, rng=None):
    state = initial(players, rules)
    for round_no in range(1, rules.limit(players) + 1):
        actions = choose(state, round_no, rules, policy, rng)
        state = resolve(state, actions, round_no, rules)
        assert state is not None, 'policy emitted illegal action'
        result = outcome(state, round_no, rules)
        if result != 'active':
            return {'result': result, 'rounds': round_no, 'hp': state.hp, 'boss': state.boss}
    raise AssertionError('unterminated simulation')


def summarize(runs, deterministic=False):
    successes = [r for r in runs if r['result'] in ('win', 'retreat')]
    def avg(key, rows):
        return round(mean(key(r) for r in rows), 6) if rows else None
    def quantiles(rows):
        values = sorted(r['rounds'] for r in rows)
        return {str(p): values[round((len(values) - 1) * p / 100)] for p in (10, 50, 90)} if values else None
    n, rate = len(runs), len(successes) / len(runs)
    z = 1.95996398454
    center = (rate + z*z/(2*n)) / (1 + z*z/n)
    margin = z*math.sqrt(rate*(1-rate)/n + z*z/(4*n*n)) / (1 + z*z/n)
    interval = [round(max(0,center-margin)*100,6), round(min(1,center+margin)*100,6)]
    return {'samples': n, 'successes': len(successes), 'deterministic': deterministic,
            'win_rate_wilson95': None if deterministic else interval,
            'win_rate': round(len(successes) * 100 / len(runs), 6),
            'kill_rate': round(sum(r['result'] == 'win' for r in runs) * 100 / len(runs), 6),
            'retreat_rate': round(sum(r['result'] == 'retreat' for r in runs) * 100 / len(runs), 6),
            'avg_rounds': avg(lambda r: r['rounds'], successes),
            'avg_remaining_hp': avg(lambda r: mean(r['hp']), successes),
            'avg_rounds_all': avg(lambda r: r['rounds'], runs),
            'avg_remaining_hp_all': avg(lambda r: mean(r['hp']), runs),
            'winning_round_quantiles': quantiles(successes),
            'example': runs[0] if deterministic else None}


@lru_cache(maxsize=None)
def evaluate(players, rules, games, seed):
    result = {p: summarize([run(players, rules, p)], True) for p in ('blind', 'guard', 'heuristic')}
    # Reuse random seed for every candidate: same random experiment definition, not rerolling until good.
    rng = random.Random(seed + players * 1_000_003)
    result['random'] = summarize([run(players, rules, 'random', rng) for _ in range(games)])
    if players == 1:
        states = {initial(1, rules): (1, '')}
        wins = 0
        best = None
        max_states = 1
        for round_no in range(1, rules.limit(1) + 1):
            following = {}
            for state, (count, path) in states.items():
                for action in legal_actions(state, 0):
                    after = resolve(state, (action,), round_no, rules)
                    terminal = outcome(after, round_no, rules)
                    route = path + action[0]
                    if terminal in ('win', 'retreat'):
                        wins += count
                        witness = {'result': terminal, 'rounds': round_no, 'hp': after.hp, 'boss': after.boss, 'route': route}
                        if best is None or (round_no, -after.hp[0], route) < (best['rounds'], -best['hp'][0], best['route']):
                            best = witness
                    elif terminal == 'active':
                        old_count, old_path = following.get(after, (0, route))
                        following[after] = (old_count + count, min(old_path, route))
            states = following
            max_states = max(max_states, len(states))
        # "Optimal rate" is existence of a winning policy in one deterministic battle, not sequence frequency.
        result['optimal'] = summarize([best], True) if best else {'samples': 1, 'deterministic': True, 'win_rate': 0, 'avg_rounds': None, 'avg_remaining_hp': None}
        result['optimal'].update(winning_sequences=wins, witness=best, peak_merged_states=max_states,
                                 interpretation='existence of a winning route; not human win probability')
    else:
        result['optimal'] = {'status': 'NOT_RUN', 'reason': 'solo exact search only'}
    return result


def distance(value, lower, upper, unit):
    if value is None:
        return 10.0
    return max(lower - value, value - upper, 0) / unit


def score(policies):
    solo, duo = policies['solo'], policies['duo']
    components = {
        'solo_blind': distance(solo['blind']['win_rate'], 0, 10, 10),
        'solo_heuristic_rate': distance(solo['heuristic']['win_rate'], 55, 65, 5),
        'solo_heuristic_hp': distance(solo['heuristic']['avg_remaining_hp'], 20, 40, 6),
        'duo_heuristic_rate': distance(duo['heuristic']['win_rate'], 70, 80, 5),
        'duo_heuristic_rounds': distance(duo['heuristic']['avg_rounds'], 8, 11, 3)}
    weights = {'solo_blind': 1, 'solo_heuristic_rate': 4, 'solo_heuristic_hp': 2,
               'duo_heuristic_rate': 3, 'duo_heuristic_rounds': 1}
    return round(sum(components[k] * weights[k] for k in weights), 6), components


def scan(games=2000, seed=20261027):
    if games < 1:
        raise ValueError('games must be positive')
    grid = []
    for solo_hp, pots, heal, duo_hp, limit in product((110, 115, 120), (3, 4), (28, 32), (130, 150, 160), ('strict_16', 'retreat_below_20pct')):
        params = dict(solo_boss_hp=solo_hp, solo_potions=pots, heal=heal, duo_boss_hp=duo_hp, round_limit_rule=limit)
        # Cache equivalent per-mode simulations, including exact search; no stochastic cross-mode coupling.
        solo = GridRules(solo_boss_hp=solo_hp, solo_potions=pots, heal=heal, round_limit_rule=limit)
        duo = GridRules(boss_hp=duo_hp, heal=heal, round_limit_rule=limit)
        policies = {'solo': evaluate(1, solo, games, seed), 'duo': evaluate(2, duo, games, seed)}
        weighted, components = score(policies)
        grid.append({'params': params, 'policies': policies, 'qualified': weighted == 0,
                     'weighted_distance': weighted, 'distance_components': components})
    # Prefer fewest changes from current rules on exact score ties; then stable grid order.
    baseline = dict(solo_boss_hp=120, solo_potions=3, heal=28, duo_boss_hp=130, round_limit_rule='strict_16')
    recommended = min(grid, key=lambda row: (row['weighted_distance'], sum(row['params'][k] != baseline[k] for k in baseline)))
    recommended = {**recommended, 'applied': False,
                   'reason': 'Minimum weighted interval distance; ties prefer fewer changes from current rules. '
                             'Deterministic fixture policies yield only 0/100%, so no candidate meets the requested probability intervals. '
                             'Closest candidate is exploratory, not qualified or applied; define a player-error/seeded encounter population before interpreting human win rates.'}
    root = Path(__file__).resolve().parents[2]
    report = {'status': 'PASS' if any(row['qualified'] for row in grid) else 'NO_MATCH',
            'grid_complete': True, 'games_per_mode_random': games, 'seed': seed,
            'scope': 'offline deterministic rules model; no human playtest or production changes',
            'metric_definition': {'win_rate': 'percent; kills plus below-20-percent retreats reported separately',
                                  'avg_rounds': 'successful runs only; null if no success',
                                  'avg_remaining_hp': 'successful runs only; mean across original seats, downed seat counts as zero',
                                  'random': 'uniform independent legal actions per living actor; not a model of new players',
                                  'heuristic': 'solo_reasonable threshold20 and duo_cover fixture policies; one deterministic run each',
                                  'retreat': 'only at round16, surviving party and boss/max strictly <20%; counted as success in model only',
                                  'weights': {'solo_blind': 1, 'solo_heuristic_rate': 4, 'solo_heuristic_hp': 2, 'duo_heuristic_rate': 3, 'duo_heuristic_rounds': 1},
                                  'tie_break': 'fewest parameters changed from current; then stable Cartesian order'},
            'source_sha256': {p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in
                              ('docs/raid/balance_check.py', 'docs/raid/balance_grid.py', 'source/plugin/gamecenter/lib/raid_rules.php')},
            'baseline': {'params': baseline, 'policies': {'solo': evaluate(1, GridRules(), games, seed), 'duo': evaluate(2, GridRules(), games, seed)}},
            'grid': grid, 'recommended': recommended,
            'rules_version_changed': False, 'reference_regenerated': False}
    from balance_tolerance import enrich
    return enrich(report,games,seed)


def table(report):
    lines = ['mode policy       win% rounds  HP/seat', '-------------------------------------']
    for mode, policies in report['recommended']['policies'].items():
        for name, row in policies.items():
            if row.get('status') == 'NOT_RUN':
                continue
            def fmt(value):
                return '-' if value is None else f'{value:.2f}'
            lines.append(f'{mode:4} {name:10} {fmt(row["win_rate"]):>6} {fmt(row["avg_rounds"]):>6} {fmt(row["avg_remaining_hp"]):>8}')
    lines += ['status=' + report['status'] + ' (explicit error model, no human playtest)', 'closest=' + json.dumps(report['recommended']['params'], sort_keys=True),
              'distance=' + str(report['recommended']['weighted_distance']) + '; applied_to_source=' + str(report['recommended']['applied']), 'A/B metrics=' + json.dumps(report['recommended'].get('metrics',{}),separators=(',',':')), '', 'All 72 combinations:']
    for i, row in enumerate(report['grid'], 1):
        p, s, d = row['params'], row['policies']['solo'], row['policies']['duo']
        lines.append(f'{i:02} S{p["solo_boss_hp"]}/P{p["solo_potions"]}/H{p["heal"]}/D{p["duo_boss_hp"]}/{p["round_limit_rule"]:20} '
                     f'blind={s["blind"]["win_rate"]:5.1f} soloH={s["heuristic"]["win_rate"]:5.1f} duoH={d["heuristic"]["win_rate"]:5.1f} '
                     f'soloR={s["random"]["win_rate"]:5.2f} duoR={d["random"]["win_rate"]:5.2f} score={str(row['weighted_distance'])}')
    lines += ['', 'Strict candidates: solo delta1/delta2, duo delta1, solo p=.8/.6 (percent):']
    for i,row in enumerate(report['grid'],1):
        if not row.get('eligible_for_recommendation'):continue
        s,d=row['metrics']['solo'],row['metrics']['duo']
        lines.append(f'{i:02}: D1={s["tolerance"]["delta1"]["rate"]:.3f} D2={s["tolerance"]["delta2"]["rate"]:.3f} '
                     f'duoD1={d["tolerance"]["delta1"]["rate"]:.3f} p08={s["mistakes"]["0.8"]["win_rate"]:.2f} '
                     f'p06={s["mistakes"]["0.6"]["win_rate"]:.2f} score={row["weighted_distance"]}')
    lines += ['', 'Per-combination policies (rounds/HP are success-only; - means no success):']
    for i, row in enumerate(report['grid'], 1):
        lines.append(f'[{i:02}] ' + json.dumps(row['params'], sort_keys=True))
        lines.append('mode policy       win% rounds  HP/seat allRounds')
        for mode, policies in row['policies'].items():
            for name, metric in policies.items():
                if metric.get('status') == 'NOT_RUN':
                    continue
                lines.append(f'{mode:4} {name:10} {fmt(metric["win_rate"]):>6} {fmt(metric["avg_rounds"]):>6} '
                             f'{fmt(metric["avg_remaining_hp"]):>8} {fmt(metric.get("avg_rounds_all")):>9}')
    return '\n'.join(lines) + '\n'
