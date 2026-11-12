"""(C) 2026 Carinoasd. Isolated Normal candidate and inventory: 小典 / Codex."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import package_preview
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
OUTPUT=ROOT.parent/'output'
BASE='50b6d415155d8d3140a8e6066dbc7d31e990a0ae'
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    rules=json.loads((SOURCE/'rules.json').read_text(encoding='utf-8'))
    old=json.loads((ROOT/'tests/danmaku/fixtures/legacy-stage01-r3/rules.json').read_text(encoding='utf-8'))
    assert {k:v for k,v in rules.items() if k!='normal01'}==old
    assert rules['normal01']==json.loads((ROOT/'docs/danmaku/NORMAL-v1-design.json').read_text(encoding='utf-8'))
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==package_preview.bundled_rules()
    git=['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897']
    protected=[p for p in SOURCE.rglob('*') if p.is_file() and (p.suffix=='.png' or p.name in ['engine.js','engine.php','audio.js','audio-bank.js','bgm-bank.js','midi.js','midi-bank.js','player-view.js','boss-view.js','stage-show.js','stage-art-view.js','stage-view.js','replay.js','battle-replay.js','stage-replay.js'])]
    for p in protected:
        previous=subprocess.check_output(git+['show',BASE+':'+p.relative_to(ROOT).as_posix()],cwd=ROOT)
        current=p.read_bytes()
        assert previous==current if p.suffix=='.png' else previous.replace(b'\r\n',b'\n')==current.replace(b'\r\n',b'\n'),p
    data=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8')
    html=OUTPUT/'danmaku-stage01-normal-v1-offline.html'
    if html.exists():assert html.read_bytes()==data,'Refusing to overwrite changed Normal candidate; use a new version'
    else:html.write_bytes(data)
    old_demo=OUTPUT/'danmaku-stage01-boss-r3-offline.html'
    if old_demo.exists():assert sha(old_demo.read_bytes())=='b2b4dbbbdab14d19895083338634f28ea476735f3692b8ffc3e0e80df4296664'
    scripts=re.findall(r'<script>\n(.*?)\n</script>',data.decode('utf-8'),re.S)
    check=ROOT/'tmp/danmaku/normal-v1/check-classic.cjs';check.parent.mkdir(parents=True,exist_ok=True)
    check.write_text("const vm=require('node:vm'),fs=require('node:fs');for(const s of JSON.parse(fs.readFileSync(0,'utf8')))new vm.Script(s);console.log('Classic scripts compiled: '+"+str(len(scripts))+");\n",encoding='utf-8')
    subprocess.run(['node',str(check)],input=json.dumps(scripts),text=True,check=True,capture_output=True)
    files={p.relative_to(SOURCE).as_posix():{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in SOURCE.rglob('*') if p.is_file()}
    manifest={'candidate':'normal-v1','rule':rules['normal01']['stageRule'],'practiceRule':rules['normal01']['practiceRule'],
      'baseCommit':BASE,'defaultDifficulty':'normal','oldRuleValuesUnchanged':True,'imagesAndAudioUnchanged':True,
      'oldR3DemoSha256':'b2b4dbbbdab14d19895083338634f28ea476735f3692b8ffc3e0e80df4296664',
      'classicScripts':len(scripts),'runtimeFiles':files,'standalone':{'file':html.name,'bytes':len(data),'sha256':sha(data)},
      'forumInstalled':False,'naturalClearRun':False,'balanceAcceptance':'awaiting-user-playtest'}
    target=OUTPUT/'danmaku-stage01-normal-v1-MANIFEST.json'
    payload=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    if target.exists():assert target.read_bytes()==payload,'Refusing changed manifest overwrite'
    else:target.write_bytes(payload)
    print(json.dumps({'status':'PASS','html':str(html),'bytes':len(data),'sha256':sha(data),'runtimeFiles':len(files),'protectedFiles':len(protected),'classicScripts':len(scripts),'oldRuleValuesUnchanged':True,'forumInstalled':False}))
if __name__=='__main__':main()
