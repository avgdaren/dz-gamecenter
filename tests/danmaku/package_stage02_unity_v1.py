"""(C) 2026 Carinoasd. Offline same-game comparison sample: 小典 / Codex."""
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
    garden = ROOT/'docs/danmaku/art/stage02-garden-v2'
    materials = ROOT/'docs/danmaku/art/stage02-projectiles-v1'
    sprites = ROOT/'docs/danmaku/art/stage02-unity-v1'
    ga = json.loads((garden/'source-audit.json').read_text(encoding='utf-8'))
    ma = json.loads((materials/'source-audit.json').read_text(encoding='utf-8'))
    sa = json.loads((sprites/'source-audit.json').read_text(encoding='utf-8'))
    files = {k: garden/v['file'] for k,v in ga.items()}
    files.update({k: materials/v['file'] for k,v in ma.items()})
    files.update({k: sprites/v['file'] for k,v in sa.items()})
    for k,v in {**ga,**ma,**sa}.items():
        assert sha(files[k]) == v['sha256']
    for k,v in {'refFairy':'stage01-fairy-v1.png','refAttendant':'stage01-attendant-v1.png','refGuardian':'stage01-guardian-v1.png','refBoss':'boss-body-atlas-v1.png','refBack':'boss-ring-back-v1.png','refFront':'boss-ring-front-v1.png','refFace':'boss-face-v1.png','refPortrait':'boss-portrait-v1.png','corridor':'stage01-corridor-v1.png','player':'player-motion-v1.png'}.items():
        files[k] = OLD/'assets'/v
    files['portrait'] = ROOT/'docs/danmaku/art/stage02-production-v1/lingyu-portrait-v1.png'
    assets = {k:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for k,p in files.items()}
    banks, music = [], {}
    for index,folder in enumerate(['stage01-happyshrimp-v1','stage02-user-v1']):
        directory = ROOT/'docs/danmaku/audio'/folder
        manifest = json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
        entries = {}
        for target,key in [('stage','stage'),('bossCore','bossCore' if index==0 else 'boss')]:
            item = manifest['entries'][key]
            p = directory/(item.get('file') or key+'.mp3')
            assert sha(p) == item['sha256']
            entries[target] = {'kind':'music','mime':'audio/mpeg','loop':False,'seconds':item.get('seconds') or item['decodedPcm']['seconds'],'data':base64.b64encode(p.read_bytes()).decode()}
            music[folder+'/'+p.name] = sha(p)
        banks.append({'v':1,'entries':entries})
    data = {'assets':assets,'banks':banks,'rules':json.loads((OLD/'rules.json').read_text(encoding='utf-8')),
            'gardenLayout':{k:ga[k]['visibleBoundsAlpha128'] for k in ('rail','arch')},
            'spriteLayout':{k:v['visibleBoundsAlpha128'] for k,v in sa.items()},
            'materialLayout':{k:v['visibleBoundsAlpha128'] for k,v in ma.items()}}
    shared = ['engine.js','boss-patterns.js','battle.js','weapons.js','hard-patterns.js','hard-rich-patterns.js','hard-choreography.js','stage.js','audio.js','controls.js','player-view.js','stage-view.js','stage-art-view.js','boss-view.js','stage-show.js']
    local = ['garden-materials-v3.js','unity-sample-v1.js','unity-sprites-v1.js','unity-show-v1.js','unity-view-v1.js']
    runtime = '\n'.join((OLD/name).read_text(encoding='utf-8') for name in shared)
    runtime += '\n'+(ROOT/'docs/danmaku/review/stage02-garden-v3.js').read_text(encoding='utf-8')
    runtime += '\n'+'\n'.join((NEW/name).read_text(encoding='utf-8') for name in local)
    app = (NEW/'unity-app-v1.js').read_text(encoding='utf-8')
    style = (OLD/'style.css').read_text(encoding='utf-8').replace('#boss-portrait','.boss-portrait')
    html = (ROOT/'docs/danmaku/review/STAGE-02-UNITY-v1.html').read_text(encoding='utf-8')
    lanes = []
    for index,stage in enumerate(['第一关 · 星穹回廊（基准）','第二关 · 风铃花庭（候选）']):
        boss = ['星环观测者','铃羽'][index]
        location = ['星穹回廊 / 守关者','风铃花庭 / 司风天使'][index]
        first = ['周天轨迹','风廊'][index]
        lanes.append(f'''<section class="game-shell"><div class="arena-heading"><b>{stage}</b><span>Easy · 局部练习</span></div><div class="boss-health"><div class="progress-heading"><span id="phase-{index}">标准姿态</span><output id="clock-{index}">0 秒</output></div><div class="hp-track"><span id="fill-{index}"></span></div></div><div class="canvas-wrap" id="wrap-{index}"><canvas id="field-{index}" width="480" height="640" tabindex="0" aria-label="{stage}"></canvas><div class="field-hud"><div class="hud-lives"><span>生命</span><output id="lives-{index}">◆ ◆ ◆</output></div><div class="hud-power"><span>火力 <output id="power-{index}">3 / 5</output></span></div><div class="hud-bombs"><span>大招</span><output id="bombs-{index}">✦ ✦</output><small id="stock-{index}">2 / 3</small></div></div><div class="boss-intro" id="intro-{index}" hidden aria-hidden="true"><div class="intro-orbit"></div><img id="portrait-{index}" class="boss-portrait" alt=""><div class="boss-intro-copy"><small>{location}</small><strong>{boss}</strong><span>第一式 · {first}</span></div></div></div><p class="lane-note">{('运行素材与原有编排作为对照，不改第一关。' if index==0 else '标准姿态与24秒短样，不代表整关已完成。')}</p></section>''')
    html = html.replace('/* __COMMON_STYLE__ */',style).replace('<!-- __LANES__ -->','\n'.join(lanes))
    html = html.replace('/* __RUNTIME__ */',runtime.replace('</script','<\\/script')).replace('/* __DATA__ */','window.Stage02UnityData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';').replace('/* __APP__ */',app.replace('</script','<\\/script'))
    assert not re.search(r'/\* __(?:RUNTIME|DATA|APP|COMMON_STYLE)__ \*/|<!-- __LANES__ -->',html)
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
    name = 'danmaku-stage02-unity-v1-offline.html'
    target = args.output_dir/name
    payload = html.encode('utf-8')
    assert not target.exists() or target.read_bytes()==payload,'Use a fresh candidate directory'
    target.write_bytes(payload)
    manifest = {'version':1,'date':'2026-11-14','author':'小典 / Codex','prototypeCopyright':'(C) 2026 Carinoasd','type':'same-game-reference-and-24s-easy-wave-sample','ranked':False,'fullStageImplemented':False,'stage01Connected':False,'easyCalibrationComplete':False,'visualAcceptance':False,
                'assets':{k:{'file':p.name,'sha256':sha(p)} for k,p in files.items()},'music':music,
                'sharedSources':{name:sha(OLD/name) for name in shared+['style.css']},'localSources':{name:sha(NEW/name) for name in local+['unity-app-v1.js']},
                'output':{'file':name,'bytes':len(payload),'sha256':sha(target)},'browserVerification':False}
    checks = ROOT/'tmp/danmaku/stage02-unity-v1/browser/checks.json'
    if checks.exists():
        check = json.loads(checks.read_text(encoding='utf-8'))
        if check.get('status')=='PASS' and check.get('sha256')==sha(target):
            manifest['browserVerification'] = check
    (args.output_dir/'danmaku-stage02-unity-v1-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS',**manifest['output']},ensure_ascii=False))


if __name__ == '__main__':
    main()
