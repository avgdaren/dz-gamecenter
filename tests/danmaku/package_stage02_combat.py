"""(C) 2026 Carinoasd. Self-contained Stage 2 draft packaging: 小典 / Codex."""
import argparse
import base64
import hashlib
from html import escape
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
    parser=argparse.ArgumentParser()
    parser.add_argument('--output-dir',type=Path,default=ROOT.parent/'output')
    args=parser.parse_args()
    garden=ROOT/'docs/danmaku/art/stage02-garden-v2'
    original=ROOT/'docs/danmaku/art/stage02-production-v1'
    enemies=ROOT/'docs/danmaku/art/stage02-enemies-v1'
    music=ROOT/'docs/danmaku/audio/stage02-user-v1'
    audit=json.loads((garden/'source-audit.json').read_text(encoding='utf-8'))
    files={key:garden/entry['file'] for key,entry in audit.items()}
    files.update({'battle':original/'lingyu-battle-source-v1.png','portrait':original/'lingyu-portrait-v1.png',
        'enemies':enemies/'garden-enemies-source-v1.png','player':OLD/'assets/player-motion-v1.png','bullets':OLD/'assets/projectile-atlas-v1.png'})
    for key,entry in audit.items():assert sha(files[key])==entry['sha256']
    assets={key:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for key,p in files.items()}
    mm=json.loads((music/'manifest.json').read_text(encoding='utf-8'));bank={}
    for key,target in [('stage','stage'),('boss','bossCore')]:
        e=mm['entries'][key];p=music/e['file'];assert sha(p)==e['sha256']
        bank[target]={'kind':'music','mime':'audio/mpeg','loop':False,'seconds':e['decodedPcm']['seconds'],'data':base64.b64encode(p.read_bytes()).decode()}
    chart=json.loads((NEW/'chart.json').read_text(encoding='utf-8'))
    data={'assets':assets,'layout':{k:audit[k]['visibleBoundsAlpha128'] for k in ('rail','arch')},
        'bank':{'v':1,'format':'recorded-user-stage02','entries':bank},'chart':chart,'rules':json.loads((OLD/'rules.json').read_text(encoding='utf-8'))}
    modules=['engine.js','boss-patterns.js','battle.js','weapons.js','hard-patterns.js','hard-rich-patterns.js','hard-choreography.js','stage.js','audio.js','controls.js','player-view.js','bullet-materials.js','stage-view.js']
    runtime='\n'.join((OLD/name).read_text(encoding='utf-8') for name in modules)
    runtime+='\n'+(ROOT/'docs/danmaku/review/stage02-garden-v3.js').read_text(encoding='utf-8')
    runtime+='\n'+'\n'.join((NEW/name).read_text(encoding='utf-8') for name in ('combat.js','view.js'))
    template=(ROOT/'docs/danmaku/review/STAGE-02-COMBAT-v1.html').read_text(encoding='utf-8')
    timeline=''
    for key,title in [('stage','道中'),('boss','Boss：编排取材段落')]:
        timeline+='<h3>'+title+'</h3><table><tr><th>音乐位置</th><th>编排</th></tr>'
        for sec in chart['tracks'][key]['sections']:
            timeline+='<tr><td>'+str(sec['start'])+'–'+str(sec['end'])+'s</td><td>'+escape(sec['name']+'：'+sec['event'])+'</td></tr>'
        timeline+='</table>'
    timeline+='<p class="small">此表为首版编排与复核位置；BPM及乐句尚未乐理验收。Boss以击破换阶段，音乐连续播放，表中窗口不强制玩家在该秒击破。</p>'
    outputs=[];args.output_dir.mkdir(parents=True,exist_ok=True)
    names=['danmaku-stage02-patterns-v1-offline.html','danmaku-stage02-combat-v1-offline.html']
    for observer,name in zip([True,False],names):
        values={'TITLE':'弹幕动态样片' if observer else '战斗练习初稿',
            'INTRO':'三组编排搭配花庭和BGM，可直接切换、暂停与定位。' if observer else '单独试玩道中或铃羽三阶段战斗。沿用已确认的花庭移动节奏。',
            'CHOOSE':'选择样片' if observer else '选择战斗段落',
            'SELECTIONS':''.join('<button type="button" data-select="'+value+'">'+label+'</button>' for value,label in ([('sample0','Ⅰ 风廊'),('sample1','Ⅱ 花瓣舒展'),('sample2','Ⅲ 铃声回响')] if observer else [('stage','道中战斗'),('boss','铃羽三阶段')])),
            'SEEK_HINT':'进度条定位当前32秒样片；拖动后暂停。样片默认测试无敌、不自动射击。' if observer else '进度条显示当前音乐位置。战斗从本段开头开始，重试可回到开头。',
            'TIMELINE':timeline}
        html=template
        for key,value in values.items():html=html.replace('__'+key+'__',value)
        data['observer']=observer
        html=html.replace('/* __RUNTIME__ */',runtime.replace('</script','<\\/script'))
        html=html.replace('/* __DATA__ */','window.Stage02DraftData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';')
        html=html.replace('/* __APP__ */',(NEW/'app.js').read_text(encoding='utf-8').replace('</script','<\\/script'))
        assert not re.search(r'__(?:RUNTIME|DATA|APP|TITLE|INTRO|CHOOSE|SELECTIONS|SEEK_HINT|TIMELINE)__',html)
        scripts=re.findall(r'<script>(.*?)</script>',html,re.S);assert len(scripts)==2
        subprocess.run(['node','-e','const vm=require("node:vm"),fs=require("node:fs");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
        class Links(HTMLParser):
            def handle_starttag(self,tag,attrs):
                for k,v in attrs:
                    if k in ('src','href'):assert v.startswith(('data:','#')) or v in names,v
        Links().feed(html)
        target=args.output_dir/name;payload=html.encode('utf-8')
        assert not target.exists() or target.read_bytes()==payload,'Use a fresh candidate directory'
        target.write_bytes(payload);outputs.append({'file':name,'bytes':len(payload),'sha256':sha(target)})
    report={'version':1,'date':'2026-11-14','author':'小典 / Codex','prototypeCopyright':'(C) 2026 Carinoasd',
        'rule':chart['rule'],'ranked':False,'serverVerifierIntegrated':False,'fullStageFlowIntegrated':False,
        'assets':{k:{'file':p.name,'sha256':sha(p)} for k,p in files.items()},'music':{k:e['sha256'] for k,e in mm['entries'].items()},
        'chartSha256':sha(NEW/'chart.json'),'outputs':outputs,'browserVerification':False}
    check=ROOT/'tmp/danmaku/stage02-combat-v1/browser/checks.json'
    if check.exists():
        v=json.loads(check.read_text(encoding='utf-8'))
        if v.get('status')=='PASS' and v.get('hashes')=={x['file']:x['sha256'] for x in outputs}:report['browserVerification']=v
    (args.output_dir/'danmaku-stage02-combat-v1-MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'PASS','outputs':outputs},ensure_ascii=False))


if __name__=='__main__':main()
