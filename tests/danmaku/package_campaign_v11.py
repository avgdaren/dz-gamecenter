"""(C) 2026 Carinoasd. Stage 1 common durability correction: 小典 / Codex."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[2];C=ROOT/'source/plugin/gamecenter/games/_danmaku_campaign_draft'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=ROOT/'tmp/danmaku/campaign-v11/candidate');args=parser.parse_args()
    baseline=ROOT.parent/'output/天使弹幕祭/当前试玩/danmaku-campaign-v10-offline.html'
    if not baseline.exists():baseline=ROOT.parent/'output/天使弹幕祭/历史版本/danmaku-campaign-v10/danmaku-campaign-v10-offline.html'
    assert sha(baseline)=='8ee02c8220c9daa4c6f61c98dd947d660801ad0b7d7faf411b17185947076bf4'
    html=baseline.read_text(encoding='utf-8');old=(C/'app-v10.js').read_text(encoding='utf-8');app=old.replace('两关试玩 v10','两关试玩 v11 · 小怪耐久修正');assert app!=old
    (C/'app-v11.js').write_text(app,encoding='utf-8',newline='\n');assert html.count(old)==1
    html=html.replace(old,(C/'difficulty-flow-v11.js').read_text(encoding='utf-8')+'\n'+app)
    html=html.replace('两关试玩 v10</p>','两关试玩 v11 · 小怪耐久修正</p>')
    scripts=re.findall(r'<script>(.*?)</script>',html,re.S)
    subprocess.run(['node','-e','const vm=require("node:vm"),fs=require("node:fs");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    extract=lambda s:json.loads(re.search(r'window.CampaignData=(.*?);window.Stage02RefinedData=',s,re.S).group(1))
    assert extract(html)==extract(baseline.read_text(encoding='utf-8'))
    args.output_dir.mkdir(parents=True,exist_ok=True);target=args.output_dir/'danmaku-campaign-v11-offline.html';target.write_text(html,encoding='utf-8',newline='\n')
    manifest={'version':11,'date':'2026-11-16','author':'小典 / Codex','prototypeCopyright':'(C) 2026 Carinoasd','baselineSha256':sha(baseline),'rules':{'easy':'danmaku-campaign-easy-v5','normal':'danmaku-campaign-normal-v2','hard':'danmaku-campaign-hard-v2'},'stage01MobHP':[1,128,450],'onlyCombatChange':'Stage 1 Normal/Hard enemy HP 32/90/360 -> shared 1/128/450','originalArtMusicFontAndSecondStageUnchanged':True,'output':{'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target)},'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in [C/'difficulty-flow-v11.js',C/'app-v11.js',Path(__file__).resolve()]},'ranked':False,'serverReplaySupported':False,'naturalFullClearTested':False}
    (args.output_dir/'danmaku-campaign-v11-MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'status':'PASS',**manifest['output']}))
if __name__=='__main__':main()
