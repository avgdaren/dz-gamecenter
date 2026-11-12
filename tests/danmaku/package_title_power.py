"""(C) 2026 Carinoasd. Title/HUD/five-power standalone: 小典 / Codex."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import package_preview
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'source/plugin/gamecenter/games/_danmaku_proto';OUTPUT=ROOT.parent/'output'
BASE='1d1bbb88600ff956314ba04245220eabe529438a'
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    git=['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897']
    rules=json.loads((SOURCE/'rules.json').read_text(encoding='utf-8'))
    old=json.loads(subprocess.check_output(git+['show',BASE+':'+(SOURCE/'rules.json').relative_to(ROOT).as_posix()],cwd=ROOT))
    assert {k:v for k,v in rules.items() if k!='power05'}==old
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==package_preview.bundled_rules()
    protected=[p for p in SOURCE.rglob('*') if p.is_file() and (p.suffix=='.png' or p.name in ['engine.js','engine.php','battle.js','battle.php','boss-patterns.js','boss-patterns.php','audio.js','audio-bank.js','bgm-bank.js','midi.js','midi-bank.js','player-view.js','boss-view.js','stage-show.js','stage-art-view.js','replay.js','battle-replay.js','stage-replay.js'])]
    for p in protected:
        previous=subprocess.check_output(git+['show',BASE+':'+p.relative_to(ROOT).as_posix()],cwd=ROOT);current=p.read_bytes()
        assert previous==current if p.suffix=='.png' else previous.replace(b'\r\n',b'\n')==current.replace(b'\r\n',b'\n'),p
    html_source=(SOURCE/'index.html').read_text(encoding='utf-8');js=(SOURCE/'ui.js').read_text(encoding='utf-8')
    ids=re.findall(r'\bid="([^"]+)"',html_source);assert len(ids)==len(set(ids))
    refs=set(re.findall(r"\$\('([^']+)'\)",js));assert not refs-set(ids),refs-set(ids)
    assert not any(v in html_source for v in ['practice-settings','record-panel','data-scene'])
    assert html_source.index('id="title-options"')<html_source.index('id="difficulty"')<html_source.index('id="result-summary"')
    data=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8')
    scripts=re.findall(r'<script>\n(.*?)\n</script>',data.decode('utf-8'),re.S);assert len(scripts)==20
    subprocess.run(['node','-e',"const vm=require('node:vm'),fs=require('node:fs');for(const s of JSON.parse(fs.readFileSync(0,'utf8')))new vm.Script(s);"],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    class References(HTMLParser):
        def handle_starttag(self,tag,attrs):
            for key,value in attrs:
                if key in ['src','href'] and value:assert value.startswith(('data:','#')),value
    References().feed(data.decode('utf-8'))
    previous_demo=OUTPUT/'danmaku-stage01-normal-v2-offline.html'
    if previous_demo.exists():assert sha(previous_demo.read_bytes())=='22bf865188f20d33fc4d958399eb1b25512d9b8a90028d88d1af0dbeb1192676'
    html=OUTPUT/'danmaku-stage01-title-power-v1-offline.html'
    if html.exists():assert html.read_bytes()==data,'Refusing changed candidate overwrite'
    else:html.write_bytes(data)
    files={p.relative_to(SOURCE).as_posix():{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in SOURCE.rglob('*') if p.is_file()}
    manifest={'candidate':'title-power-v1','baseCommit':BASE,'rules':{'easy':rules['power05']['easyRule'],'normal':rules['power05']['normalRule']},
      'titleDifficultySelection':True,'publicMode':'full-stage-only','focusBinding':{'default':'Shift','storageKey':'danmaku.controls.v1','gameplayReplayIndependent':True},
      'powerThresholds':rules['power05']['thresholds'],'inFieldHud':['lives','power','bombs'],'normalAttackTablesUnchanged':True,
      'respawnBombsRetained':True,'legacyReplaysRetained':True,'imagesAndAudioUnchanged':True,'runtimeFiles':files,
      'standalone':{'file':html.name,'bytes':len(data),'sha256':sha(data)},'forumInstalled':False,'naturalClearRun':False,'newWeaponBalance':'awaiting-user-playtest'}
    target=OUTPUT/'danmaku-stage01-title-power-v1-MANIFEST.json';payload=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    if target.exists():assert target.read_bytes()==payload,'Refusing changed manifest overwrite'
    else:target.write_bytes(payload)
    print(json.dumps({'status':'PASS','file':html.name,'bytes':len(data),'sha256':sha(data),'runtimeFiles':len(files),'protectedFiles':len(protected),'classicScripts':len(scripts),'domIds':len(ids),'noExternalDependencies':True,'oldNormalCandidateUnchanged':True}))
if __name__=='__main__':main()
