"""(C) 2026 Carinoasd. Versioned top-corner item attraction: 小典 / Codex."""
import json
from pathlib import Path
def main():
    p=Path(__file__).resolve().parents[2]/'source/plugin/gamecenter/games/_danmaku_proto/rules.json'
    r=json.loads(p.read_text(encoding='utf-8'))
    r['corner09']={'easyRule':'danmaku-stage01-r9','normalRule':'danmaku-stage01-normal-r7','topY':192,'leftX':96,'rightX':384}
    p.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print('Appended corner09; all previous rules unchanged')
if __name__=='__main__':main()
