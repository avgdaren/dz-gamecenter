"""(C) 2026 Carinoasd. Restore the shipped title on v12 combat: 小典 / Codex."""
from pathlib import Path
import argparse,base64,hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[2];C=ROOT/'source/plugin/gamecenter/games/_danmaku_campaign_draft';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def replace(text,old,new):assert text.count(old)==1,(old[:90],text.count(old));return text.replace(old,new)
def main():
    p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,default=ROOT/'tmp/danmaku/campaign-v13/candidate');args=p.parse_args();baseline=ROOT.parent/'output/天使弹幕祭/当前试玩/danmaku-campaign-v12-offline.html'
    if not baseline.exists():baseline=ROOT.parent/'output/天使弹幕祭/历史版本/danmaku-campaign-v12/danmaku-campaign-v12-offline.html'
    assert sha(baseline)=='6a8220cc13b106eed2bd89d0e4cf90b4ec12bce1bde4efaf0e25e6f2e47cd3fe'
    app=(C/'app-v12.js').read_text(encoding='utf-8');app=replace(app,"function controls(){var f=session.current", "function controls(){$('game-root').dataset.screen=mode==='ready'&&selection==='campaign'?'title':'play';document.querySelectorAll('[data-title-difficulty]').forEach(function(b){b.disabled=!ready||mode!=='ready';b.setAttribute('aria-pressed',String(b.dataset.titleDifficulty===difficulty));});if(mode==='ready'&&selection==='campaign'){$('cover-text').textContent='星穹回廊 → 风铃花庭';$('continue').textContent='开始游戏';}var f=session.current")
    app=app.replace("两关试玩 v12 · 复归与精英停留", "两关挑战")
    app=app.replace("两关连续试玩 · ","连续挑战 · ").replace("练习／重试记录 · ","练习记录 · ")
    app=replace(app,"function retry(kind)", "document.querySelectorAll('[data-title-difficulty]').forEach(function(b){b.addEventListener('click',function(){if(mode!=='ready')return;$('difficulty').value=this.dataset.titleDifficulty;$('difficulty').dispatchEvent(new Event('change',{bubbles:true}));});});$('title-settings').addEventListener('click',function(){var panel=$('play-settings');panel.open=true;panel.scrollIntoView({block:'start',behavior:'smooth'});});\n function retry(kind)")
    app=replace(app,"$('title-art').src=data.firstAssets.title;", "$('title-art').src=data.firstAssets.title;$('title-companion').src=data.titleCompanion;")
    (C/'app-v13.js').write_text(app,encoding='utf-8',newline='\n');html=baseline.read_text(encoding='utf-8');html=replace(html,(C/'app-v12.js').read_text(encoding='utf-8'),app)
    css=(C/'title-shell-v13.css').read_text(encoding='utf-8');html=replace(html,'</style></head>',css+'\n</style></head>')
    html=replace(html,'<main class="revision">','<main id="game-root" class="revision" data-screen="title">')
    old='<div class="cover title-cover" id="cover"><img id="title-art" class="title-figure" alt=""><div>'
    new='<div class="cover title-cover" id="cover"><div class="title-scenery-v13" aria-hidden="true"><div class="title-constellation"></div><div class="title-orbit"></div><img id="title-art" alt=""><img id="title-companion" alt=""></div><div class="title-card">'
    html=replace(html,old,new)
    buttons='<div class="title-difficulties" role="group" aria-label="选择难度">'+''.join('<button type="button" data-title-difficulty="'+key+'" aria-pressed="'+('true' if key=='normal' else 'false')+'"><span>'+label+'</span><small>'+detail+'</small></button>' for key,label,detail in [('easy','Easy','初阶'),('normal','Normal','进阶'),('hard','Hard','高阶')])+'</div>'
    html=replace(html,'<button id="continue" class="primary" disabled>',buttons+'<button id="continue" class="primary" disabled>')
    html=replace(html,'<small>自动射击 · 方向键移动 · X大招</small>','<button id="title-settings" type="button">设置与改键</button><small class="title-footnote">自动射击 · 移动躲弹 · 暂不计榜</small>')
    summary=re.search(r'<div class="journey-summary">.*?</div>',html,re.S).group(0)
    html=replace(html,summary,'')
    metrics='<div class="campaign-metrics"><span id="record-note">连续挑战 · Normal</span><span id="journey-progress">0 / 2 关已突破</span><span>得分 <strong id="live-score">0</strong></span></div>'
    html=replace(html,'<div class="boss-health">',metrics+'<div class="boss-health">')
    html=replace(html,'<aside class="side-panel">','</div><details id="play-settings" class="drawer game-settings"><summary>设置与改键</summary><aside class="side-panel"><details class="practice-drawer"><summary>练习与回看</summary>')
    html=replace(html,'<h2>声音与操作</h2>','</details><h2>声音与操作</h2>')
    html=replace(html,'</aside></div><footer>','</aside></details><footer>')
    html=replace(html,'<h2>难度</h2><div class="setting-row">','<h2 class="internal-difficulty">难度</h2><div class="setting-row internal-difficulty">')
    html=html.replace('累计试玩分','本局得分').replace('第二关采用临时试玩计分；本页不计排行榜。当前为两关试玩完成。','本局得分不计排行榜。本次挑战包含两关。').replace('两关离线试玩 · 不计榜。','两关挑战 · 暂不计榜。')
    companion=ROOT/'source/plugin/gamecenter/games/_danmaku_proto/assets/player-front-display-v1.png';uri='data:image/png;base64,'+base64.b64encode(companion.read_bytes()).decode()
    html=replace(html,'window.Stage02RefinedData=CampaignData.garden;','window.Stage02RefinedData=CampaignData.garden;CampaignData.titleCompanion='+json.dumps(uri)+';')
    scripts=re.findall(r'<script>(.*?)</script>',html,re.S);subprocess.run(['node','-e','const fs=require("node:fs"),vm=require("node:vm");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    ids=re.findall(r'\bid="([^"]+)"',html);assert len(ids)==len(set(ids));assert set(re.findall(r"\$\('([^']+)'\)",app))<=set(ids)
    args.output_dir.mkdir(parents=True,exist_ok=True);target=args.output_dir/'danmaku-campaign-v13-offline.html';target.write_text(html,encoding='utf-8',newline='\n')
    manifest={'version':13,'date':'2026-11-16','baselineSha256':sha(baseline),'output':{'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target)},'rules':{'easy':'danmaku-campaign-easy-v6','normal':'danmaku-campaign-normal-v3','hard':'danmaku-campaign-hard-v3'},'combatBaseline':'v12','titleReference':'previous shipped illustrated title, existing source assets and CSS composition','newArtGenerated':False,'naturalFullClearTested':False,'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in [C/'app-v13.js',C/'title-shell-v13.css',companion,Path(__file__).resolve()]}}
    (args.output_dir/'danmaku-campaign-v13-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':'PASS',**manifest['output']}))
if __name__=='__main__':main()
