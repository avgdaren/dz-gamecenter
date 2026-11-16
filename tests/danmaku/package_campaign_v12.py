"""(C) 2026 Carinoasd. Death recovery and elite stay feedback: 小典 / Codex."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[2];C=ROOT/'source/plugin/gamecenter/games/_danmaku_campaign_draft';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def replace(text,old,new):assert text.count(old)==1,(old[:80],text.count(old));return text.replace(old,new)
def main():
    p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,default=ROOT/'tmp/danmaku/campaign-v12/candidate');args=p.parse_args()
    baseline=ROOT.parent/'output/天使弹幕祭/当前试玩/danmaku-campaign-v11-offline.html'
    if not baseline.exists():baseline=ROOT.parent/'output/天使弹幕祭/历史版本/danmaku-campaign-v11/danmaku-campaign-v11-offline.html'
    if not baseline.exists():
        rebuilt=ROOT/'tmp/danmaku/campaign-v12/baseline';subprocess.run([sys.executable,str(ROOT/'tests/danmaku/package_handoff_v3.py'),'--output-dir',str(rebuilt)],check=True);baseline=rebuilt/'danmaku-campaign-v11-offline.html'
    assert sha(baseline)=='b2a7a0c4e0420b65a15fa0c6bc7da0de87ffc3fd8bf956fa90f8490cd366d5ee'
    app=(C/'app-v11.js').read_text(encoding='utf-8');app=app.replace('两关试玩 v11 · 小怪耐久修正','两关试玩 v12 · 复归与精英停留')
    app=replace(app,"session.sim.tick<session.sim.bombCooldownUntil;", "session.sim.tick<session.sim.bombCooldownUntil||DanmakuRecovery.hidden(session.sim);")
    app=replace(app,"session.assisted=true;session.saveBoss();}storyPreview=false;", "DanmakuCampaignDifficulties.prepareFlow(session.current,2);session.assisted=true;session.saveBoss();}storyPreview=false;")
    app=replace(app,"var fade=session.state==='handoff'?", "var fade=session.sim.recovery&&session.sim.recovery.terminal?Math.max(0,1-session.sim.recovery.age/36):session.state==='handoff'?")
    # Limited review hooks never drive normal play and always mark the record assisted.
    app=replace(app,"redraw:function(){stamp='';draw();return this.inspect();},", "redraw:function(){stamp='';draw();return this.inspect();},\n  recoveryFixture:function(number,terminal){fixture();reset('boss'+number);var f=session.current;f.stage='active';f.sim.player.x=f.sim.player.px=160*64;f.sim.player.y=f.sim.player.py=440*64;f.sim.player.lives=terminal?1:3;f.sim.player.invulUntil=0;f.sim.spawn(f.sim.player.x,f.sim.player.y,128,0,4,480,3);session.step({dx:0,dy:0,flags:0});return renderFixture();},\n  recoveryModel:function(){return DanmakuRecovery.model(session.sim);},")
    (C/'app-v12.js').write_text(app,encoding='utf-8',newline='\n')
    first=(C/'stage01-view-v10.js').read_text(encoding='utf-8');first=replace(first,"if(invulnerable)circle", "if(invulnerable&&!s.recovery)circle")
    first=replace(first,"if(s.testInvincible||!invulnerable||s.tick%12<8)root.DanmakuPlayerView.sprite(ctx,images.player,p,f.tick);root.DanmakuPlayerView.hitpoint(ctx,p,focused);", "root.DanmakuRecoveryView.draw(ctx,images.player,s,f,reduced,focused,s.testInvincible||!invulnerable||s.tick%12<8);")
    (C/'stage01-view-v12.js').write_text(first,encoding='utf-8',newline='\n')
    second=(C/'stage02-view-v10.js').read_text(encoding='utf-8');second=replace(second,"root.DanmakuPlayerView.sprite(ctx,images.player,s.player,reduced?0:flow.tick);root.DanmakuPlayerView.hitpoint(ctx,s.player,focused);", "root.DanmakuRecoveryView.draw(ctx,images.player,s,flow,reduced,focused);")
    (C/'stage02-view-v12.js').write_text(second,encoding='utf-8',newline='\n')
    html=baseline.read_text(encoding='utf-8');added=[C/name for name in ['player-recovery-v12.js','elite-stay-v12.js','feedback-flow-v12.js','recovery-view-v12.js']]
    html=replace(html,(C/'stage01-view-v10.js').read_text(encoding='utf-8'),(C/'stage01-view-v12.js').read_text(encoding='utf-8'))
    html=replace(html,(C/'stage02-view-v10.js').read_text(encoding='utf-8'),(C/'stage02-view-v12.js').read_text(encoding='utf-8'))
    html=replace(html,(C/'app-v11.js').read_text(encoding='utf-8'),'\n'.join(p.read_text(encoding='utf-8') for p in added)+'\n'+app)
    html=html.replace('两关试玩 v11 · 小怪耐久修正</p>','两关试玩 v12 · 复归与精英停留</p>')
    scripts=re.findall(r'<script>(.*?)</script>',html,re.S);subprocess.run(['node','-e','const fs=require("node:fs"),vm=require("node:vm");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    args.output_dir.mkdir(parents=True,exist_ok=True);target=args.output_dir/'danmaku-campaign-v12-offline.html';target.write_text(html,encoding='utf-8',newline='\n')
    manifest={'version':12,'date':'2026-11-16','baselineSha256':sha(baseline),'output':{'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target)},'rules':{'easy':'danmaku-campaign-easy-v6','normal':'danmaku-campaign-normal-v3','hard':'danmaku-campaign-hard-v3'},'deathDelayTicks':36,'returnProtectionTicks':240,'eliteExtraTicks':180,'originalAssetsMusicUnchanged':True,'naturalFullClearTested':False,'ranked':False,'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in added+[C/'app-v12.js',C/'stage01-view-v12.js',C/'stage02-view-v12.js',Path(__file__).resolve()]}}
    (args.output_dir/'danmaku-campaign-v12-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':'PASS',**manifest['output']}))
if __name__=='__main__':main()
