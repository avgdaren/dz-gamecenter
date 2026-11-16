"""(C) 2026 Carinoasd. Stage 2 readable sprite and performance v2 package: 小典 / Codex."""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[2]
OLD=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
NEW=ROOT/'source/plugin/gamecenter/games/_danmaku_stage02_draft'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=ROOT.parent/'output');args=parser.parse_args()
    garden=ROOT/'docs/danmaku/art/stage02-garden-v2';art=ROOT/'docs/danmaku/art/stage02-production-v1'
    enemies=ROOT/'docs/danmaku/art/stage02-enemies-v1';materials=ROOT/'docs/danmaku/art/stage02-projectiles-v1';music=ROOT/'docs/danmaku/audio/stage02-user-v1';actions=ROOT/'docs/danmaku/art/stage02-battle-v2'
    ga=json.loads((garden/'source-audit.json').read_text(encoding='utf-8'));ma=json.loads((materials/'source-audit.json').read_text(encoding='utf-8'))
    files={k:garden/v['file'] for k,v in ga.items()};files.update({k:materials/v['file'] for k,v in ma.items()})
    files.update({'battle':art/'lingyu-battle-source-v1.png','portrait':art/'lingyu-portrait-v1.png','enemies':enemies/'garden-enemies-source-v1.png','player':OLD/'assets/player-motion-v1.png'})
    aa=json.loads((actions/'source-audit.json').read_text(encoding='utf-8'))
    files.update({k:actions/v['file'] for k,v in aa.items()})
    for key,item in {**ga,**ma,**aa}.items():assert sha(files[key])==item['sha256']
    assets={k:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for k,p in files.items()}
    mm=json.loads((music/'manifest.json').read_text(encoding='utf-8'));bank={}
    for key,target in [('stage','stage'),('boss','bossCore')]:
        entry=mm['entries'][key];p=music/entry['file'];assert sha(p)==entry['sha256']
        bank[target]={'kind':'music','mime':'audio/mpeg','loop':False,'seconds':entry['decodedPcm']['seconds'],'data':base64.b64encode(p.read_bytes()).decode()}
    chart=json.loads((NEW/'chart.json').read_text(encoding='utf-8'));dialogue=json.loads((NEW/'dialogue-v1.json').read_text(encoding='utf-8'))
    for key in ('prologue','bossTalk','epilogue'):assert dialogue[key] and all(isinstance(v['speaker'],str) and isinstance(v['text'],str) for v in dialogue[key])
    data={'assets':assets,'layout':{k:ga[k]['visibleBoundsAlpha128'] for k in ('rail','arch')},'materialLayout':{k:v['visibleBoundsAlpha128'] for k,v in ma.items()},
        'bank':{'v':1,'format':'recorded-user-stage02','entries':bank},'chart':chart,'dialogue':dialogue,'rules':json.loads((OLD/'rules.json').read_text(encoding='utf-8'))}
    modules=['engine.js','boss-patterns.js','battle.js','weapons.js','hard-patterns.js','hard-rich-patterns.js','hard-choreography.js','stage.js','audio.js','controls.js','player-view.js','stage-view.js']
    runtime='\n'.join((OLD/p).read_text(encoding='utf-8') for p in modules)
    runtime+='\n'+(ROOT/'docs/danmaku/review/stage02-garden-v3.js').read_text(encoding='utf-8')
    runtime+='\n'+'\n'.join((NEW/p).read_text(encoding='utf-8') for p in ('combat.js','journey.js','garden-materials-v3.js','performance-v2.js','battle-sprites-v2.js','journey-view-v2.js'))
    app=(NEW/'journey-app-v2.js').read_text(encoding='utf-8');html=(ROOT/'docs/danmaku/review/STAGE-02-PERFORMANCE-v2.html').read_text(encoding='utf-8')
    html=html.replace('/* __RUNTIME__ */',runtime.replace('</script','<\\/script')).replace('/* __DATA__ */','window.Stage02JourneyData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';').replace('/* __APP__ */',app.replace('</script','<\\/script'))
    assert not re.search(r'/\* __(?:RUNTIME|DATA|APP)__ \*/',html)
    scripts=re.findall(r'<script>(.*?)</script>',html,re.S);assert len(scripts)==2
    subprocess.run(['node','-e','const vm=require("node:vm"),fs=require("node:fs");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    ids=re.findall(r'\bid="([^"]+)"',html);assert len(ids)==len(set(ids));assert set(re.findall(r"\$\('([^']+)'\)",app))<=set(ids)
    class Links(HTMLParser):
        def handle_starttag(self,tag,attrs):
            for k,v in attrs:
                if k in ('src','href'):assert v.startswith(('data:','#')),v
    Links().feed(html)
    args.output_dir.mkdir(parents=True,exist_ok=True);name='danmaku-stage02-performance-v2-offline.html';target=args.output_dir/name;payload=html.encode('utf-8')
    assert not target.exists() or target.read_bytes()==payload,'Use a fresh candidate directory'
    target.write_bytes(payload)
    manifest={'version':2,'date':'2026-11-14','author':'小典 / Codex','prototypeCopyright':'(C) 2026 Carinoasd','type':'stage02-sprites-and-performance-candidate',
        'fullStageFlowIntegrated':True,'stage01Connected':False,'firstTwoPlanStepsCandidate':True,'visualAcceptance':False,'ranked':False,'serverVerifierIntegrated':False,'dialogueStatus':'implemented-draft-awaiting-user-feedback','newRasterImages':True,'sourcePngsUnmodified':True,'gameplayRuleChanged':False,
        'assets':{k:{'file':p.name,'sha256':sha(p)} for k,p in files.items()},'music':{k:v['sha256'] for k,v in mm['entries'].items()},
        'sources':{k:sha(NEW/k) for k in ('chart.json','dialogue-v1.json','combat.js','journey.js','garden-materials-v3.js','performance-v2.js','battle-sprites-v2.js','journey-view-v2.js','journey-app-v2.js')},
        'output':{'file':name,'bytes':len(payload),'sha256':sha(target)},'browserVerification':False}
    check=ROOT/'tmp/danmaku/stage02-performance-v2/browser/checks.json'
    if check.exists():
        report=json.loads(check.read_text(encoding='utf-8'))
        if report.get('status')=='PASS' and report.get('sha256')==sha(target):manifest['browserVerification']=report
    (args.output_dir/'danmaku-stage02-performance-v2-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS',**manifest['output']},ensure_ascii=False))


if __name__=='__main__':main()
