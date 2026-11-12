"""(C) 2026 Carinoasd. Append isolated Normal rule tables: 小典 / Codex."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def main():
    path=ROOT/'source/plugin/gamecenter/games/_danmaku_proto/rules.json'
    rules=json.loads(path.read_text(encoding='utf-8'))
    config=json.loads((ROOT/'docs/danmaku/NORMAL-v1-design.json').read_text(encoding='utf-8'))
    rules['normal01']=config
    spec=json.loads((ROOT/'docs/danmaku/NORMAL-v2-design.json').read_text(encoding='utf-8'))
    rules['normal02']={**spec,'types':json.loads(json.dumps(config['types']))}
    path.write_text(json.dumps(rules,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Normal tables updated; all older rule values retained')
if __name__=='__main__':main()
