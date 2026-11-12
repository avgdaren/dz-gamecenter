"""(C) 2026 Carinoasd. Versioned five-level player tables: 小典 / Codex."""
import copy
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
    path=ROOT/'source/plugin/gamecenter/games/_danmaku_proto/rules.json'
    r=json.loads(path.read_text(encoding='utf-8'));levels=copy.deepcopy(r['stage01']['growth']['levels'])
    for weights in [[1,1,2,2,10,2,2,1,1],[1,1,2,2,2,10,2,2,2,1,1]]:
        mid=len(weights)//2
        levels.append({'normal':[{'offsetX':(i-mid)*6,'vxQ':(i-mid)*32,'damage':w} for i,w in enumerate(weights)],
                       'focused':[{'offsetX':(i-mid)*4,'vxQ':0,'damage':w} for i,w in enumerate(weights)]})
    r['power05']={'easyRule':'danmaku-stage01-r5','normalRule':'danmaku-stage01-normal-r3',
                  'thresholds':[0,3,8,12,16],'maxPower':16,'shotCap':192,'levels':levels}
    path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Appended power05; old growth/bullet tables unchanged')
if __name__=='__main__':main()
