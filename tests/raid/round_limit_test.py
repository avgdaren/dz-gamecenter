#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。模式上限和不伪造B达标的回归。"""
from pathlib import Path
import sys,unittest,json
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'docs/raid'))
from balance_check import CURRENT,V2,CANDIDATE,initial,resolve,State
from balance_grid import GridRules,outcome
from balance_round_limit import compare


class RoundLimits(unittest.TestCase):
    def test_immutable_version_caps_and_numbers(self):
        self.assertEqual((CURRENT.limit(1),CURRENT.limit(2)),(18,16))
        self.assertEqual((V2.limit(1),V2.limit(2),CANDIDATE.limit(1)),(16,16,16))
        self.assertEqual((CURRENT.solo_boss_hp,CURRENT.solo_potions,CURRENT.boss_hp,CURRENT.heal),(110,4,150,28))

    def test_16_is_active_only_for_new_solo(self):
        rule=GridRules(round_limit=18,duo_round_limit=16)
        self.assertEqual(outcome(State((40,),1,(0,)),16,rule),'active')
        self.assertEqual(outcome(State((40,40),1,(0,0)),16,rule),'loss')
        self.assertEqual(outcome(State((40,),1,(0,)),18,rule),'loss')
        self.assertEqual(outcome(State((40,),0,(0,)),18,rule),'win')

    def test_action_bounds_respect_mode(self):
        self.assertIsNotNone(resolve(initial(1,CURRENT),(('G',0),),17,CURRENT))
        with self.assertRaises(AssertionError):resolve(initial(2,CURRENT),(('G',0),('G',1)),17,CURRENT)
        with self.assertRaises(AssertionError):resolve(initial(1,CURRENT),(('G',0),),19,CURRENT)

    def test_full_comparison_must_not_round_b_into_pass(self):
        report=compare()
        choices={r['label']:r for r in report['comparisons']}
        self.assertEqual(choices['v2']['mistakes']['0.8']['win_rate'],60.1)
        self.assertEqual(choices['B']['mistakes']['0.8']['win_rate'],65.7)
        self.assertFalse(choices['B']['qualified'])
        self.assertEqual(report['status'],'NO_FULL_MATCH')
        self.assertEqual(report['selected']['label'],'A')
        self.assertFalse(report['selected']['qualified'])
        self.assertTrue(report['selected']['applied_to_source'])
        self.assertEqual(report['duo_unchanged']['heuristic']['rounds'],8)
        self.assertEqual(report['duo_unchanged']['heuristic']['hp'],(9,6))

    def test_fixture_records_cap(self):
        f=json.loads((Path(__file__).resolve().parents[2]/'docs/raid/P1-REFERENCE.json').read_text())
        self.assertEqual(f['rules']['version'],CURRENT.version)
        for case in f['cases'].values():self.assertEqual(case['initial']['round_limit'],18 if case['mode']=='solo' else 16)


if __name__=='__main__':unittest.main()
