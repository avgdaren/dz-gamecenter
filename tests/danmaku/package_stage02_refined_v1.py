"""(C) 2026 Carinoasd. Offline compact Stage 2 packaging: 小典 / Codex."""
import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
OLD = ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
NEW = ROOT/'source/plugin/gamecenter/games/_danmaku_stage02_draft'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-dir', type=Path, default=ROOT.parent/'output')
    args = parser.parse_args()
    files, audits = {}, {}
    for folder in ['stage02-garden-v2', 'stage02-projectiles-v1', 'stage02-unity-v1', 'stage02-unity-actions-v1']:
        directory = ROOT/'docs/danmaku/art'/folder
        audit = json.loads((directory/'source-audit.json').read_text(encoding='utf-8'))
        audits[folder] = audit
        for k,v in audit.items():
            p = directory/v['file']
            assert sha(p) == v['sha256']
            files[k] = p
    files.update({'player':OLD/'assets/player-motion-v1.png',
                  'portrait':ROOT/'docs/danmaku/art/stage02-production-v1/lingyu-portrait-v1.png',
                  'enemies':ROOT/'docs/danmaku/art/stage02-enemies-v1/garden-enemies-source-v1.png'})
    assets = {k:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for k,p in files.items()}
    folder = ROOT/'docs/danmaku/audio/stage02-user-v1'
    music_manifest = json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    entries, music = {}, {}
    for target,key in [('stage','stage'),('bossCore','boss')]:
        item = music_manifest['entries'][key]
        p = folder/(item.get('file') or key+'.mp3')
        assert sha(p) == item['sha256']
        entries[target] = {'kind':'music','mime':'audio/mpeg','loop':False,'seconds':item.get('seconds') or item['decodedPcm']['seconds'],'data':base64.b64encode(p.read_bytes()).decode()}
        music[p.name] = sha(p)
    data = {'assets':assets,'bank':{'v':1,'entries':entries},'rules':json.loads((OLD/'rules.json').read_text(encoding='utf-8')),
            'gardenLayout':{k:audits['stage02-garden-v2'][k]['visibleBoundsAlpha128'] for k in ('rail','arch')},
            'spriteLayout':{k:v['visibleBoundsAlpha128'] for k,v in audits['stage02-unity-v1'].items()},
            'materialLayout':{k:v['visibleBoundsAlpha128'] for k,v in audits['stage02-projectiles-v1'].items()}}
    shared = ['engine.js','boss-patterns.js','battle.js','weapons.js','hard-patterns.js','hard-rich-patterns.js','hard-choreography.js','stage.js','audio.js','controls.js','player-view.js','stage-view.js','stage-art-view.js','stage-show.js']
    local = ['refined-garden-v1.js','garden-materials-v3.js','unity-sprites-v1.js','unity-show-v1.js','refined-combat-v1.js','refined-sprites-v1.js','refined-view-v1.js']
    runtime = '\n'.join((OLD/name).read_text(encoding='utf-8') for name in shared)
    runtime += '\n'+'\n'.join((NEW/name).read_text(encoding='utf-8') for name in local)
    app = (NEW/'refined-app-v1.js').read_text(encoding='utf-8')
    style = (OLD/'style.css').read_text(encoding='utf-8').replace('#boss-portrait','.boss-portrait')
    html = (ROOT/'docs/danmaku/review/STAGE-02-REFINED-v1.html').read_text(encoding='utf-8')
    html = html.replace('/* __COMMON_STYLE__ */',style).replace('/* __RUNTIME__ */',runtime.replace('</script','<\\/script')).replace('/* __DATA__ */','window.Stage02RefinedData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';').replace('/* __APP__ */',app.replace('</script','<\\/script'))
    assert not re.search(r'/\* __(?:RUNTIME|DATA|APP|COMMON_STYLE)__ \*/',html)
    scripts = re.findall(r'<script>(.*?)</script>',html,re.S)
    subprocess.run(['node','-e','const vm=require("node:vm"),fs=require("node:fs");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    ids = re.findall(r'\bid="([^"]+)"',html)
    assert len(ids)==len(set(ids))
    assert set(re.findall(r"\$\('([^']+)'\)",app)) <= set(ids)
    class Links(HTMLParser):
        def handle_starttag(self, tag, attrs):
            for key,value in attrs:
                if key in ('src','href'):
                    assert value.startswith(('data:','#')),value
    Links().feed(html)
    args.output_dir.mkdir(parents=True,exist_ok=True)
    name = 'danmaku-stage02-refined-v1-offline.html'
    target = args.output_dir/name
    payload = html.encode('utf-8')
    assert not target.exists() or target.read_bytes()==payload,'Use a fresh candidate directory'
    target.write_bytes(payload)
    manifest = {'version':1,'date':'2026-11-15','author':'小典 / Codex','prototypeCopyright':'(C) 2026 Carinoasd','type':'stage02-90s-easy-adjustment-candidate','ranked':False,'fullStageImplemented':True,'preludeSeconds':90,'stage01Connected':False,'easyCalibrationComplete':False,'visualAcceptance':{'unityDirection':True,'newActions':False},
                'assets':{k:{'file':p.name,'sha256':sha(p)} for k,p in files.items()},'music':music,
                'sharedSources':{name:sha(OLD/name) for name in shared+['style.css']},'localSources':{name:sha(NEW/name) for name in local+['refined-app-v1.js']},
                'output':{'file':name,'bytes':len(payload),'sha256':sha(target)},'browserVerification':False}
    checks = ROOT/'tmp/danmaku/stage02-refined-v1/browser/checks.json'
    if checks.exists():
        check = json.loads(checks.read_text(encoding='utf-8'))
        if check.get('status')=='PASS' and check.get('sha256')==sha(target):manifest['browserVerification'] = check
    (args.output_dir/'danmaku-stage02-refined-v1-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS',**manifest['output']},ensure_ascii=False))


if __name__ == '__main__':
    main()
