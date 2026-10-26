#!/usr/bin/env python3
"""作者：GPT / Codex。天使讨伐队企划数值演算，非已实现游戏或实机验收。

仅使用 Python 标准库；不访问论坛、数据库或网络。
插件原始代码版权 (C) 2026 Carinoasd，保留其署名。
"""
from dataclasses import dataclass, asdict, replace
import argparse
import json

PLAYER_HP = 40
BOSS_HP = 130
HEAL = 28
ATTACK = 10
EXPOSED_ATTACK = 20
ROUND_LIMIT = 16


@dataclass(frozen=True)
class Rules:
    version: str = 'raid-v1-p1-solo3'
    solo_potions: int = 3
    duo_potions: int = 2
    boss_hp: int = BOSS_HP
    heal: int = HEAL
    round_limit: int = ROUND_LIMIT


CANDIDATE = Rules()
BASELINE = replace(CANDIDATE, version='raid-v1-baseline', solo_potions=2)


@dataclass(frozen=True)
class State:
    hp: tuple
    boss: int
    pots: tuple
    exposed: bool = False


def initial(players, rules=CANDIDATE):
    assert players in (1, 2)
    potions = rules.solo_potions if players == 1 else rules.duo_potions
    return State((PLAYER_HP,) * players, rules.boss_hp, (potions,) * players)


def intent(state, round_no, rules=CANDIDATE):
    """先公布本轮阶段、攻击和目标，再收玩家行动；本轮降血不会改预告。"""
    kind = (round_no - 1) % 4
    phase = 1 if state.boss * 2 > rules.boss_hp else 2
    alive = [i for i, hp in enumerate(state.hp) if hp > 0]
    focus = ((round_no - 1) // 4) % len(state.hp)
    if focus not in alive:
        focus = alive[0]
    targets = [focus] if kind in (0, 2) else (alive if kind == 1 else [])
    damage = (24 if phase == 1 else 28) if kind == 2 else (8 if phase == 1 else 10)
    return {"kind": kind, "phase": phase, "targets": targets,
            "damage": damage if kind != 3 else 0}


def resolve(state, actions, round_no, rules=CANDIDATE):
    """动作为 (A/G/H, target_slot)；攻击 target=-1；倒地者无动作。"""
    assert len(actions) == len(state.hp)
    assert 1 <= round_no <= rules.round_limit and state.boss > 0 and any(state.hp)
    preview = intent(state, round_no, rules)
    hp, pots = list(state.hp), list(state.pots)
    wards = set()
    heals = [0] * len(hp)
    attackers = 0
    for actor, (kind, target) in enumerate(actions):
        if state.hp[actor] <= 0:
            if kind != "-":
                return None
            continue
        if kind == "A" and target == -1:
            attackers += 1
        elif kind in ("G", "H") and 0 <= target < len(hp) and state.hp[target] > 0:
            if kind == "G":
                wards.add(target)
            else:
                if pots[actor] <= 0 or state.hp[target] >= PLAYER_HP:
                    return None
                pots[actor] -= 1
                heals[target] += rules.heal
        else:
            return None
    for target, amount in enumerate(heals):
        hp[target] = min(PLAYER_HP, hp[target] + amount)
    attack = EXPOSED_ATTACK if preview["kind"] == 3 and state.exposed else ATTACK
    boss = max(0, state.boss - attackers * attack)
    if boss == 0:
        return State(tuple(hp), 0, tuple(pots))
    for target in preview["targets"]:
        amount = preview["damage"]
        if target in wards:
            amount = (amount + 4) // 5
        hp[target] = max(0, hp[target] - amount)
    exposed = preview["kind"] == 2 and any(
        target in wards and hp[target] > 0 for target in preview["targets"])
    return State(tuple(hp), boss, tuple(pots), exposed)


def play(players, route, rules=CANDIDATE):
    state = initial(players, rules)
    trace = []
    for round_no, row in enumerate(route, 1):
        actions = tuple(action if state.hp[i] > 0 else ("-", -1)
                        for i, action in enumerate(row))
        preview = intent(state, round_no, rules)
        after = resolve(state, actions, round_no, rules)
        if after is None:
            return {"result": "invalid", "rounds": round_no, "hp": state.hp,
                    "boss": state.boss, "pots": state.pots, "trace": trace}
        state = after
        trace.append({"round": round_no, "preview": preview, "actions": actions,
                      "hp": state.hp, "boss": state.boss, "pots": state.pots})
        if state.boss == 0 or not any(state.hp):
            break
    result = "win" if state.boss == 0 else ("loss" if not any(state.hp) or len(trace) == rules.round_limit else "active")
    return {"result": result, "rounds": len(trace), "hp": state.hp,
            "boss": state.boss, "pots": state.pots, "trace": trace}


def solo_row(code):
    return ((code, -1 if code == "A" else 0),)


def enumerate_solo(rules=CANDIDATE):
    """按相同战斗状态归并，精确统计合法行动序列；不是随机胜率。"""
    states = {initial(1, rules): (1, "")}
    wins = 0
    first_round = None
    surviving_examples = []
    for round_no in range(1, rules.round_limit + 1):
        next_states = {}
        for state, (count, path) in states.items():
            for code in "AGH":
                target = -1 if code == "A" else 0
                after = resolve(state, ((code, target),), round_no, rules)
                if after is None or not any(after.hp):
                    continue
                if after.boss == 0:
                    wins += count
                    first_round = first_round or round_no
                    surviving_examples.append((after.hp[0], path + code))
                    continue
                old_count, old_path = next_states.get(after, (0, path + code))
                next_states[after] = (old_count + count, old_path)
        states = next_states
    return {"winning_sequences": wins, "earliest_win_round": first_round,
            "best_surviving_hp": max((hp for hp, _ in surviving_examples), default=0)}


def heuristic(rules, heal_threshold=20):
    """审阅中所测策略：重击先守护，非回气轮低血恢复，其余攻击。"""
    state = initial(1, rules)
    route = []
    for round_no in range(1, rules.round_limit + 1):
        kind = (round_no - 1) % 4
        code = 'G' if kind == 2 else ('H' if kind != 3 and state.hp[0] <= heal_threshold and state.pots[0] > 0 else 'A')
        row = solo_row(code)
        state = resolve(state, row, round_no, rules)
        assert state is not None
        route.append(row)
        if state.boss == 0 or not any(state.hp):
            break
    result = play(1, route, rules)
    result['route'] = ''.join(row[0][0] for row in route)
    return result


def one_step_changes(path, rules):
    """固定后续脚本，单步替换；invalid 是接口应拒绝，不计成战败。"""
    counts = {'win': 0, 'loss': 0, 'invalid': 0, 'active': 0}
    for index, old in enumerate(path):
        for code in 'AGH':
            if code == old:
                continue
            changed = path[:index] + code + path[index + 1:]
            result = play(1, [solo_row(item) for item in changed], rules)
            counts[result['result']] += 1
    return counts


def main():
    parser = argparse.ArgumentParser(description='离线企划模型；默认规则为 P1 试玩候选，不是已确定的上线数值')
    parser.add_argument('--trace', action='store_true', help='同时导出参考路线逐轮状态，供 PHP 规则对照')
    args = parser.parse_args()
    checks = 0

    def check(value, name):
        nonlocal checks
        if not value:
            raise AssertionError(name)
        checks += 1

    solo = play(1, [solo_row(x) for x in "AAGA AHGA AGGA HAGA".replace(" ", "")])
    solo_fast = play(1, [solo_row(x) for x in "AAGA AHGA AHGA AAA".replace(" ", "")])
    check(solo["result"] == "win" and solo["rounds"] == 16 and solo["hp"] == (10,), "solo survival route")
    check(solo_fast["result"] == "win" and solo_fast["rounds"] == 15 and solo_fast["hp"] == (4,), "solo finish-before-heavy route")
    solo_count = enumerate_solo()
    check(solo_count == {"winning_sequences": 43, "earliest_win_round": 15, "best_surviving_hp": 24}, "candidate exact solo search")
    solo_greedy = play(1, [(('A', -1),)] * ROUND_LIMIT)
    duo_greedy = play(2, [(('A', -1), ('A', -1))] * ROUND_LIMIT)
    check(solo_greedy["result"] == "loss" and solo_greedy["rounds"] == 3, "solo all-attack loses")
    check(duo_greedy["result"] == "loss" and duo_greedy["rounds"] == 7, "duo all-attack loses")
    cautious = []
    cooperative = []
    for round_no in range(1, ROUND_LIMIT + 1):
        focus = ((round_no - 1) // 4) % 2
        cautious.append((('G', 0), ('G', 1)) if round_no % 4 == 3 else (('A', -1), ('A', -1)))
        cooperative.append(tuple(('A', -1) if actor == focus else ('G', focus) for actor in range(2))
                           if round_no % 4 == 3 else (('A', -1), ('A', -1)))
    duo_safe = play(2, cautious)
    duo_team = play(2, cooperative)
    check(duo_safe["result"] == "win" and duo_safe["rounds"] == 8, "duo cautious route")
    check(duo_team["result"] == "win" and duo_team["rounds"] == 6 and all(duo_team["hp"]), "duo covering teammate route")
    support = [(('A', -1), ('A', -1)), (('A', -1), ('H', 0)),
               (('A', -1), ('A', -1)), (('A', -1), ('H', 0))]
    support += [(('A', -1), ('A', -1))] * 2 + [(('G', 1), ('A', -1)), (('A', -1), ('A', -1))]
    duo_rescue = play(2, support)
    check(duo_rescue["result"] == "win" and all(duo_rescue["hp"]) and duo_rescue["pots"] == (2, 0), "ally heal rescues injured teammate")
    check(resolve(initial(1), (('H', 0),), 1) is None, "cannot heal full hp")
    check(resolve(initial(1), (('G', 1),), 1) is None, "cannot target nonmember")
    no_pots = State((10,), BOSS_HP, (0,))
    check(resolve(no_pots, (('H', 0),), 1) is None, "cannot use exhausted recovery")
    check(play(1, [(('G', 0),)] * ROUND_LIMIT)["result"] == "loss", "defending forever loses at round limit")
    at_half = intent(State((40,), 65, (2,)), 3)
    check(at_half["phase"] == 2 and at_half["damage"] == 28, "half-hp phase threshold")
    before_half = resolve(State((40,), 70, (2,)), (('A', -1),), 1)
    check(before_half.hp == (32,), "damage follows pre-announced phase")

    check(initial(1).pots == (3,) and initial(2).pots == (2, 2), 'mode-specific recovery budget')
    baseline_search = enumerate_solo(BASELINE)
    check(baseline_search == {'winning_sequences': 18, 'earliest_win_round': 15,
                              'best_surviving_hp': 10}, 'reviewed baseline retained')
    baseline_human = heuristic(BASELINE)
    candidate_human = heuristic(CANDIDATE)
    check(baseline_human['result'] == 'loss' and baseline_human['rounds'] == 14
          and baseline_human['boss'] == 10, 'baseline reasonable policy fails')
    check(candidate_human['result'] == 'win' and candidate_human['rounds'] == 16
          and candidate_human['hp'] == (14,) and candidate_human['pots'] == (0,), 'candidate reasonable policy wins')
    for rules, expected in [(BASELINE, 'loss'), (CANDIDATE, 'win')]:
        check(heuristic(rules, 24)['result'] == expected, 'heal-threshold 24 cross-check')
    baseline_changes = one_step_changes('AAGAAHGAAGGAHAGA', BASELINE)
    candidate_changes = one_step_changes('AAGAAHGAAGGAHAGA', CANDIDATE)
    check(baseline_changes == {'win': 0, 'loss': 19, 'invalid': 13, 'active': 0}, 'baseline mutation outcomes distinguished')
    check(candidate_changes == {'win': 1, 'loss': 30, 'invalid': 1, 'active': 0}, 'candidate still has narrow mutation tolerance')

    duo_changes = {'win': 0, 'loss': 0, 'invalid': 0, 'active': 0}
    cover_route = cooperative[:duo_team['rounds']]
    for round_index, row in enumerate(cover_route):
        for actor, action in enumerate(row):
            mutated = list(cover_route)
            changed = list(row)
            changed[actor] = ('G', actor) if action[0] == 'A' else ('A', -1)
            mutated[round_index] = tuple(changed)
            result = play(2, mutated)
            # 若六轮未结束，继续原掩护策略到上限；不能把“仍在战斗”写成战败。
            if result['result'] == 'active':
                result = play(2, mutated + cooperative[len(mutated):])
            duo_changes[result['result']] += 1
    check(sum(duo_changes.values()) == 12, 'duo mutation sample size')
    check(duo_changes == {'win': 11, 'loss': 1, 'invalid': 0, 'active': 0}, 'duo mutation outcomes reproduced')

    variants = [
        ('baseline_2_potions', BASELINE, 18),
        ('candidate_solo3', CANDIDATE, 43),
        ('rounds18_only', replace(BASELINE, round_limit=18), 635),
        ('boss120_only', replace(BASELINE, boss_hp=120), 173),
        ('heal32_only', replace(BASELINE, heal=32), 22),
        ('solo3_rounds18', replace(CANDIDATE, round_limit=18), 2959),
    ]
    comparison = []
    for name, rules, expected_count in variants:
        search = baseline_search if rules == BASELINE else (solo_count if rules == CANDIDATE else enumerate_solo(rules))
        check(search['winning_sequences'] == expected_count, name + ' exact count')
        human = heuristic(rules)
        team = play(2, cooperative, rules)
        check(team['result'] == 'win' and team['rounds'] == 6 and team['hp'] == (19, 22), name + ' duo route preserved')
        comparison.append({'name': name, 'rules': asdict(rules), 'solo_search': search,
                           'heuristic': {k: v for k, v in human.items() if k != 'trace'},
                           'duo_cover': {k: v for k, v in team.items() if k != 'trace'}})

    def compact(result):
        return {key: value for key, value in result.items() if key != "trace"}

    report = {"status": "PASS", "checks": checks,
                      "scope": "offline planning model; not gameplay or Discuz acceptance",
                      "rules_status": "P1 candidate; final difficulty not user-confirmed",
                      "rules": asdict(CANDIDATE),
                      "solo_search": solo_count,
                      "reasonable_policy": compact(candidate_human),
                      "baseline_reasonable_policy": compact(baseline_human),
                      "fixed_suffix_mutations": {'baseline': baseline_changes, 'candidate': candidate_changes},
                      "duo_attack_guard_mutations": duo_changes,
                      "variants": comparison,
                      "solo_survival": compact(solo), "solo_fast": compact(solo_fast),
                      "duo_cover": compact(duo_team), "duo_cautious": compact(duo_safe),
                      "duo_rescue": compact(duo_rescue),
                      "solo_all_attack": compact(solo_greedy), "duo_all_attack": compact(duo_greedy)}
    if args.trace:
        report['reference_traces'] = {
            name: {'rules': asdict(rules), 'run': result}
            for name, rules, result in [
                ('solo_survival', CANDIDATE, solo), ('solo_fast', CANDIDATE, solo_fast),
                ('solo_reasonable', CANDIDATE, candidate_human),
                ('baseline_reasonable', BASELINE, baseline_human),
                ('duo_cover', CANDIDATE, duo_team), ('duo_cautious', CANDIDATE, duo_safe),
                ('duo_rescue', CANDIDATE, duo_rescue)]}
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
