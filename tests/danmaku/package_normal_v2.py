"""(C) 2026 Carinoasd. Boss v2 + global respawn candidate: 小典 / Codex."""
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
    assert {k:v for k,v in rules.items() if k not in ['normal01','normal02']}==old
    assert rules['normal01']==json.loads((ROOT/'docs/danmaku/NORMAL-v1-design.json').read_text(encoding='utf-8'))
    design=json.loads((ROOT/'docs/danmaku/NORMAL-v2-design.json').read_text(encoding='utf-8'))
    assert rules['normal02']=={**design,'types':rules['normal01']['types']}
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==package_preview.bundled_rules()
    git=['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897']
    protected=[p for p in SOURCE.rglob('*') if p.is_file() and (p.suffix=='.png' or p.name in ['audio.js','audio-bank.js','bgm-bank.js','midi.js','midi-bank.js','player-view.js','boss-view.js','stage-show.js','stage-art-view.js','stage-view.js','replay.js','battle-replay.js','stage-replay.js'])]
    for p in protected:
        previous=subprocess.check_output(git+['show',BASE+':'+p.relative_to(ROOT).as_posix()],cwd=ROOT);current=p.read_bytes()
        assert previous==current if p.suffix=='.png' else previous.replace(b'\r\n',b'\n')==current.replace(b'\r\n',b'\n'),p
    data=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8')
    html=OUTPUT/'danmaku-stage01-normal-v2-offline.html'
    if html.exists():assert html.read_bytes()==data,'Refusing changed candidate overwrite; use a new version'
    else:html.write_bytes(data)
    for name,expected in [('danmaku-stage01-boss-r3-offline.html','b2b4dbbbdab14d19895083338634f28ea476735f3692b8ffc3e0e80df4296664'),('danmaku-stage01-normal-v1-offline.html','f883d8c968150a5172556ad96e699b310a6019bfd326040cf64d58a7aadf3c0e')]:
        if (OUTPUT/name).exists():assert sha((OUTPUT/name).read_bytes())==expected
    scripts=re.findall(r'<script>\n(.*?)\n</script>',data.decode('utf-8'),re.S)
    subprocess.run(['node','-e',"const vm=require('node:vm'),fs=require('node:fs');for(const s of JSON.parse(fs.readFileSync(0,'utf8')))new vm.Script(s);"],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    files={p.relative_to(SOURCE).as_posix():{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in SOURCE.rglob('*') if p.is_file()}
    manifest={'candidate':'normal-v2','normalRule':rules['normal02']['stageRule'],'easyRule':'danmaku-stage01-r4','practiceRules':['danmaku-p1-r4',rules['normal02']['practiceRule'],'danmaku-p0-r3'],
      'respawnBombs':{'standard':2,'assist':3,'onlyIfLivesRemain':True,'allCurrentModes':True,'legacyReplaysRetained':True},
      'normalPreludeSameAsV1':True,'imagesAndAudioUnchanged':True,'classicScripts':len(scripts),'runtimeFiles':files,
      'standalone':{'file':html.name,'bytes':len(data),'sha256':sha(data)},'forumInstalled':False,'naturalClearRun':False,'bossBalanceAcceptance':'awaiting-user-playtest'}
    target=OUTPUT/'danmaku-stage01-normal-v2-MANIFEST.json';payload=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    if target.exists():assert target.read_bytes()==payload,'Refusing changed manifest overwrite'
    else:target.write_bytes(payload)
    print(json.dumps({'status':'PASS','file':html.name,'bytes':len(data),'sha256':sha(data),'runtimeFiles':len(files),'protectedFiles':len(protected),'classicScripts':len(scripts),'olderCandidatesUnchanged':True,'forumInstalled':False}))
if __name__=='__main__':main()
