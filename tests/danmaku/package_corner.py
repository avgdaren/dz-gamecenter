"""(C) 2026 Carinoasd. Final corner collection and GitHub runtime manifest: 小典 / Codex."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import package_weapons as P
import package_preview
ROOT=P.ROOT;SOURCE=P.SOURCE;BASE='75502033f77e0d16a89dd8c49391b8731d4914b9'
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=ROOT.parent/'output');args=parser.parse_args();out=args.output_dir;out.mkdir(parents=True,exist_ok=True)
    git=['git','-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897']
    def previous(path):return subprocess.check_output(git+['show',BASE+':'+path.relative_to(ROOT).as_posix()],cwd=ROOT)
    rules=json.loads((SOURCE/'rules.json').read_text(encoding='utf-8'));assert {k:v for k,v in rules.items() if k!='corner09'}==json.loads(previous(SOURCE/'rules.json'))
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==package_preview.bundled_rules()
    protected=[p for p in SOURCE.rglob('*') if p.is_file() and p.name not in {'index.html','stage.js','stage.php','ui.js','rules.json','rules-data.js'}]
    for p in protected:
        before=previous(p);now=p.read_bytes();assert before==now if p.suffix=='.png' else before.replace(b'\r\n',b'\n')==now.replace(b'\r\n',b'\n'),p
    html=(SOURCE/'index.html').read_text(encoding='utf-8');js=(SOURCE/'ui.js').read_text(encoding='utf-8');ids=re.findall(r'\bid="([^"]+)"',html)
    assert len(ids)==len(set(ids));assert not set(re.findall(r"\$\('([^']+)'\)",js))-set(ids)
    data=package_preview.standalone_html(package_preview.bundled_rules()).encode('utf-8');assert P.verify_html(data)==21
    review=P.review_html(ROOT/'docs/danmaku/review/COLLECT-v2.html');assert P.verify_html(review)==10
    baseline=out/'danmaku-stage01-collect-v1-offline.html'
    if baseline.exists():assert P.sha(baseline.read_bytes())=='6b268922383b423bfb5959949f3ffdaf94835632e47aa047768ff45e8809846a'
    targets=[('danmaku-stage01-corner-v1-offline.html',data),('danmaku-corner-v1-review.html',review)]
    for name,payload in targets:P.fixed_write(out/name,payload)
    files={}
    for p in SOURCE.rglob('*'):
        if not p.is_file():continue
        content=p.read_bytes();content=content if p.suffix=='.png' else content.replace(b'\r\n',b'\n')
        files[p.relative_to(SOURCE).as_posix()]={'bytes':len(content),'sha256':P.sha(content)}
    manifest={'candidate':'corner-v1-handoff','baseCommit':BASE,'sourceRef':'feat/danmaku-title-power-v1','pullRequest':'https://github.com/avgdaren/dz-gamecenter/pull/79','runtimeRoot':SOURCE.relative_to(ROOT).as_posix(),'rules':{'easy':rules['corner09']['easyRule'],'normal':rules['corner09']['normalRule']},'corner':rules['corner09'],'allDropKinds':True,'bypassPickupLock':True,'attractionPersistsAfterLeaving':True,'preludePower':26,'pointCrystalValue':500,'scoreUpperBound':rules['collect08']['scoreUpperBound'],'runtimeFiles':files,'outputs':[{'file':name,'bytes':len(payload),'sha256':P.sha(payload)} for name,payload in targets],'naturalClearRun':False,'forumInstalledByThisTask':False,'databaseUpgrade':False}
    manifest['runtimeHashConvention']='LF-normalized UTF-8 text; exact PNG bytes'
    payload=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8');P.fixed_write(out/'danmaku-stage01-corner-v1-MANIFEST.json',payload)
    handoff=ROOT/'docs/danmaku/handoff-v2';handoff.mkdir(parents=True,exist_ok=True);receipt=handoff/'RUNTIME-MANIFEST.json'
    if receipt.exists():assert json.loads(receipt.read_text(encoding='utf-8'))==manifest,'Runtime manifest differs'
    else:receipt.write_bytes(payload)
    print(json.dumps({'status':'PASS','outputs':manifest['outputs'],'runtimeFiles':len(files),'protectedFiles':len(protected),'scripts':21,'reviewScripts':10,'domIds':len(ids),'runtimeManifestInRepository':True}))
if __name__=='__main__':main()
