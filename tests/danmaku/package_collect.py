"""(C) 2026 Carinoasd. Power and score pickup delivery: 小典 / Codex."""
import json
import re
import subprocess
import package_weapons as P
import package_preview
ROOT=P.ROOT;SOURCE=P.SOURCE;OUTPUT=P.OUTPUT;BASE='7e578ede16a47ab3ab13f0c8724a3201d2ab6b9d'
def main():
    git=['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897']
    def previous(path):return subprocess.check_output(git+['show',BASE+':'+path.relative_to(ROOT).as_posix()],cwd=ROOT)
    rules=json.loads((SOURCE/'rules.json').read_text(encoding='utf-8'));old=json.loads(previous(SOURCE/'rules.json'));assert {k:v for k,v in rules.items() if k!='collect08'}==old
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==package_preview.bundled_rules()
    allowed={'index.html','stage.js','stage.php','stage-view.js','weapons.js','ui.js','rules.json','rules-data.js'}
    protected=[p for p in SOURCE.rglob('*') if p.is_file() and p.name not in allowed]
    for p in protected:
        before=previous(p);now=p.read_bytes();assert before==now if p.suffix=='.png' else before.replace(b'\r\n',b'\n')==now.replace(b'\r\n',b'\n'),p
    weapons=(SOURCE/'weapons.js').read_text(encoding='utf-8');before=previous(SOURCE/'weapons.js').decode('utf-8').replace('\r\n','\n');assert weapons.split(' function drawShot')[0]==before.split(' function drawShot')[0]
    html=(SOURCE/'index.html').read_text(encoding='utf-8');js=(SOURCE/'ui.js').read_text(encoding='utf-8');ids=re.findall(r'\bid="([^"]+)"',html)
    assert len(ids)==len(set(ids));assert not set(re.findall(r"\$\('([^']+)'\)",js))-set(ids)
    assert 'class="title-hero" src="assets/player-title-portrait-v2.png"' in html
    data=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8');assert P.verify_html(data)==21
    review=P.review_html(ROOT/'docs/danmaku/review/COLLECT-v1.html');assert P.verify_html(review)==10
    assert P.sha((OUTPUT/'danmaku-stage01-weapons-v3-offline.html').read_bytes())=='872ce4e65ed873270f32b089433e91887dff76bc5fe54f7f415100c0d02b6904'
    targets=[('danmaku-stage01-collect-v1-offline.html',data),('danmaku-collect-v1-review.html',review)]
    for name,payload in targets:P.fixed_write(OUTPUT/name,payload)
    files={p.relative_to(SOURCE).as_posix():{'bytes':p.stat().st_size,'sha256':P.sha(p.read_bytes())} for p in SOURCE.rglob('*') if p.is_file()}
    manifest={'candidate':'collect-v1','baseCommit':BASE,'rules':{'easy':rules['collect08']['easyRule'],'normal':rules['collect08']['normalRule']},'preludePower':26,'scoreCrystals':{'count':20,'value':500,'scoreOnPickup':True},'scoreUpperBound':rules['collect08']['scoreUpperBound'],'dropCap':48,'focusedSideAppearance':'restored v2 green diamond and velocity trail','homingAppearance':'short v3 diamond without trail','titleAndAllImagesUnchanged':True,'runtimeFiles':files,'outputs':[{'file':name,'bytes':len(payload),'sha256':P.sha(payload)} for name,payload in targets],'previousCandidatesUnchanged':True,'naturalClearRun':False,'forumInstalled':False,'balancePlaytest':'pending'}
    P.fixed_write(OUTPUT/'danmaku-stage01-collect-v1-MANIFEST.json',(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({'status':'PASS','outputs':manifest['outputs'],'runtimeFiles':len(files),'protectedFiles':len(protected),'scripts':21,'reviewScripts':10,'domIds':len(ids),'previousCandidateUnchanged':True}))
if __name__=='__main__':main()
