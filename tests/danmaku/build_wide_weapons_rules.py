"""(C) 2026 Carinoasd. Focused straight side fire revision: 小典 / Codex."""
import json
from pathlib import Path
def main():
    p=Path(__file__).resolve().parents[2]/'source/plugin/gamecenter/games/_danmaku_proto/rules.json'
    r=json.loads(p.read_text(encoding='utf-8'))
    r['weapons07']={'easyRule':'danmaku-stage01-r7','normalRule':'danmaku-stage01-normal-r5',
      'sideShots':{'minimumLevel':4,'offsets':[-36,-18,18,36],'interval':6,'speedQ':576,'damage':1}}
    p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Appended weapons07; prior weapon tables unchanged')
if __name__=='__main__':main()
