"""(C) 2026 Carinoasd. Two-stage story packaging: 小典 / Codex."""
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
CAMPAIGN=ROOT/'source/plugin/gamecenter/games/_danmaku_campaign_draft'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output-dir',type=Path,default=ROOT.parent/'output')
    args=parser.parse_args()
    files,audits={},{}
    for folder in ['stage02-garden-v2','stage02-projectiles-v1','stage02-unity-v1','stage02-unity-actions-v1']:
        directory=ROOT/'docs/danmaku/art'/folder
        audit=json.loads((directory/'source-audit.json').read_text(encoding='utf-8'))
        audits[folder]=audit
        for key,row in audit.items():
            p=directory/row['file'];assert sha(p)==row['sha256'];files[key]=p
    files.update({'player':OLD/'assets/player-motion-v1.png','portrait':ROOT/'docs/danmaku/art/stage02-production-v1/lingyu-portrait-v1.png','enemies':ROOT/'docs/danmaku/art/stage02-enemies-v1/garden-enemies-source-v1.png'})
    uri=lambda p:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
    directory=ROOT/'docs/danmaku/audio/stage02-user-v1'
    music_manifest=json.loads((directory/'manifest.json').read_text(encoding='utf-8'));entries={};music={}
    for target,key in [('stage','stage'),('bossCore','boss')]:
        row=music_manifest['entries'][key];p=directory/(row.get('file') or key+'.mp3');assert sha(p)==row['sha256']
        entries[target]={'kind':'music','mime':'audio/mpeg','loop':False,'seconds':row.get('seconds') or row['decodedPcm']['seconds'],'data':base64.b64encode(p.read_bytes()).decode()};music[p.name]=sha(p)
    garden={'assets':{key:uri(p) for key,p in files.items()},'bank':{'v':1,'entries':entries},'rules':json.loads((OLD/'rules.json').read_text(encoding='utf-8')),'chart':json.loads((NEW/'chart.json').read_text(encoding='utf-8')),
            'gardenLayout':{key:audits['stage02-garden-v2'][key]['visibleBoundsAlpha128'] for key in ('rail','arch')},
            'spriteLayout':{key:row['visibleBoundsAlpha128'] for key,row in audits['stage02-unity-v1'].items()},
            'materialLayout':{key:row['visibleBoundsAlpha128'] for key,row in audits['stage02-projectiles-v1'].items()}}
    first_names={'player':'player-motion-v1.png','title':'player-title-portrait-v2.png','portrait':'boss-portrait-v1.png','corridor':'stage01-corridor-v1.png','fairy':'stage01-fairy-v1.png','attendant':'stage01-attendant-v1.png','guardian':'stage01-guardian-v1.png','body':'boss-body-atlas-v1.png','back':'boss-ring-back-v1.png','front':'boss-ring-front-v1.png','face':'boss-face-v1.png'}
    first={key:OLD/'assets'/name for key,name in first_names.items()}
    first['corridor']=ROOT/'docs/danmaku/art/stage01-starroad-v2/stage01-starroad-source-v2.png'
    data={'garden':garden,'firstAssets':{key:uri(p) for key,p in first.items()}}
    shared=['engine.js','boss-patterns.js','battle.js','weapons.js','hard-patterns.js','hard-rich-patterns.js','hard-choreography.js','stage.js','audio.js','controls.js','player-view.js','boss-view.js','stage-view.js','stage-art-view.js','stage-show.js','audio-bank.js','bgm-bank.js']
    local=['refined-garden-v2.js','garden-materials-v3.js','unity-sprites-v1.js','unity-show-v1.js','refined-combat-v1.js','refined-combat-v2.js','refined-intro-v1.js','garden-original-patterns-v1.js','refined-formation-v4.js','refined-easy-v5.js','refined-easy-entry-v6.js','refined-sprites-v1.js','refined-view-v4.js']
    additions=['flow-v1.js','mob-feedback-v2.js','story-data-v1.js','story-flow-v3.js','dialogue-view-v1.js','spell-change-v2.js','star-corridor-v2.js']
    sources=[OLD/name for name in shared]+[NEW/name for name in local if name!='refined-view-v4.js']+[CAMPAIGN/name for name in additions]+[NEW/'refined-view-v4.js',CAMPAIGN/'stage01-view-v1.js']
    runtime='\n'.join(p.read_text(encoding='utf-8') for p in sources)
    app=(CAMPAIGN/'app-v3.js').read_text(encoding='utf-8')
    html=(ROOT/'docs/danmaku/review/CAMPAIGN-v3.html').read_text(encoding='utf-8')
    html=html.replace('/* __DIALOGUE_STYLE__ */',(CAMPAIGN/'dialogue-v1.css').read_text(encoding='utf-8'))
    html=html.replace('/* __COMMON_STYLE__ */',(OLD/'style.css').read_text(encoding='utf-8').replace('#boss-portrait','.boss-portrait'))
    html=html.replace('/* __RUNTIME__ */',runtime.replace('</script','<\\/script')).replace('/* __DATA__ */','window.CampaignData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';window.Stage02RefinedData=CampaignData.garden;').replace('/* __APP__ */',app.replace('</script','<\\/script'))
    assert not re.search(r'/\* __(?:RUNTIME|DATA|APP|COMMON_STYLE)__ \*/',html)
    scripts=re.findall(r'<script>(.*?)</script>',html,re.S)
    subprocess.run(['node','-e','const vm=require("node:vm"),fs=require("node:fs");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    ids=re.findall(r'\bid="([^"]+)"',html);assert len(ids)==len(set(ids));assert set(re.findall(r"\$\('([^']+)'\)",app))<=set(ids)
    class Links(HTMLParser):
        def handle_starttag(self,tag,attrs):
            for key,value in attrs:
                if key in ('src','href'):assert value.startswith(('data:','#')),value
    Links().feed(html)
    args.output_dir.mkdir(parents=True,exist_ok=True)
    name='danmaku-campaign-easy-v3-offline.html';target=args.output_dir/name;payload=html.encode('utf-8')
    assert not target.exists() or target.read_bytes()==payload,'Use a fresh candidate directory'
    target.write_bytes(payload)
    manifest={'version':3,'date':'2026-11-15','author':'小典 / Codex','prototypeCopyright':'(C) 2026 Carinoasd','rule':'danmaku-campaign-easy-v3','difficulty':'easy','ranked':False,'stage01Connected':True,
              'stage01Rule':'r9 player core + campaign-v2 mob HP','stage02Baseline':'refined-v6','mobHP':[[1,128,450],[1,176,540]],'bossTransitions':'continuous Boss, inward charge and next-spell card in existing 120 ticks','bossEasyPatternsAccepted':True,'stage02EntryGraceAccepted':True,'stage02FirstEnemySeconds':8,'stage02DurationSeconds':96,'handoffTicks':100,
              'resourceInheritance':'actual lives, raw power and B; elapsed invulnerability and bomb cooldown; no new transition reward','stage02Scoring':'provisional: actual Boss damage + phase + graze + mob/item/overflow points; no Stage 1 clear/time/resource award',
              'artChanged':False,'newArtGenerated':False,'combatBaseline':'campaign-easy-v2','musicChanged':False,'dialogueImplemented':True,'storySceneCount':6,'storyLineCount':28,'serverReplaySupported':False,'easyCalibrationComplete':False,'naturalFullClearTested':False,
              'assets':{'stage01':{key:{'file':p.name,'sha256':sha(p)} for key,p in first.items()},'stage02':{key:{'file':p.name,'sha256':sha(p)} for key,p in files.items()}},'stage02Music':music,
              'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in sources+[CAMPAIGN/'app-v3.js',CAMPAIGN/'dialogue-v1.css',OLD/'style.css',OLD/'rules.json']},
              'backgroundAudit':json.loads((ROOT/'docs/danmaku/art/stage01-starroad-v2/source-audit.json').read_text(encoding='utf-8')),'output':{'file':name,'bytes':len(payload),'sha256':sha(target)},'browserVerification':False}
    checks=ROOT/'tmp/danmaku/campaign-v3/browser/checks.json'
    if checks.exists():
        check=json.loads(checks.read_text(encoding='utf-8'))
        if check.get('status')=='PASS' and check.get('sha256')==sha(target):manifest['browserVerification']=check
    (args.output_dir/'danmaku-campaign-easy-v3-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS',**manifest['output']},ensure_ascii=False))


if __name__=='__main__':main()
