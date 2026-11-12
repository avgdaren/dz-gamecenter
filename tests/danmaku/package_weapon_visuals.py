"""(C) 2026 Carinoasd. Short projectile and star-wand visual delivery: 小典 / Codex."""
import json
import re
import subprocess
import package_weapons as P
import package_preview
ROOT=P.ROOT;SOURCE=P.SOURCE;OUTPUT=P.OUTPUT;BASE='748db98e1dcb9038fc847ae63f07e36c21989653'
def main():
    git=['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897']
    def previous(path):return subprocess.check_output(git+['show',BASE+':'+path.relative_to(ROOT).as_posix()],cwd=ROOT)
    rules=json.loads((SOURCE/'rules.json').read_text(encoding='utf-8'));assert rules==json.loads(previous(SOURCE/'rules.json'))
    protected=[p for p in SOURCE.rglob('*') if p.is_file() and p.name not in ['index.html','weapons.js','player-title-portrait-v2.png']]
    for p in protected:
        old=previous(p);now=p.read_bytes();assert old==now if p.suffix=='.png' else old.replace(b'\r\n',b'\n')==now.replace(b'\r\n',b'\n'),p
    before=previous(SOURCE/'weapons.js').decode('utf-8').replace('\r\n','\n');after=(SOURCE/'weapons.js').read_text(encoding='utf-8')
    assert before.split(' function drawShot')[0]==after.split(' function drawShot')[0], 'Tracking logic changed'
    assert '-s.vx/Q*5' not in after and 'ctx.moveTo(0,-5)' in after
    html=(SOURCE/'index.html').read_text(encoding='utf-8');js=(SOURCE/'ui.js').read_text(encoding='utf-8');ids=re.findall(r'\bid="([^"]+)"',html)
    assert len(ids)==len(set(ids));assert not set(re.findall(r"\$\('([^']+)'\)",js))-set(ids)
    assert 'class="title-hero" src="assets/player-title-portrait-v2.png"' in html
    data=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8');assert P.verify_html(data)==21
    review=P.review_html(ROOT/'docs/danmaku/review/WEAPONS-v2.html');assert P.verify_html(review)==11
    assert P.sha((OUTPUT/'danmaku-stage01-weapons-v2-offline.html').read_bytes())=='1b0b374c8dce79d1028494886d94e5ed1cc2c68c445c343c53ca9c017df78692'
    assert P.sha((OUTPUT/'danmaku-weapons-v2-review.html').read_bytes())=='17cedbbe862b0608ef03b6ffba560e0bd06aff6ca035c0f34b203ab9c65f0e25'
    targets=[('danmaku-stage01-weapons-v3-offline.html',data),('danmaku-weapons-v3-review.html',review)]
    for name,payload in targets:P.fixed_write(OUTPUT/name,payload)
    files={p.relative_to(SOURCE).as_posix():{'bytes':p.stat().st_size,'sha256':P.sha(p.read_bytes())} for p in SOURCE.rglob('*') if p.is_file()}
    manifest={'candidate':'weapons-v3','baseCommit':BASE,'presentationOnly':True,'rules':{'easy':rules['weapons07']['easyRule'],'normal':rules['weapons07']['normalRule']},'rulesAndSimulationUnchanged':True,'trackingLogicUnchanged':True,'greenBulletAppearance':'9px diamond, 10px soft halo, no velocity trail','focusPacketsUnchanged':True,'weapon':'blue-gold star wand, cyan crystal projectile emitter','protagonistPortrait':'assets/player-title-portrait-v2.png','runtimeFiles':files,'outputs':[{'file':name,'bytes':len(payload),'sha256':P.sha(payload)} for name,payload in targets],'previousCandidatesUnchanged':True,'naturalClearRun':False,'forumInstalled':False,'userVisualReview':'pending'}
    P.fixed_write(OUTPUT/'danmaku-stage01-weapons-v3-MANIFEST.json',(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({'status':'PASS','outputs':manifest['outputs'],'runtimeFiles':len(files),'protectedFiles':len(protected),'scripts':21,'reviewScripts':11,'domIds':len(ids),'rulesAndSimulationUnchanged':True,'previousCandidatesUnchanged':True}))
if __name__=='__main__':main()
