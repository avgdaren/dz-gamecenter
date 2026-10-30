#!/usr/bin/env python3
"""Offline research model only. Author GPT / Codex; original plugin (C) 2026 Carinoasd.
No database, HTTP, secrets, real account state, live rewards or production RNG.
"""
from pathlib import Path
from fractions import Fraction
import argparse,copy,hashlib,json,random,statistics
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];DOC=ROOT/'docs/aquarium/next-pack-v1'
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def canonical(c):
 return 'aquarium-pools-v1\n'+''.join(w+'\t'+fid+'\t'+str(f['weight'])+'\n' for w,v in sorted(c['waters'].items()) for fid,f in sorted(v['fish'].items()))
def config_hash(c):return hashlib.sha256(json.dumps({k:v for k,v in c.items() if k!='config_hash'},separators=(',',':'),ensure_ascii=True).encode()).hexdigest()
def mean(pool):return Fraction(sum(x['weight']*x['coins'] for x in pool.values()),sum(x['weight'] for x in pool.values()))
def reward_eligible(last,now):
 if type(now) is not int or now<0:return False
 return last is None or now>=last+86400000
def collection(pool,known,seed):
 rng=random.Random(seed);known=set(known);n=0;pity=0;coins=0
 while len(known)<len(pool):
  missing={k:v for k,v in pool.items() if k not in known}
  eligible=missing if pity>=80 else pool
  ticket=rng.randrange(sum(x['weight'] for x in eligible.values()))
  for fid,f in sorted(eligible.items()):
   if ticket<f['weight']:break
   ticket-=f['weight']
  n+=1;coins+=f['coins']
  if fid not in known:known.add(fid);pity=0
  else:pity=min(80,pity+1)
  if n>len(pool)*81+1:raise AssertionError('pity collection bound')
 return n,coins
def quantiles(xs):
 s=sorted(xs);return dict(min=s[0],p10=s[round((len(s)-1)*.1)],median=statistics.median(s),p90=s[round((len(s)-1)*.9)],max=s[-1])
def main():
 p=argparse.ArgumentParser();p.add_argument('--seeds',type=int,default=1000);a=p.parse_args()
 old=load(DOC/'baseline-content-reference.json');new=load(DOC/'content-next-candidate.json');policy=load(DOC/'care-reward-research.json')
 checks=0
 def check(condition,message):
  nonlocal checks
  assert condition,message;checks+=1
 for label,data in [('old',old),('new',new)]:
  c=data['config'];check(hashlib.sha256(canonical(c).encode()).hexdigest()==c['pool_hash'],label+' pool hash')
  check(config_hash(c)==c['config_hash'],label+' config hash, including baseline known PHP-produced hash')
 check(len(new['fish'])==16,'16 species');check(list(new['fish'])[:12]==list(old['fish']),'old order')
 for fid,f in old['fish'].items():check(new['fish'][fid]==f,'old metadata unchanged')
 for field in ['cap_ms','periods_ms','rod_costs','initial_coins','initial_water','initial_fish','initial_fish_capacity','fish_capacities','fish_capacity_costs','decor']:
  check(new['config'][field]==old['config'][field],'unchanged rule '+field)
 for w,v in new['config']['waters'].items():
  pool=v['fish'];oldpool=old['config']['waters'][w]['fish']
  check(len(pool)==8 and sum(f['weight'] for f in pool.values())==3000,'8 species and denominator 3000')
  check(mean(pool)==mean(oldpool),'exact normal expectation')
  for fid,f in oldpool.items():
   check(pool[fid]['coins']==f['coins'] and Fraction(pool[fid]['weight'],3000)==Fraction(f['weight'],100)*Fraction(9,10),'old rewards preserved and probabilities 90%')
 for last,now,want in [(None,0,True),(0,86399999,False),(0,86400000,True),(1000,999,False),(None,-1,False),(None,1.5,False),(86399000,86401000,False)]:
  check(reward_eligible(last,now)==want,'cooldown boundary')
 check(not policy['feeding_animation_enabled'] and not policy['care_rewards_enabled'],'research flags disabled')
 check(sum(x['coins'] for x in policy['rewards'].values())==180,'cap 180')
 # Dense deterministic attempts: independent type cooldown, no midnight reset.
 last={k:None for k in policy['rewards']};paid=[]
 for now in range(0,7*86400000,60000):
  for kind,rule in policy['rewards'].items():
   if reward_eligible(last[kind],now):last[kind]=now;paid.append((now,rule['coins']))
 for t,_ in paid:check(sum(n for now,n in paid if t<=now<t+86400000)<=180,'every payout-anchored half-open rolling window capped')
 assets=ROOT/'source/plugin/gamecenter/games/aquarium/assets/fish-next/v1';manifest=load(assets/'manifest.json')
 for item in manifest['items']:
  check(item['id'] in new['fish'],'asset id belongs to content')
  for kind,f in item['files'].items():
   file=assets/f['file'];im=Image.open(file).convert('RGBA');alpha=im.getchannel('A');box=alpha.getbbox()
   check(hashlib.sha256(file.read_bytes()).hexdigest()==f['sha256'],'asset hash')
   check(im.size==(f['width'],f['height']) and alpha.getextrema()[0]==0 and alpha.getextrema()[1]>0,'dimensions and nonempty transparency')
   check(box[0]>0 and box[1]>0 and box[2]<im.width and box[3]<im.height,'no exported edge clipping')
 # Illegal candidates, independently detected; no claim of server request testing.
 bad=copy.deepcopy(new['config']);bad['waters']['pond']['fish']['pond_blue']['weight']+=1
 check(hashlib.sha256(canonical(bad).encode()).hexdigest()!=bad['pool_hash'],'tampered weight rejected by frozen hash')
 bad=copy.deepcopy(new['config']);bad['rod_costs'][1]+=1
 check(config_hash(bad)!=bad['config_hash'],'tampered economics rejected by config hash')
 results={}
 for w in ['pond','bay']:
  before=old['config']['waters'][w]['fish'];after=new['config']['waters'][w]['fish']
  initial=['pond_blue'] if w=='pond' else []
  results[w]={}
  for name,pool,known in [('old_new_player',before,initial),('next_new_player',after,initial),('next_old_collection_complete',after,list(before))]:
   values=[collection(pool,known,20261030+i*17)[0] for i in range(a.seeds)]
   results[w][name]={'captures':quantiles(values),'minutes_at_lv4':{k:round(v*1.2,2) for k,v in quantiles(values).items()}}
 report=dict(author='GPT / Codex; original plugin (C) 2026 Carinoasd',status='PASS',checks=checks,seeds=a.seeds,seed_protocol='Python Random seed 20261030+i*17; integer tickets, 80-failure pity; NOT production HMAC RNG',collection=results,scope='offline candidate/hash/assets/cooldown model only',live_site_tested=False,database_transactions_tested=False,concurrency_tested=False,animation_tested=False,user_new_art_accepted=False)
 (DOC/'MODEL-CHECKS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()

