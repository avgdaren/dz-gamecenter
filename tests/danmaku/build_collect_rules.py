"""(C) 2026 Carinoasd. Versioned prelude power/score pickups: 小典 / Codex."""
import json
from pathlib import Path
def main():
    p=Path(__file__).resolve().parents[2]/'source/plugin/gamecenter/games/_danmaku_proto/rules.json'
    r=json.loads(p.read_text(encoding='utf-8'));schedule=r['stage01']['schedule'];extra=[2,6,12,18,23,27,33,38]
    assert all(next(m for m in schedule if m['id']==i)['reward']==0 for i in extra)
    power=sum(m['reward'] for m in schedule)+len(extra);points=sum(m['reward']==0 and m['id'] not in extra for m in schedule)
    assert (power,points)==(26,20)
    r['collect08']={'easyRule':'danmaku-stage01-r8','normalRule':'danmaku-stage01-normal-r6','extraPowerIds':extra,'extraPowerValue':1,
       'pointValue':500,'dropCap':48,'powerTotal':power,'pointItems':points,
       'scoreUpperBound':r['stage01']['bombScoreUpperBound']+len(extra)*r['stage01']['growth']['overflowPerUnit']+points*500}
    p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Appended collect08: 26 P, 20 score crystals; previous tables unchanged')
if __name__=='__main__':main()
