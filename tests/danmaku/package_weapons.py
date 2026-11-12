"""(C) 2026 Carinoasd. Wide title and projectile weapons delivery: 小典 / Codex."""
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import package_preview

ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'source/plugin/gamecenter/games/_danmaku_proto';OUTPUT=ROOT.parent/'output'
BASE='b88717874b0690d4ed821d8dffd662fdb25e5887'
def sha(data):return hashlib.sha256(data).hexdigest()
def fixed_write(path,data):
    if path.exists():assert path.read_bytes()==data,'Refusing changed candidate overwrite: '+path.name
    else:path.write_bytes(data)
def review_html():
    html=(ROOT/'docs/danmaku/review/WEAPONS-v1.html').read_text(encoding='utf-8')
    html=re.sub(r'<base href="[^"]+">','',html)
    names=re.findall(r'<script defer src="([^"]+)"></script>',html)
    html=re.sub(r'<script defer src="[^"]+"></script>','',html)
    scripts=[]
    for name in names:
        source=(SOURCE/name).read_text(encoding='utf-8')
        scripts.append('<script>\n'+re.sub(r'</script',r'<\\/script',source,flags=re.I)+'\n</script>')
    html=html.replace('</body>','\n'.join(scripts)+'\n</body>')
    for name in set(re.findall(r'assets/([\w-]+\.png)',html)):
        html=html.replace('assets/'+name,'data:image/png;base64,'+base64.b64encode((SOURCE/'assets'/name).read_bytes()).decode('ascii'))
    assert 'assets/' not in html
    return html.encode('utf-8')
def verify_html(data):
    class References(HTMLParser):
        def handle_starttag(self,tag,attrs):
            for key,value in attrs:
                if key in ['src','href'] and value:assert value.startswith(('data:','#')),value
    text=data.decode('utf-8');References().feed(text)
    scripts=re.findall(r'<script>\s*(.*?)\s*</script>',text,re.S)
    subprocess.run(['node','-e',"const vm=require('node:vm'),fs=require('node:fs');for(const s of JSON.parse(fs.readFileSync(0,'utf8')))new vm.Script(s);"],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    return len(scripts)
def main():
    git=['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897']
    rules=json.loads((SOURCE/'rules.json').read_text(encoding='utf-8'))
    old=json.loads(subprocess.check_output(git+['show',BASE+':'+(SOURCE/'rules.json').relative_to(ROOT).as_posix()],cwd=ROOT))
    assert {k:v for k,v in rules.items() if k!='weapons06'}==old
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==package_preview.bundled_rules()
    protected=[p for p in SOURCE.rglob('*') if p.is_file() and (p.suffix=='.png' or p.name in ['engine.js','engine.php','battle.js','battle.php','boss-patterns.js','boss-patterns.php','audio.js','audio-bank.js','bgm-bank.js','midi.js','midi-bank.js','player-view.js','boss-view.js','stage-art-view.js','controls.js','replay.js','battle-replay.js','stage-replay.js'])]
    for p in protected:
        previous=subprocess.check_output(git+['show',BASE+':'+p.relative_to(ROOT).as_posix()],cwd=ROOT);current=p.read_bytes()
        assert previous==current if p.suffix=='.png' else previous.replace(b'\r\n',b'\n')==current.replace(b'\r\n',b'\n'),p
    html_source=(SOURCE/'index.html').read_text(encoding='utf-8');js=(SOURCE/'ui.js').read_text(encoding='utf-8')
    ids=re.findall(r'\bid="([^"]+)"',html_source);assert len(ids)==len(set(ids))
    refs=set(re.findall(r"\$\('([^']+)'\)",js));assert not refs-set(ids),refs-set(ids)
    assert all(v not in html_source for v in ['<select','第一关','针雨夹击','移动星门','phase-cue'])
    assert len(re.findall('data-difficulty=',html_source))==2
    data=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8');scripts=verify_html(data);assert scripts==21
    review=review_html();review_scripts=verify_html(review);assert review_scripts==11
    accepted={'danmaku-stage01-title-power-v1-offline.html':'d6971aa09061cc36c68768dfb680b36a9c178fd3c748fa377ec0b3739485f78e',
              'danmaku-stage01-normal-v2-offline.html':'22bf865188f20d33fc4d958399eb1b25512d9b8a90028d88d1af0dbeb1192676'}
    for name,digest in accepted.items():assert sha((OUTPUT/name).read_bytes())==digest,name
    html=OUTPUT/'danmaku-stage01-weapons-v1-offline.html';review_file=OUTPUT/'danmaku-weapons-v1-review.html'
    fixed_write(html,data);fixed_write(review_file,review)
    files={p.relative_to(SOURCE).as_posix():{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in SOURCE.rglob('*') if p.is_file()}
    manifest={'candidate':'weapons-v1','baseCommit':BASE,'rules':{'easy':rules['weapons06']['easyRule'],'normal':rules['weapons06']['normalRule']},
      'focusedWeapon':'three parallel fast projectiles, swept collisions, no hitscan beam','focusedFullHitDps':{'4':300,'5':420},'focusConfig':rules['weapons06']['focused'],
      'level5Fast':'7 straight + 4 tracking projectiles','bossTransitions':'both cyan explosion 1 + 24-tick shake + 10-tick single flash; reduced disables shake/flash',
      'title':'wide illustration with direct Easy/Normal buttons','normalAttackTablesUnchanged':True,'respawnBombsRetained':True,'legacyReplaysRetained':True,'imagesAndAudioUnchanged':True,
      'runtimeFiles':files,'standalone':{'file':html.name,'bytes':len(data),'sha256':sha(data)},'isolatedReview':{'file':review_file.name,'bytes':len(review),'sha256':sha(review)},
      'forumInstalled':False,'naturalClearRun':False,'newWeaponBalance':'awaiting-user-playtest'}
    fixed_write(OUTPUT/'danmaku-stage01-weapons-v1-MANIFEST.json',(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({'status':'PASS','file':html.name,'bytes':len(data),'sha256':sha(data),'reviewBytes':len(review),'reviewSha256':sha(review),'runtimeFiles':len(files),'protectedFiles':len(protected),'classicScripts':scripts,'reviewScripts':review_scripts,'domIds':len(ids),'previousCandidatesUnchanged':True}))
if __name__=='__main__':main()
