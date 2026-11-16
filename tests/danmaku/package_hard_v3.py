"""(C) 2026 Carinoasd. Versioned Hard v3 playtest and observer: 小典 / Codex."""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import package_preview as P

ROOT=P.ROOT;SOURCE=P.SOURCE
def sha(data):return hashlib.sha256(data).hexdigest()
def verify(html,expected):
    scripts=re.findall(r'<script>\s*(.*?)</script>',html,re.S)
    if expected is not None:assert len(scripts)==expected,len(scripts)
    subprocess.run(['node','-e',"const fs=require('node:fs'),vm=require('node:vm');for(const s of JSON.parse(fs.readFileSync(0,'utf8')))new vm.Script(s);"],input=json.dumps(scripts),text=True,check=True,capture_output=True)
    class Links(HTMLParser):
        def handle_starttag(self,tag,attrs):
            for key,value in attrs:
                if key in ['src','href'] and value:assert value.startswith(('data:','#')) or value=='danmaku-stage01-hard-v3-offline.html',value
    Links().feed(html)
    assert 'assets/' not in html
    return len(scripts)
def observer():
    html=(ROOT/'docs/danmaku/review/HARD-v3.html').read_text(encoding='utf-8')
    index=(SOURCE/'index.html').read_text(encoding='utf-8')
    names=[n for n in re.findall(r'<script defer src="([^"<>]+)"></script>',index) if n not in ['ui.js','audio-bank.js','midi-bank.js','midi.js']]
    scripts=[]
    for name in names:scripts.append((P.bundled_rules() if name=='rules-data.js' else (SOURCE/name).read_text(encoding='utf-8')))
    runtime='\n'.join(scripts).replace('</script','<\\/script')
    html=html.replace('/* __RUNTIME__ */',runtime).replace('/* __PREVIEW__ */',(ROOT/'docs/danmaku/review/hard-v3-preview.js').read_text(encoding='utf-8'))
    for name in sorted(set(re.findall(r'assets/([\w-]+\.png)',html))):
        html=html.replace('assets/'+name,'data:image/png;base64,'+base64.b64encode((SOURCE/'assets'/name).read_bytes()).decode('ascii'))
    return html
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=ROOT.parent/'output');args=parser.parse_args();out=args.output_dir;out.mkdir(parents=True,exist_ok=True)
    assert (SOURCE/'rules-data.js').read_text(encoding='utf-8')==P.bundled_rules()
    game=P.standalone_html(P.bundled_rules());script_count=verify(game,26);preview=observer();preview_scripts=verify(preview,2)
    ids=re.findall(r'\bid="([^"]+)"',game);assert len(ids)==len(set(ids));assert not set(re.findall(r"\$\('([^']+)'\)",(SOURCE/'ui.js').read_text(encoding='utf-8')))-set(ids)
    for name,expected in [('danmaku-stage01-hard-v2-offline.html','79c866ae7aa12403137e1ebc343de08602a4b5795ee338e136df9269e1353b02'),('danmaku-stage01-hard-v1-offline.html','ad7906862b9b53acbbde99cfa36aad15107ce15969eb0b0b358ee96c4ed1158a')]:
        prior=ROOT.parent/'output'/name
        if prior.exists():assert sha(prior.read_bytes())==expected,name
    outputs=[]
    for name,html in [('danmaku-stage01-hard-v3-offline.html',game),('danmaku-hard-v3-observer.html',preview)]:
        payload=html.encode('utf-8');file=out/name
        if file.exists():assert file.read_bytes()==payload,'Refusing to replace a different candidate: '+name
        else:file.write_bytes(payload)
        outputs.append({'file':name,'bytes':len(payload),'sha256':sha(payload)})
    files={}
    for p in sorted(SOURCE.rglob('*')):
        if p.is_file():
            data=p.read_bytes();data=data if p.suffix=='.png' else data.replace(b'\r\n',b'\n');files[p.relative_to(SOURCE).as_posix()]={'bytes':len(data),'sha256':sha(data)}
    manifest={'candidate':'hard-v3','rule':'danmaku-stage01-hard-r3','baseCommit':'27b6500','sourceRef':'feat/danmaku-hard-v1','ranked':False,'easyNormalAndOldHardRulesPreserved':True,'materialSource':'approved material-study-v1 imagegen atlas, byte-identical','motion':'integer angle accumulator, curve reversal, deceleration, lock/warning, child volley, safe spawn','gameScripts':script_count,'observerScriptBlocks':preview_scripts,'runtimeHashConvention':'LF-normalized UTF-8 text; exact PNG bytes','runtimeFiles':files,'outputs':outputs,'naturalClearRun':False,'humanPlaytest':False,'databaseUpgrade':False,'forumInstalled':False}
    browser=ROOT/'tmp/danmaku/hard-v3/browser/checks.json'
    manifest['browserVerification']=False
    if browser.exists():
        report=json.loads(browser.read_text(encoding='utf-8'))
        if report.get('status')=='PASS' and all(report.get('artifactHashes',{}).get(row['file'])==row['sha256'] for row in outputs):manifest['browserVerification']=report
    (out/'danmaku-stage01-hard-v3-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS','scripts':script_count,'runtimeFiles':len(files),'outputs':outputs}))
if __name__=='__main__':main()
