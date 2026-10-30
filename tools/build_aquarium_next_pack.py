#!/usr/bin/env python3
"""Author GPT / Codex; original plugin (C) 2026 Carinoasd.
Offline art/data candidate exporter. No live config or server changes.
"""
from pathlib import Path
from fractions import Fraction
import argparse,copy,hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/aquarium/next-pack-v1'
ASSETS=ROOT/'source/plugin/gamecenter/games/aquarium/assets/fish-next/v1'
NEW=[
 dict(id='pond_curl_seahorse',name='卷尾海马',index=13,water='pond',rarity='少见',description='尾巴总卷成一个小问号，慢慢巡视水草的边缘。',weight=204,coins=2,motion='upright_hover',facing='right',size_axis='height',size_ratio=.18),
 dict(id='pond_bell_jelly',name='铃伞水母',index=14,water='pond',rarity='稀有',description='小伞轻轻收拢，像一枚在水里缓慢摇响的铃。',weight=96,coins=4,motion='vertical_pulse',facing='near-front',size_axis='height',size_ratio=.19),
 dict(id='bay_gummy_octopus',name='软糖章鱼',index=15,water='bay',rarity='少见',description='八只小腕轻轻一抱，仿佛整团软糖都浮了起来。',weight=247,coins=4,motion='low_glide',facing='near-front-right',size_axis='width',size_ratio=.12),
 dict(id='bay_moon_mermaid',name='月汐人鱼',index=16,water='bay',rarity='珍奇',description='长发随水流轻轻舒展，像把月色带进了浅湾。',weight=53,coins=10,motion='horizontal_glide',facing='right',size_axis='width',size_ratio=.20),
]
def write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--baseline',required=True);args=p.parse_args()
 baseline=json.loads(Path(args.baseline).read_text(encoding='utf-8'));d=copy.deepcopy(baseline);c=d['config']
 d['author']='GPT / Codex; original plugin (C) 2026 Carinoasd';d['status']='candidate-not-active';d['next_pack_note']='Offline proposal only; old runtime content is not replaced.'
 c['version']='aquarium-content-next-candidate-v1'
 for water in c['waters'].values():
  for fish in water['fish'].values():fish['weight']*=27
 for x in NEW:
  d['fish'][x['id']]={k:x[k] for k in ['name','index','water','rarity','description']}
  c['waters'][x['water']]['fish'][x['id']]={k:x[k] for k in ['weight','coins']}
 for water in c['waters'].values():water['fish']=dict(sorted(water['fish'].items()))
 c['waters']=dict(sorted(c['waters'].items()))
 canonical='aquarium-pools-v1\n'+''.join(w+'\t'+fid+'\t'+str(f['weight'])+'\n' for w,v in c['waters'].items() for fid,f in v['fish'].items())
 c['pool_hash']=hashlib.sha256(canonical.encode()).hexdigest()
 c['config_hash']=hashlib.sha256(json.dumps({k:v for k,v in c.items() if k!='config_hash'},separators=(',',':'),ensure_ascii=True).encode()).hexdigest()
 write(DOC/'content-next-candidate.json',d);write(DOC/'baseline-content-reference.json',baseline)
 ASSETS.mkdir(parents=True,exist_ok=True)
 manifest=dict(schema='aquarium-fish-next-assets-v1',author=d['author'],status='candidate-not-active',baseline_commit='44a2582c85a7982ee7e1cedc335ed3ea241a0c87',runtime_integration=False,animation_frames_generated=False,items=[])
 for x in NEW:
  source=DOC/'masters'/(x['id']+'.png');im=Image.open(source).convert('RGBA');bbox=im.getchannel('A').getbbox()
  if bbox is None:raise ValueError('empty source')
  cropped=im.crop(bbox);files={}
  for kind,side,pad in [('sprite',512,32),('mobile',256,16),('icon',128,8),('silhouette',128,8)]:
   scale=(side-2*pad)/max(cropped.size);size=tuple(max(1,round(v*scale)) for v in cropped.size);image=cropped.resize(size,Image.Resampling.LANCZOS)
   if kind=='silhouette':
    solid=Image.new('RGBA',image.size,(27,55,76,0));solid.putalpha(image.getchannel('A'));image=solid
   canvas=Image.new('RGBA',(side,side));canvas.alpha_composite(image,((side-size[0])//2,(side-size[1])//2))
   dest=ASSETS/(x['id']+'_'+kind+'.webp');canvas.save(dest,'WEBP',lossless=True,method=6)
   files[kind]=dict(file=dest.name,width=side,height=side,bytes=dest.stat().st_size,sha256=sha(dest),visible_bbox=list(canvas.getchannel('A').getbbox()))
  manifest['items'].append(dict(**x,source_size=list(im.size),source_alpha_bbox=list(bbox),source_sha256=sha(source),files=files,alpha_review='flat light/dark composite visually reviewed; full scene, anatomy and small-scale readability still require acceptance',animation='single-texture static candidate only'))
 write(ASSETS/'manifest.json',manifest)
 report=dict(author=d['author'],status='offline-candidate-analysis',waters={},normal_expectation_exact_preserved=True,old_species_absolute_probability_multiplier='9/10',pity_threshold_unchanged=80,pity_expectation_not_proven_equal=True,optional_bonus_per_rolling_24h=180,reward_features_enabled=False)
 for w,water in c['waters'].items():
  old=baseline['config']['waters'][w]['fish'];pool=water['fish'];oldE=Fraction(sum(f['weight']*f['coins'] for f in old.values()),sum(f['weight'] for f in old.values()));total=sum(f['weight'] for f in pool.values());E=Fraction(sum(f['weight']*f['coins'] for f in pool.values()),total);assert E==oldE
  report['waters'][w]=dict(fish_count=len(pool),weight_total=total,old_expected_coins_per_catch=str(oldE),new_expected_coins_per_catch=str(E),new_fish=[dict(id=x['id'],weight=x['weight'],normal_probability=str(Fraction(x['weight'],total)),coins=x['coins']) for x in NEW if x['water']==w],levels={})
  for level,period in enumerate(c['periods_ms']):
   perday=E*Fraction(86400000,period);report['waters'][w]['levels'][str(level)]=dict(period_ms=period,normal_coins_24h=float(perday),optional_bonus_limit=180,bonus_ratio_percent=float(Fraction(180,1)/perday*100))
 write(DOC/'economy-reference.json',report)
 policy=dict(schema='aquarium-care-reward-research-v1',author=d['author'],status='research-not-active',feeding_animation_enabled=False,care_rewards_enabled=False,cooldown_ms=86400000,not_calendar_day_reset=True,stack_by_fish_or_layout=False,rewards={'feed_response':dict(coins=120,minimum_session_ms=8000,session_expires_ms=120000,requires_displayed_fish=True),'drift_bottle':dict(coins=60,minimum_session_ms=0,session_expires_ms=120000,requires_displayed_fish=False)},core_fishing_unchanged_by_actions=True,background_clicks_no_reward=True,missed_windows_do_not_accumulate=True)
 write(DOC/'care-reward-research.json',policy)
 print(json.dumps(dict(new_species=4,total_species=len(d['fish']),pool_hash=c['pool_hash'],config_hash=c['config_hash'],normal_expected_coins={w:v['new_expected_coins_per_catch'] for w,v in report['waters'].items()}),ensure_ascii=False))
if __name__=='__main__':main()

