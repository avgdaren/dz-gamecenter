"""(C) 2026 Carinoasd. Three-difficulty offline production: 小典 / Codex.
Reads the verified v9 media; writes only new v10 sources and a candidate artifact.
"""
import argparse, base64, hashlib, json, re, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
C=ROOT/'source/plugin/gamecenter/games/_danmaku_campaign_draft'
S=ROOT/'source/plugin/gamecenter/games/_danmaku_stage02_draft'
P=ROOT/'source/plugin/gamecenter/games/_danmaku_proto'
sha=lambda b:hashlib.sha256(b).hexdigest()

def replace(text,old,new,count=1):
    assert text.count(old)==count, (old[:100],text.count(old),count)
    return text.replace(old,new)

def sources():
    app=(C/'app-v9.js').read_text(encoding='utf-8')
    app=replace(app,"selection='campaign',ticket", "selection='campaign',difficulty='normal',practicePhase=-1,ticket")
    app=replace(app,"function controls(){", "function difficultyLabel(){return DanmakuDifficultyPresentation.labels[difficulty];}\n function controls(){")
    app=replace(app,"$('preset').disabled=", "$('difficulty').disabled=mode!=='ready';document.querySelectorAll('[data-pattern]').forEach(function(b){b.disabled=!ready||preparing;});document.querySelector('[data-entry=\"campaign\"]').textContent='从第一关启程 · '+difficultyLabel();$('difficulty-heading').textContent=difficultyLabel()+' · 星穹回廊 → 风铃花庭 · 两关试玩 v10';$('preset').disabled=")
    app=replace(app,"names=first?DanmakuStageShow.phases:Stage02Refined.names", "names=DanmakuDifficultyPresentation.names(difficulty,session.stageNumber)")
    app=replace(app,"?'两关连续试玩 · Easy':'练习／重试记录 · Easy'", "?'两关连续试玩 · '+difficultyLabel():'练习／重试记录 · '+difficultyLabel()")
    app=replace(app,"new DanmakuCampaign.Session(data.garden.rules,value,$('preset').value,$('invincible').checked,$('story-enabled').checked)", "new DanmakuCampaignDifficulties.Session(data.garden.rules,value,$('preset').value,$('invincible').checked,$('story-enabled').checked,difficulty)")
    app=replace(app,"function reset(value){", "function reset(value,keepPhase){if(!keepPhase)practicePhase=-1;")
    app=replace(app,"storyPreview=false;activeAudio=session.stageNumber-1;", "if(practicePhase>=0){session.current=new Stage02Difficulty.Flow(data.garden.rules,'phase'+practicePhase,$('preset').value,$('invincible').checked,difficulty);session.assisted=true;session.saveBoss();}storyPreview=false;activeAudio=session.stageNumber-1;")
    app=replace(app,"if(mode==='over')reset(selection);", "if(mode==='over')reset(selection,true);")
    app=replace(app,"function start(value){ticket++;mode='ready';reset(value);", "function start(value,keepPhase){ticket++;mode='ready';reset(value,keepPhase);")
    app=replace(app,"function(){start(selection);}", "function(){start(selection,true);}")
    app=replace(app,"mode='ready';reset(selection);cover('准备练习'", "mode='ready';reset(selection,true);cover('准备练习'")
    app=replace(app,"Easy · 两关连续试玩','从第一关启程'", "'+difficultyLabel()+' · 两关连续试玩','从第一关启程'")
    app=replace(app,"function retry(kind)", "$('difficulty').addEventListener('change',function(){if(mode!=='ready')return;difficulty=this.value;reset('campaign');cover('天使弹幕祭','星穹回廊 → 风铃花庭\\n'+difficultyLabel()+' · 两关连续试玩','从第一关启程');draw();});\n document.querySelectorAll('[data-pattern]').forEach(function(b){b.addEventListener('click',function(){ticket++;mode='ready';practicePhase=Number(this.dataset.pattern);reset('boss2',true);resume();});});\n function retry(kind)")
    app=replace(app,"inspect:function(){return{ready:ready,", "inspect:function(){return{difficulty:difficulty,practicePhase:practicePhase,ready:ready,")
    app=replace(app,"load(data.firstAssets)", "load(Object.assign({},data.firstAssets,{projectiles:data.projectileAtlas}))")
    (C/'app-v10.js').write_text(app,encoding='utf-8',newline='\n')
    view=(C/'stage02-view-v8.js').read_text(encoding='utf-8')
    view=replace(view,"function bossAct(flow,reduced){var s=flow.sim,next=logic.nextCast(s.index,s.musicTick)","function bossAct(flow,reduced){var s=flow.sim,activeLogic=s.difficulty?root.Stage02Difficulty.forDifficulty(s.difficulty):logic,cue=activeLogic.cue(s.index,s.musicTick),next=cue?cue.inTicks:null;if(s.difficulty&&next!==null&&s.tick+next<36)next=null;var unused=0")
    view=replace(view,"cue:active?logic.cue(s.index,s.musicTick):null", "cue:active&&next!==null?cue:null")
    view=replace(view,"var targets=logic.sources(s.index,s.musicTick,s.boss),points=logic.presentationNodes(s.index,s.musicTick,s.boss);", "var activeLogic=s.difficulty?root.Stage02Difficulty.forDifficulty(s.difficulty):logic,targets=activeLogic.sources(s.index,s.musicTick,s.boss),points=activeLogic.presentationNodes(s.index,s.musicTick,s.boss);if(s.difficulty&&!act.cue)targets=[];")
    view=replace(view,"if(charge||birth){ctx.save();", "if(target&&s.difficulty==='hard'&&target.kind==='call'&&s.hardBellLock&&s.hardBellLock.time===act.cue.musicTick){var locked=s.rules.directionVectors[s.hardBellLock.angle];ctx.save();ctx.strokeStyle='#f5d69d';ctx.globalAlpha=.7;ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]+locked[0]*.5,p[1]+locked[1]*.5);ctx.stroke();ctx.restore();}if(charge||birth){ctx.save();")
    view=replace(view,"if(s.index===2)s.enemies.forEach", "if(s.index===2||s.difficulty)s.enemies.forEach")
    # Delay changes get a visible halo and the known post-change heading on new difficulties.
    view=replace(view,"ctx.stroke();ctx.restore();}});", "ctx.stroke();if(s.difficulty){var a=m[5]===1?Math.floor(m[0]/256)+m[6]:m[5]===3?m[6]:Math.floor(m[0]/256),v=s.rules.directionVectors[(a%512+512)%512];ctx.globalAlpha=.65;ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(e.x/64,e.y/64);ctx.lineTo(e.x/64+v[0]*.035,e.y/64+v[1]*.035);ctx.stroke();}ctx.restore();}});")
    (C/'stage02-view-v10.js').write_text(view,encoding='utf-8',newline='\n')
    first=(C/'stage01-view-v8.js').read_text(encoding='utf-8')
    first=replace(first,"common.phases[f.phaseIndex]", "root.DanmakuDifficultyPresentation.names(root.DanmakuDifficultyPresentation.difficulty(f),1)[f.phaseIndex]")
    first=replace(first,"if(f.stage==='active')root.DanmakuBossPatterns.emitters(ctx,s);", "if(f.stage==='active'){if(s.choreographyMode)root.DanmakuChoreography.telegraphs(ctx,s,reduced);else root.DanmakuBossPatterns.emitters(ctx,s);}")
    first=replace(first,"if(s.patternV3&&!prelude)", "if(s.choreographyMode&&!prelude&&root.DanmakuBulletMaterials.draw(ctx,images.projectiles,e))return;\n   if(s.patternV3&&!prelude)")
    (C/'stage01-view-v10.js').write_text(first,encoding='utf-8',newline='\n')
    canvas=(C/'spell-canvas-v8.js').read_text(encoding='utf-8')
    canvas=replace(canvas,"THEMES[m.life.theme].spells[Math.max(0,m.phase-1)]", "(m.spellNames||THEMES[m.life.theme].spells)[Math.max(0,m.phase-1)]",2)
    (C/'spell-canvas-v10.js').write_text(canvas,encoding='utf-8',newline='\n')

def font():
    sys.path.insert(0,str(ROOT/'tmp/danmaku/campaign-v10/font-tools'))
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    titles=json.loads(subprocess.check_output(['node','-e',"const a=require('./source/plugin/gamecenter/games/_danmaku_stage02_draft/difficulty-normal-v1.js'),b=require('./source/plugin/gamecenter/games/_danmaku_stage02_draft/difficulty-hard-v1.js');process.stdout.write(JSON.stringify(a.names.concat(b.names)));"],cwd=ROOT,text=True,encoding='utf-8'))
    original=json.loads((ROOT/'docs/danmaku/fonts/spell-serif-v7/source-audit.json').read_text(encoding='utf-8'))
    text=original['characters']+''.join(titles)+'星环双旋交织星雨引光夹击星幕迁移星廊回旋花冠悬光回响星河双岸交织'
    source=Path('C:/Windows/Fonts/NotoSerifSC-VF.ttf');f=TTFont(source);options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.recalc_timestamp=False
    cut=subset.Subsetter(options=options);cut.populate(text=text);cut.subset(f);instantiateVariableFont(f,{'wght':500},inplace=True,optimize=True)
    for key,value in {1:'Danmaku Spell Serif',2:'Medium',3:'DanmakuSpellSerif-v10-500',4:'Danmaku Spell Serif Medium',6:'DanmakuSpellSerif-Medium',16:'Danmaku Spell Serif',17:'Medium'}.items():
        f['name'].removeNames(nameID=key);f['name'].setName(value,key,3,1,0x409)
    if 'DSIG' in f:del f['DSIG']
    out=ROOT/'docs/danmaku/fonts/spell-serif-v10';out.mkdir(parents=True,exist_ok=True);f.flavor='woff2';target=out/'danmaku-spell-serif-500.woff2';f.save(target)
    assert set(map(ord,text))<=set(TTFont(target).getBestCmap())
    license_bytes=(ROOT/'docs/danmaku/fonts/spell-serif-v7/OFL.txt').read_bytes();(out/'OFL.txt').write_bytes(license_bytes)
    audit={**original,'characters':''.join(sorted(set(text))),'titleData':titles,'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target.read_bytes()),'sourceSha256':sha(source.read_bytes()),'licenseSha256':sha(license_bytes),'revision':10}
    (out/'source-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return target

def main():
    p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,default=ROOT/'tmp/danmaku/campaign-v10/candidate');args=p.parse_args()
    baseline=ROOT.parent/'output/天使弹幕祭/当前试玩/danmaku-campaign-easy-v9-offline.html'
    if not baseline.exists():baseline=ROOT.parent/'output/天使弹幕祭/历史版本/danmaku-campaign-easy-v9/danmaku-campaign-easy-v9-offline.html'
    before=baseline.read_bytes();assert sha(before)=='082205fae9f90313a2f6dfea667adbc5498da73bd82725b8dc152a2d45c6e93c'
    sources();target_font=font();html=before.decode('utf-8')
    html=replace(html,(C/'flow-v1.js').read_text(encoding='utf-8'),(C/'flow-v1.js').read_text(encoding='utf-8')+'\nwindow.DanmakuCampaignBase=window.DanmakuCampaign;')
    html=replace(html,(C/'spell-canvas-v8.js').read_text(encoding='utf-8'),(C/'spell-canvas-v10.js').read_text(encoding='utf-8'))
    # All new modules load before views capture the presentation helpers.
    additions=[S/'difficulty-normal-v1.js',S/'difficulty-hard-v1.js',S/'difficulties-v10.js',C/'difficulty-flow-v10.js',C/'spell-show-v10.js',P/'bullet-materials.js']
    html=replace(html,(C/'stage02-view-v8.js').read_text(encoding='utf-8'),'\n'.join(q.read_text(encoding='utf-8') for q in additions)+'\n'+(C/'stage02-view-v10.js').read_text(encoding='utf-8'))
    html=replace(html,(C/'stage01-view-v8.js').read_text(encoding='utf-8'),(C/'stage01-view-v10.js').read_text(encoding='utf-8'))
    html=replace(html,(C/'app-v9.js').read_text(encoding='utf-8'),(C/'app-v10.js').read_text(encoding='utf-8'))
    atlas='data:image/png;base64,'+base64.b64encode((P/'assets/projectile-atlas-v1.png').read_bytes()).decode()
    html=replace(html,'window.Stage02RefinedData=CampaignData.garden;', 'window.Stage02RefinedData=CampaignData.garden;CampaignData.projectileAtlas='+json.dumps(atlas)+';')
    html,n=re.subn(r'data:font/woff2;base64,[A-Za-z0-9+/=]+','data:font/woff2;base64,'+base64.b64encode(target_font.read_bytes()).decode(),html);assert n==1
    html=replace(html,'<h1>天使弹幕祭</h1><p>Easy · 星穹回廊 → 风铃花庭 · 两关符卡演出试玩 v9 · 素材优化</p>','<h1>天使弹幕祭</h1><p id="difficulty-heading">Normal · 星穹回廊 → 风铃花庭 · 两关试玩 v10</p>')
    html=html.replace('Easy · 两关连续试玩</p>','Normal · 两关连续试玩</p>')
    html=replace(html,'<h2>连续挑战</h2>', '<h2>难度</h2><div class="setting-row"><label class="settings-label" for="difficulty">开局前选择</label><select id="difficulty"><option value="easy">Easy · 已有两关</option><option value="normal" selected>Normal · 标准挑战</option><option value="hard">Hard · 高阶挑战</option></select></div><h2>连续挑战</h2>')
    html=replace(html,'<div class="setting-row"><label><input id="story-enabled"', '<h2>铃羽招式练习</h2><div class="practice-buttons"><button data-pattern="0" disabled>第一式 · 风廊</button><button data-pattern="1" disabled>第二式 · 花瓣</button><button data-pattern="2" disabled>第三式 · 铃声</button></div><div class="setting-row"><label><input id="story-enabled"')
    scripts=re.findall(r'<script>(.*?)</script>',html,re.S)
    subprocess.run(['node','-e','const vm=require("node:vm"),fs=require("node:fs");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    ids=re.findall(r'\bid="([^"]+)"',html);assert len(ids)==len(set(ids));assert set(re.findall(r"\$\('([^']+)'\)",(C/'app-v10.js').read_text(encoding='utf-8')))<=set(ids)
    assert not re.search(r'<(?:script|img|link)[^>]+(?:src|href)="https?://',html)
    args.output_dir.mkdir(parents=True,exist_ok=True);target=args.output_dir/'danmaku-campaign-v10-offline.html';payload=html.encode('utf-8');target.write_bytes(payload)
    paths=additions+[C/n for n in ['app-v10.js','stage02-view-v10.js','stage01-view-v10.js','spell-canvas-v10.js']]+[target_font,Path(__file__).resolve()]
    manifest={'version':10,'date':'2026-11-16','author':'小典 / Codex','prototypeCopyright':'(C) 2026 Carinoasd','difficulties':['easy','normal','hard'],'defaultDifficulty':'normal','baselineSha256':sha(before),'output':{'file':target.name,'bytes':len(payload),'sha256':sha(payload)},'rules':{'easy':'danmaku-campaign-easy-v5','normal':'danmaku-campaign-normal-v1','hard':'danmaku-campaign-hard-v1'},'presentationRevision':8,'assetLoadingRevision':9,'originalMusicUnchanged':True,'newArtGenerated':False,'ranked':False,'serverReplaySupported':False,'naturalFullClearTested':False,'sources':{q.relative_to(ROOT).as_posix():sha(q.read_bytes()) for q in paths}}
    (args.output_dir/'danmaku-campaign-v10-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');assert baseline.read_bytes()==before
    print(json.dumps({'status':'PASS',**manifest['output']},ensure_ascii=False))

if __name__=='__main__':main()
