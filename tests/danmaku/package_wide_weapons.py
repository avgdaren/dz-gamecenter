"""(C) 2026 Carinoasd. Protagonist title and wider focus delivery: 小典 / Codex."""
import json
import re
import subprocess
import package_weapons as P
import package_preview
ROOT=P.ROOT;SOURCE=P.SOURCE;OUTPUT=P.OUTPUT;BASE='8888e4358dc5d01c1c57413942361bb2a63837db'
def main():
    git=['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897']
    def previous(path):return subprocess.check_output(git+['show',BASE+':'+path.relative_to(ROOT).as_posix()],cwd=ROOT)
    rules=json.loads((SOURCE/'rules.json').read_text(encoding='utf-8'));old=json.loads(previous(SOURCE/'rules.json'))
    assert {k:v for k,v in rules.items() if k!='weapons07'}==old
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==package_preview.bundled_rules()
    protected=[p for p in SOURCE.rglob('*') if p.is_file() and (p.suffix=='.png' and p.name!='player-title-portrait-v1.png' or p.name in ['engine.js','engine.php','battle.js','battle.php','boss-patterns.js','boss-patterns.php','weapons.js','weapons.php','controls.js','audio.js','audio-bank.js','bgm-bank.js','midi.js','midi-bank.js','player-view.js','boss-view.js','stage-art-view.js','stage-show.js','stage-view.js','replay.js','battle-replay.js','stage-replay.js'])]
    for p in protected:
        before=previous(p);now=p.read_bytes();assert before==now if p.suffix=='.png' else before.replace(b'\r\n',b'\n')==now.replace(b'\r\n',b'\n'),p
    html=(SOURCE/'index.html').read_text(encoding='utf-8');js=(SOURCE/'ui.js').read_text(encoding='utf-8');ids=re.findall(r'\bid="([^"]+)"',html)
    assert len(ids)==len(set(ids));assert not set(re.findall(r"\$\('([^']+)'\)",js))-set(ids)
    assert 'class="title-hero" src="assets/player-title-portrait-v1.png"' in html and 'class="title-boss"' not in html
    data=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8');assert P.verify_html(data)==21
    review=P.review_html(ROOT/'docs/danmaku/review/WEAPONS-v2.html');assert P.verify_html(review)==11
    assert P.sha((OUTPUT/'danmaku-stage01-weapons-v1-offline.html').read_bytes())=='7d2d6581b0b0b380c2817604f4e7e31619d4dd30d68582f6312820fb56984320'
    assert P.sha((OUTPUT/'danmaku-weapons-v1-review.html').read_bytes())=='cac8b6526475c50c1cb99ddacddf87f46d1a95e8d9fb18e497b651cccac465b4'
    targets=[('danmaku-stage01-weapons-v2-offline.html',data),('danmaku-weapons-v2-review.html',review)]
    for name,payload in targets:P.fixed_write(OUTPUT/name,payload)
    files={p.relative_to(SOURCE).as_posix():{'bytes':p.stat().st_size,'sha256':P.sha(p.read_bytes())} for p in SOURCE.rglob('*') if p.is_file()}
    manifest={'candidate':'weapons-v2','baseCommit':BASE,'rules':{'easy':rules['weapons07']['easyRule'],'normal':rules['weapons07']['normalRule']},'focusedCenterUnchanged':True,'sideShots':rules['weapons07']['sideShots'],'sideShotsTrack':False,'normalEnemyAttacksUnchanged':True,'effectsAndAudioUnchanged':True,'protagonistPortrait':'assets/player-title-portrait-v1.png','runtimeFiles':files,'outputs':[{'file':name,'bytes':len(payload),'sha256':P.sha(payload)} for name,payload in targets],'previousCandidatesUnchanged':True,'naturalClearRun':False,'forumInstalled':False,'userPlaytest':'pending'}
    P.fixed_write(OUTPUT/'danmaku-stage01-weapons-v2-MANIFEST.json',(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
    print(json.dumps({'status':'PASS','outputs':manifest['outputs'],'runtimeFiles':len(files),'protectedFiles':len(protected),'scripts':21,'reviewScripts':11,'domIds':len(ids),'previousCandidatesUnchanged':True}))
if __name__=='__main__':main()
