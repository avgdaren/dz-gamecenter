#!/usr/bin/env python3
"""作者：GPT / Codex。天使讨伐队企划数值演算，非已实现游戏或实机验收。

仅使用 Python 标准库；不访问论坛、数据库或网络。
插件原始代码版权 (C) 2026 Carinoasd，保留其署名。
"""
from dataclasses import dataclass
import json

PLAYER_HP = 40
BOSS_HP = 130
POTIONS = 2
HEAL = 28
ATTACK = 10
EXPOSED_ATTACK = 20
ROUND_LIMIT = 16


@dataclass(frozen=True)
class State:
    hp: tuple
    boss: int
    pots: tuple
    exposed: bool = False


def initial(players):
    assert players in (1, 2)
    return State((PLAYER_HP,) * players, BOSS_HP, (POTIONS,) * players)


def intent(state, round_no):
    """先公布本轮阶段、攻击和目标，再收玩家行动；本轮降血不会改预告。"""
    kind = (round_no - 1) % 4
    phase = 1 if state.boss * 2 > BOSS_HP else 2
    alive = [i for i, hp in enumerate(state.hp) if hp > 0]
    focus = ((round_no - 1) // 4) % len(state.hp)
    if focus not in alive:
        focus = alive[0]
    targets = [focus] if kind in (0, 2) else (alive if kind == 1 else [])
    damage = (24 if phase == 1 else 28) if kind == 2 else (8 if phase == 1 else 10)
    return {"kind": kind, "phase": phase, "targets": targets,
            "damage": damage if kind != 3 else 0}


def resolve(state, actions, round_no):
    """动作为 (A/G/H, target_slot)；攻击 target=-1；倒地者无动作。"""
    assert len(actions) == len(state.hp)
    assert 1 <= round_no <= ROUND_LIMIT and state.boss > 0 and any(state.hp)
    preview = intent(state, round_no)
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
                heals[target] += HEAL
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


def play(players, route):
    state = initial(players)
    trace = []
    for round_no, row in enumerate(route, 1):
        actions = tuple(action if state.hp[i] > 0 else ("-", -1)
                        for i, action in enumerate(row))
        preview = intent(state, round_no)
        state = resolve(state, actions, round_no)
        assert state is not None, (round_no, actions)
        trace.append({"round": round_no, "preview": preview, "actions": actions,
                      "hp": state.hp, "boss": state.boss, "pots": state.pots})
        if state.boss == 0 or not any(state.hp):
            break
    result = "win" if state.boss == 0 else ("loss" if not any(state.hp) or len(trace) == ROUND_LIMIT else "active")
    return {"result": result, "rounds": len(trace), "hp": state.hp,
            "boss": state.boss, "pots": state.pots, "trace": trace}


def solo_row(code):
    return ((code, -1 if code == "A" else 0),)


def enumerate_solo():
    """按相同战斗状态归并，精确统计合法行动序列；不是随机胜率。"""
    states = {initial(1): (1, "")}
    wins = 0
    first_round = None
    surviving_examples = []
    for round_no in range(1, ROUND_LIMIT + 1):
        next_states = {}
        for state, (count, path) in states.items():
            for code in "AGH":
                target = -1 if code == "A" else 0
                after = resolve(state, ((code, target),), round_no)
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
            "best_surviving_hp": max(hp for hp, _ in surviving_examples)}


def main():
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
    check(solo_count == {"winning_sequences": 18, "earliest_win_round": 15, "best_surviving_hp": 10}, "exact solo search")
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

    def compact(result):
        return {key: value for key, value in result.items() if key != "trace"}

    print(json.dumps({"status": "PASS", "checks": checks,
                      "scope": "offline planning model; not gameplay or Discuz acceptance",
                      "solo_search": solo_count,
                      "solo_survival": compact(solo), "solo_fast": compact(solo_fast),
                      "duo_cover": compact(duo_team), "duo_cautious": compact(duo_safe),
                      "duo_rescue": compact(duo_rescue),
                      "solo_all_attack": compact(solo_greedy), "duo_all_attack": compact(duo_greedy)},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
