#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。离线网格口径/规则一致性回归。"""
import importlib.util
from pathlib import Path
import sys
import unittest
from dataclasses import replace

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'docs/raid'))
from balance_check import CANDIDATE, State, initial, heuristic, enumerate_solo, play, solo_row
from balance_grid import GridRules, outcome, run, evaluate, scan, summarize, score, legal_actions


class GridTests(unittest.TestCase):
    def test_fixture_solo_unchanged(self):
        model, grid = heuristic(CANDIDATE), run(1, GridRules(), 'heuristic')
        self.assertEqual((model['rounds'], model['hp'], model['result']), (grid['rounds'], grid['hp'], grid['result']))
        self.assertEqual((grid['rounds'], grid['hp']), (16, (14,)))

    def test_fixture_duo_unchanged(self):
        self.assertEqual(run(2, GridRules(), 'heuristic'), {'result':'win', 'rounds':6, 'hp':(19,22), 'boss':0})

    def test_search_matches_old_exact_counter(self):
        exact = evaluate(1, GridRules(), 10, 1)['optimal']
        self.assertEqual(exact['winning_sequences'], enumerate_solo()['winning_sequences'])
        self.assertEqual(exact['winning_sequences'], 574)
        w = exact['witness']
        actual = play(1, [solo_row(code) for code in w['route']])
        self.assertEqual((actual['result'], actual['rounds'], actual['hp']), (w['result'], w['rounds'], w['hp']))

    def test_small_search_against_unmerged_brute_force(self):
        rules = GridRules(solo_boss_hp=40, round_limit=4)
        from balance_check import resolve
        def brute(state, n):
            count=0
            for action in legal_actions(state, 0):
                after=resolve(state, (action,), n, rules)
                result=outcome(after, n, rules)
                count += 1 if result in ('win','retreat') else brute(after,n+1) if result=='active' else 0
            return count
        self.assertEqual(evaluate(1, rules, 10, 1)['optimal']['winning_sequences'], brute(initial(1,rules),1))

    def test_strict_retreat_boundary_and_death(self):
        rules=GridRules(round_limit_rule='retreat_below_20pct')
        self.assertEqual(outcome(State((1,),24,(0,)),16,rules),'loss')
        self.assertEqual(outcome(State((1,),23,(0,)),16,rules),'retreat')
        self.assertEqual(outcome(State((1,),23,(0,)),15,rules),'active')
        self.assertEqual(outcome(State((0,),23,(0,)),16,rules),'loss')
        self.assertEqual(outcome(State((1,),23,(0,)),16,GridRules()),'loss')

    def test_no_win_is_not_forced_to_100(self):
        self.assertEqual(evaluate(1,GridRules(round_limit=1),10,1)['optimal']['win_rate'],0)

    def test_no_success_averages_are_null(self):
        stats=summarize([{'result':'loss','rounds':3,'hp':(0,), 'boss':90}])
        self.assertIsNone(stats['avg_rounds'])
        self.assertIsNone(stats['avg_remaining_hp'])
        self.assertEqual(stats['avg_rounds_all'],3)

    def test_retreat_and_kill_not_conflated(self):
        stats=summarize([{'result':r,'rounds':16,'hp':(10,0),'boss':5} for r in ('win','retreat','loss')])
        self.assertEqual(stats['win_rate'],66.666667)
        self.assertEqual(stats['retreat_rate'],33.333333)
        self.assertEqual(stats['avg_remaining_hp'],5)

    def test_seed_repeatable_and_downstream_threshold(self):
        one=evaluate(1,GridRules(),20,19)
        evaluate.cache_clear()
        self.assertEqual(one,evaluate(1,GridRules(),20,19))
        self.assertTrue(all(run(n,GridRules(),p)['result']!='active' for n in (1,2) for p in ('blind','guard','heuristic')))

    def test_full_cartesian_and_no_false_pass(self):
        report=scan(games=5,seed=1)
        self.assertEqual(len(report['grid']),72)
        self.assertEqual(len({tuple(row['params'].values()) for row in report['grid']}),72)
        self.assertEqual(report['status'],'NO_MATCH')
        self.assertFalse(any(row['qualified'] for row in report['grid']))
        self.assertFalse(report['recommended']['applied'])
        self.assertEqual(report['recommended']['weighted_distance'],min(row['weighted_distance'] for row in report['grid']))
        for row in report['grid']:
            for mode in ('solo','duo'):
                self.assertEqual(row['policies'][mode]['random']['samples'],5)
                self.assertIn(row['policies'][mode]['heuristic']['win_rate'],(0,100))

    def test_invalid_game_count(self):
        with self.assertRaises(ValueError):
            scan(games=0)


if __name__ == '__main__':
    unittest.main()
