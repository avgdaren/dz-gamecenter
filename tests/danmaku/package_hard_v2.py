"""(C) 2026 Carinoasd. Self-contained unranked Hard v2 delivery: 小典 / Codex."""
import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import package_preview as P

ROOT=P.ROOT;SOURCE=P.SOURCE
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=ROOT.parent/'output');args=parser.parse_args()
    html=P.standalone_html(P.bundled_rules())
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==P.bundled_rules()
    scripts=re.findall(r'<script>\n(.*?)\n</script>',html,re.S);assert len(scripts)==24
    subprocess.run(['node','-e',"const vm=require('node:vm'),fs=require('node:fs');for(const s of JSON.parse(fs.readFileSync(0,'utf8')))new vm.Script(s);"],input=json.dumps(scripts),text=True,check=True,capture_output=True)
    class References(HTMLParser):
        def handle_starttag(self,tag,attrs):
            for key,value in attrs:
                if key in ['src','href'] and value:assert value.startswith(('data:','#')),value
    References().feed(html)
    ids=re.findall(r'\bid="([^"]+)"',html);assert len(ids)==len(set(ids))
    js=(SOURCE/'ui.js').read_text(encoding='utf-8');assert not set(re.findall(r"\$\('([^']+)'\)",js))-set(ids)
    assert 'data-difficulty="hard"' in html and 'Hard · 不计榜' in html
    payload=html.encode('utf-8');args.output_dir.mkdir(parents=True,exist_ok=True)
    target=args.output_dir/'danmaku-stage01-hard-v2-offline.html'
    if target.exists():assert target.read_bytes()==payload,'Refusing to replace a different Hard candidate'
    else:target.write_bytes(payload)
    files={}
    for p in sorted(SOURCE.rglob('*')):
        if p.is_file():
            data=p.read_bytes();data=data if p.suffix=='.png' else data.replace(b'\r\n',b'\n')
            files[p.relative_to(SOURCE).as_posix()]={'bytes':len(data),'sha256':sha(data)}
    legacy=args.output_dir/'danmaku-stage01-corner-v1-offline.html'
    if legacy.exists():assert sha(legacy.read_bytes())=='5df44e7c898ac53b0473809c16311f080157b81d1949d153bc4f1c3f424eea9b'
    old_hard=args.output_dir/'danmaku-stage01-hard-v1-offline.html'
    if old_hard.exists():assert sha(old_hard.read_bytes())=='ad7906862b9b53acbbde99cfa36aad15107ce15969eb0b0b358ee96c4ed1158a'
    manifest={'candidate':'hard-v2','baseCommit':'27b6500','sourceRef':'feat/danmaku-hard-v1',
        'rule':'danmaku-stage01-hard-r2','ranked':False,'easyAndNormalUnchanged':True,
        'runtimeHashConvention':'LF-normalized UTF-8 text; exact PNG bytes','runtimeFiles':files,
        'standalone':{'file':target.name,'bytes':len(payload),'sha256':sha(payload)},
        'scripts':len(scripts),'externalResources':False,'naturalClearRun':False,
        'browserVerification':'not performed this iteration; actual UI handlers verified in a browserless DOM harness',
        'testInvincibility':{'default':False,'midRunToggle':True,'testUsedPersistsUntilReset':True,'scoreReplayExportBlocked':True},'bulletKinds':8,'bulletSilhouettes':7,'bossVariantsPerPhase':2,
        'forumInstalled':False,'databaseUpgrade':False,'playtest':'awaiting user'}
    (args.output_dir/'danmaku-stage01-hard-v2-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS','standalone':manifest['standalone'],'scripts':len(scripts),'runtimeFiles':len(files),'domIds':len(ids),'selfContained':True}))

if __name__=='__main__':main()
