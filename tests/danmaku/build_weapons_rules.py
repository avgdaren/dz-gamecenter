"""(C) 2026 Carinoasd. Laser/homing rule revision: 小典 / Codex."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
 p=ROOT/'source/plugin/gamecenter/games/_danmaku_proto/rules.json';r=json.loads(p.read_text(encoding='utf-8'))
 r['weapons06']={'easyRule':'danmaku-stage01-r6','normalRule':'danmaku-stage01-normal-r4',
  'tracking':{'level':5,'lanes':[0,1,9,10],'speedQ':576,'turnStepQ':64},
  'focused':{'4':{'interval':4,'speedQ':1152,'length':28,'lanes':[{'offsetX':-3,'damage':3},{'offsetX':0,'damage':14},{'offsetX':3,'damage':3}]},
             '5':{'interval':2,'speedQ':1536,'length':36,'lanes':[{'offsetX':-3,'damage':2},{'offsetX':0,'damage':10},{'offsetX':3,'damage':2}]}}}
 p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n');print('Appended weapons06; all earlier rule tables retained')
if __name__=='__main__':main()
