"""(C) 2026 Carinoasd. Lossless media, original-byte music and staged forum delivery: 小典 / Codex."""
from pathlib import Path
import json,re,base64,hashlib,shutil
import argparse
root=Path(__file__).resolve().parents[2];parser=argparse.ArgumentParser();parser.add_argument('--forum-root',type=Path,required=True);parser.add_argument('--output-dir',type=Path,default=root.parent/'output/天使弹幕祭/资源优化候选');parser.add_argument('--campaign-html',type=Path);args=parser.parse_args();tmp=root/'tmp/danmaku/asset-optimization-v1';out=args.output_dir;out.mkdir(parents=True,exist_ok=True);forum=args.forum_root;baseline=args.campaign_html or root.parent/'output/天使弹幕祭/当前试玩/danmaku-campaign-easy-v8-offline.html';baseline=baseline if baseline.exists() else root.parent/'output/天使弹幕祭/历史版本/danmaku-campaign-easy-v8/danmaku-campaign-easy-v8-offline.html';delivery=out/'论坛接入候选/games';delivery.mkdir(parents=True,exist_ok=True)
previous=out/'forum-candidate-MANIFEST.json'
if previous.exists():
 for relative in json.loads(previous.read_text(encoding='utf-8'))['files']:
  owned=(delivery/relative).resolve();assert owned.is_relative_to(delivery.resolve())
  if owned.is_file():owned.unlink()
manifest=json.loads((root/'docs/danmaku/assets-lossless-v1/MANIFEST.json').read_text(encoding='utf-8'));sha=lambda b:hashlib.sha256(b).hexdigest();audit={'files':{},'baseline':{},'music':{}}
for game in ['angel_danmaku','angel_danmaku_normal']:
 dest=delivery/game;dest.mkdir(exist_ok=True)
 for p in (forum/game).rglob('*'):
  if not p.is_file():continue
  rel=p.relative_to(forum/game)
  if 'assets' in rel.parts:continue
  if p.name=='bgm-bank.js':continue
  target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target);audit['baseline'][game+'/'+rel.as_posix()]=sha(p.read_bytes())
for key in ['angel_danmaku','angel_danmaku_normal']:
 p=delivery/key/'game.json';meta=json.loads(p.read_text(encoding='utf-8-sig'));meta['version']='0.2.2';p.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assetdir=delivery/'angel_danmaku/assets';assetdir.mkdir(exist_ok=True);mapping={}
for old,digest in manifest['mapping'].items():
 if not old.startswith('forum/'):continue
 row=manifest['images'][digest];name=old.split('/',1)[1];shutil.copyfile(root/'docs/danmaku/assets-lossless-v1'/row['file'],assetdir/row['file']);mapping[name]=row['file']
for game in ['angel_danmaku','angel_danmaku_normal']:
 for p in (delivery/game).rglob('*'):
  if p.is_file() and p.suffix in ['.js','.css']:
   t=p.read_text(encoding='utf-8-sig')
   for old,new in mapping.items():t=t.replace(old,new)
   if p.name=='game.js' and game=='angel_danmaku':t=t.replace("'midi.js', 'audio.js'", "'midi.js', 'audio.js', 'audio-lazy-v1.js'");t=t.replace("var ENTRY =", "var ENTRY_SCRIPT=(document.currentScript&&document.currentScript.src)||'';\n  var ENTRY =",1);t=t.replace("var scriptSrc = (self && self.src) ? self.src : '';", "var scriptSrc = ENTRY_SCRIPT;")
   p.write_text(t,encoding='utf-8',newline='\n')
shutil.copyfile(root/'source/plugin/gamecenter/games/_danmaku_assets_v1/audio-lazy-v1.js',delivery/'angel_danmaku/lib/audio-lazy-v1.js')
bank=(forum/'angel_danmaku/lib/bgm-bank.js').read_text(encoding='utf-8-sig');audit['baseline']['angel_danmaku/lib/bgm-bank.js']=sha((forum/'angel_danmaku/lib/bgm-bank.js').read_bytes());audit['sourceAssets']={p.name:sha(p.read_bytes()) for p in (forum/'angel_danmaku/assets').glob('*.png')};data=json.loads(re.search(r'=\s*(\{.*\})\s*;?',bank,re.S).group(1));media=delivery/'angel_danmaku/media';media.mkdir(exist_ok=True)
for key,row in data['entries'].items():
 b=base64.b64decode(row.pop('data'));digest=sha(b);name='audio-'+digest[:20]+'.mp3';(media/name).write_bytes(b);row['url']='__BASE__media/'+name;row['sha256']=digest;audit['music'][key]={'sha256':digest,'bytes':len(b),'sameOriginalMp3Bytes':True}
metadata=json.dumps(data,ensure_ascii=False,separators=(',',':'));(delivery/'angel_danmaku/lib/bgm-bank.js').write_text('/* (C) 2026 Carinoasd. Original-byte music manifest: 小典 / Codex. */\nwindow.DanmakuBgmBank='+metadata+';Object.values(DanmakuBgmBank.entries).forEach(function(e){e.url=e.url.replace("__BASE__",window.__DANMAKU_FORUM__.base);});\n',encoding='utf-8')
# A stable media manifest permits shared cache across Easy and Normal without changing any gkey/rule/submit code.
references='\n'.join(p.read_text(encoding='utf-8') for p in delivery.rglob('*') if p.is_file() and p.suffix in ['.js','.css','.json'])
audit['omittedUnusedAssetFiles']=[]
for p in assetdir.iterdir():
 if p.is_file() and p.name not in references:audit['omittedUnusedAssetFiles'].append(p.name);p.unlink()
for p in delivery.rglob('*'):
 if p.is_file():audit['files'][p.relative_to(delivery).as_posix()]={'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
(out/'forum-candidate-MANIFEST.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'forumFiles':len(audit['files']),'forumBytes':sum(x['bytes'] for x in audit['files'].values()),'bgmMetadataBytes':(delivery/'angel_danmaku/lib/bgm-bank.js').stat().st_size,'musicBytes':sum(x['bytes'] for x in audit['music'].values())}))
# Offline v9 keeps embedded original MP3s, with smaller images and the same lazy audio implementation.
c=root/'source/plugin/gamecenter/games/_danmaku_campaign_draft';app=(c/'app-v8.js').read_text(encoding='utf-8');app=app.replace("previewSpeed=1,dialogueView", "previewSpeed=1,nextStagePrepared=false,dialogueView")
app=app.replace("audio.map(function(a){return a.gesture();})", "audio.map(function(a,i){return a.gesture({unlockOnly:i!==session.stageNumber-1});})")
app=app.replace("audio[activeAudio].pause();activeAudio=index;", "audio[activeAudio].pause();if(selection==='campaign')audio[activeAudio].dispose();activeAudio=index;")
app=app.replace("var index=session.stageNumber-1;if(activeAudio", "if(selection==='campaign'&&session.stageNumber===1&&session.current.phaseIndex===2&&!nextStagePrepared&&settings.music&&!settings.muted){nextStagePrepared=true;audio[1].prepare(['stage']).then(function(ok){if(!ok)nextStagePrepared=false;});}var index=session.stageNumber-1;if(activeAudio")
app=app.replace("function reset(value){selection=value;", "function reset(value){nextStagePrepared=false;selection=value;")
(c/'app-v9.js').write_text(app,encoding='utf-8',newline='\n')
html=baseline.read_text(encoding='utf-8');data=json.loads(re.search(r'window.CampaignData=(.*?);window.Stage02RefinedData=',html,re.S).group(1))
for group,rows in [('first',data['firstAssets']),('garden',data['garden']['assets'])]:
 for key,uri in rows.items():
  row=manifest['images'][manifest['mapping'][group+'/'+key]];p=root/'docs/danmaku/assets-lossless-v1'/row['file'];mime='image/webp' if p.suffix=='.webp' else 'image/png';rows[key]='data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
html=re.sub(r'window.CampaignData=(.*?);window.Stage02RefinedData=',lambda m:'window.CampaignData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';window.Stage02RefinedData=',html,count=1,flags=re.S)
html=html.replace((c/'app-v8.js').read_text(encoding='utf-8'),(root/'source/plugin/gamecenter/games/_danmaku_assets_v1/audio-lazy-v1.js').read_text(encoding='utf-8')+'\n'+app)
assert 'unlockOnly:i!==' in html and 'assetLoadingVersion:1' in html
html=html.replace('两关符卡演出试玩 v8','两关符卡演出试玩 v9 · 素材优化');p=out/'danmaku-campaign-easy-v9-offline.html';p.write_text(html,encoding='utf-8',newline='\n');(out/'campaign-v9-MANIFEST.json').write_text(json.dumps({'version':9,'rule':'danmaku-campaign-easy-v5','bytes':p.stat().st_size,'sha256':sha(p.read_bytes()),'originalMp3Unchanged':True,'imageRgbaIdentical':True,'combatBaseline':'v8','baselineHtmlSha256':sha(baseline.read_bytes()),'sourceHashes':{str(q.relative_to(root)).replace('\\','/'):sha(q.read_bytes()) for q in [c/'app-v9.js',root/'source/plugin/gamecenter/games/_danmaku_assets_v1/audio-lazy-v1.js',root/'docs/danmaku/assets-lossless-v1/MANIFEST.json',Path(__file__).resolve(),root/'tests/danmaku/prepare_lossless_assets_v1.py']}},indent=2)+'\n',encoding='utf-8');print(json.dumps({'offlineBytes':p.stat().st_size,'sha256':sha(p.read_bytes())}))
