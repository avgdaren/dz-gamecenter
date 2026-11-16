"""(C) 2026 Carinoasd. Visible conclusion and single-portrait title: 小典 / Codex."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[2];C=ROOT/'source/plugin/gamecenter/games/_danmaku_campaign_draft'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def replace(s,old,new):assert s.count(old)==1,(old[:100],s.count(old));return s.replace(old,new)
def main():
 p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,default=ROOT/'tmp/danmaku/campaign-v14/candidate');p.add_argument('--baseline',type=Path);args=p.parse_args()
 base=args.baseline or ROOT.parent/'output/天使弹幕祭/当前试玩/danmaku-campaign-v13-offline.html'
 if not base.exists():base=ROOT.parent/'output/天使弹幕祭/历史版本/danmaku-campaign-v13/danmaku-campaign-v13-offline.html'
 assert sha(base)=='3a182c47920d418bbf6e118f39e8afef6626a5afb74a73d8fd861790a87f47e6'
 html=base.read_text(encoding='utf-8');app=(C/'app-v13.js').read_text(encoding='utf-8')
 app=replace(app,"$('game-root').dataset.screen=mode==='ready'&&selection==='campaign'?'title':'play';", "$('game-root').dataset.screen=mode==='over'?'result':mode==='ready'&&selection==='campaign'?'title':'play';$('endcard').hidden=mode!=='over';")
 app=replace(app,"$('title-art').src=data.firstAssets.title;$('title-companion').src=data.titleCompanion;", "$('title-art').src=data.firstAssets.title;$('ending-art').src=data.firstAssets.title;")
 app=replace(app,"function finish(){mode='over';", "function ending(){var success=session.status==='clear',complete=success&&selection==='campaign'&&session.summary().completedStages===2;$('endcard').dataset.outcome=complete?'continued':success?'practice':'failed';$('ending-eyebrow').textContent=complete?'TWO CHAPTERS CLEAR':success?'PRACTICE COMPLETE':'JOURNEY RECORD';$('ending-title').textContent=complete?'未完待续':success?'练习完成':session.status==='dead'?'旅程暂歇':'挑战结束';$('ending-english').textContent=complete?'TO BE CONTINUED':success?'WELL PLAYED':'UNTIL WE MEET AGAIN';$('ending-message').textContent=complete?'风铃渐息，星光仍在前方。\\n下一站 · 云渊断层，敬请期待。':success?'本次练习已完成，下一次星幕中再会。':session.status==='dead'?'此刻的足迹，留待下一次出发。':'本次挑战已结束，可以重新出发。';$('ending-restart').textContent=selection==='campaign'?'再挑战一次':'重新练习';$('ending-retry-stage').hidden=!(!success&&session.stageNumber===2&&session.stageCheckpoint);$('ending-retry-boss').hidden=!(!success&&session.bossCheckpoint);$('ending-note').textContent=(session.assisted?'练习／辅助记录 · ':'')+'本局得分暂不计入排行榜';$('cover').hidden=true;$('play-settings').open=false;stamp='';draw();$('endcard').scrollIntoView({block:'nearest'});$('ending-title-button').focus({preventScroll:true});}\n function finish(){mode='over';")
 app=replace(app,"results();$('status').textContent='本局结束 · 本地试玩，不计排行榜。';", "results();ending();$('status').textContent='本局结束 · 暂不计排行榜。';")
 app=replace(app,"function retry(kind){", "$('ending-restart').addEventListener('click',function(){start(selection,true);});$('ending-title-button').addEventListener('click',function(){$('title').click();});$('ending-retry-stage').addEventListener('click',function(){retry('retryStage2');});$('ending-retry-boss').addEventListener('click',function(){retry('retryBoss');});\n function retry(kind){")
 (C/'app-v14.js').write_text(app,encoding='utf-8',newline='\n');html=replace(html,(C/'app-v13.js').read_text(encoding='utf-8'),app)
 html=replace(html,(C/'title-shell-v13.css').read_text(encoding='utf-8'),(C/'front-screens-v14.css').read_text(encoding='utf-8'))
 html=html.replace('title-scenery-v13','title-scenery-v14');html=replace(html,'<img id="title-companion" alt="">','')
 html=re.sub(r'CampaignData\.titleCompanion="data:image/png;base64,[^"]+";','',html)
 results=re.search(r'<section id="results".*?</section>',html,re.S).group();html=replace(html,results,'')
 results=results.replace('<h2 id="result-kind">本局记录</h2>','<h3 id="result-kind">本局记录</h3>').replace('本局用时（含重试）','用时').replace('试玩分','得分')
 results=replace(results,'<table>','<details class="ending-details"><summary>关卡与计分明细</summary><table>')
 results=replace(results,'<small>本局得分不计排行榜。本次挑战包含两关。</small><details><summary>查看分项</summary><pre id="result-details"></pre></details>','<pre id="result-details"></pre></details>')
 endcard='<section id="endcard" class="ending-panel" hidden aria-labelledby="ending-title" tabindex="-1"><div class="ending-sky" aria-hidden="true"></div><img id="ending-art" alt="" aria-hidden="true"><div class="ending-content"><span id="ending-eyebrow" class="ending-eyebrow">TWO CHAPTERS CLEAR</span><h2 id="ending-title">未完待续</h2><p id="ending-english" class="ending-english">TO BE CONTINUED</p><p id="ending-message">下一站 · 云渊断层，敬请期待。</p>'+results+'<div class="ending-actions"><button id="ending-restart" class="primary">再挑战一次</button><button id="ending-title-button">返回标题</button><button id="ending-retry-stage" hidden>从第二关重试</button><button id="ending-retry-boss" hidden>从Boss重试</button></div><p id="ending-note">本局得分暂不计入排行榜</p></div></section>'
 html=replace(html,'</div></div></div>\n<div class="arena-controls">','</div></div>'+endcard+'</div>\n<div class="arena-controls">')
 scripts=re.findall(r'<script>(.*?)</script>',html,re.S);subprocess.run(['node','-e','const fs=require("node:fs"),vm=require("node:vm");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
 ids=re.findall(r'\bid="([^"]+)"',html);assert len(ids)==len(set(ids));assert set(re.findall(r"\$\('([^']+)'\)",app))<=set(ids)
 args.output_dir.mkdir(parents=True,exist_ok=True);target=args.output_dir/'danmaku-campaign-v14-offline.html';target.write_text(html,encoding='utf-8',newline='\n')
 manifest={'version':14,'date':'2026-11-16','baselineSha256':sha(base),'output':{'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target)},'combatBaseline':'v12','rules':{'easy':'danmaku-campaign-easy-v6','normal':'danmaku-campaign-normal-v3','hard':'danmaku-campaign-hard-v3'},'changes':['independent visible endcard with actual summary','single original portrait title without pixel companion'],'newArtGenerated':False,'naturalFullClearTested':False,'forumInstalled':False,'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in [C/'app-v14.js',C/'front-screens-v14.css',Path(__file__).resolve()]}}
 (args.output_dir/'danmaku-campaign-v14-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':'PASS',**manifest['output']}))
if __name__=='__main__':main()
