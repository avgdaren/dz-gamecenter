#!/usr/bin/env python3
"""作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。
Offline proposal arithmetic, all 32 synthetic ownership subsets, no DB/network/sale switch writes.
"""
from pathlib import Path
import argparse, hashlib, itertools, json

ROOT=Path(__file__).resolve().parents[1]

def quote(proposal,owned):
    items={x['id']:x for x in proposal['items']};owned=set(owned)
    if owned-set(items):raise ValueError('unknown ownership item')
    b=proposal['bundle'];n=b['discount_numerator'];d=b['discount_denominator']
    missing=[x for x in proposal['items'] if x['id'] not in owned]
    single=sum(x['coins'] for x in missing)
    if any(x['coins']*n%d for x in proposal['items']):raise ValueError('fractional per-item price needs explicit rounding policy')
    pay=sum(x['coins']*n//d for x in missing)
    return {'owned':sorted(owned),'missing':[x['id'] for x in missing],
       'missing_single_sum':single,'bundle_pay':pay,'missing_discount':single-pay,
       'owned_credit_at_bundle_price':sum(x['coins']*n//d for x in proposal['items'] if x['id'] in owned),
       'already_owned':not missing}

def study(proposal):
    if proposal['status']!='proposal-not-approved-not-active':raise ValueError('proposal status')
    items=proposal['items'];ids=[x['id'] for x in items]
    if len(ids)!=5 or len(set(ids))!=5:raise ValueError('five unique bundle members required')
    if any(type(x['coins']) is not int or x['coins']<=0 for x in items):raise ValueError('positive integer prices required')
    b=proposal['bundle']
    if b['members']!=ids or not (type(b['discount_numerator']) is int and type(b['discount_denominator']) is int
       and 0<b['discount_numerator']<=b['discount_denominator']):raise ValueError('discount or members')
    rows=[];checks=0
    for count in range(6):
        for subset in itertools.combinations(ids,count):
            row=quote(proposal,subset);rows.append(row)
            assert row==quote(proposal,list(reversed(subset))+list(subset));checks+=1
            assert row['bundle_pay']+row['owned_credit_at_bundle_price']==20000;checks+=1
            assert 0<=row['bundle_pay']<=row['missing_single_sum'];checks+=1
            assert row['already_owned']==(count==5);checks+=1
            for member in row['missing']:
                price=next(x['coins'] for x in items if x['id']==member)
                assert row['bundle_pay']-quote(proposal,list(subset)+[member])['bundle_pay']==price*4//5;checks+=1
    try:quote(proposal,['unknown_item'])
    except ValueError:checks+=1
    else:raise AssertionError('unknown ownership accepted')
    path=ROOT/'source/plugin/gamecenter/games/aquarium/data/content-v2-candidate.json'
    raw=path.read_bytes();sha=hashlib.sha256(raw).hexdigest()
    if sha!='c9423868b665127d6bc63da2373d442bd79d4f4e9dbe9b96157718725035040b':raise ValueError('frozen config changed')
    content=json.loads(raw);config=content['config'];prices={'常见':1,'少见':2,'稀有':5,'珍奇':10}
    shop=ROOT/'source/plugin/gamecenter/lib/aquarium_shop.php'
    shop_sha=hashlib.sha256(shop.read_bytes()).hexdigest()
    if shop_sha!='a7dbe48754a91f0c2f7e4d0ed3eb55520b86f20a769831421b77d1d8f340ee3d':raise ValueError('sale-price implementation changed; verify before studying')
    income=[]
    for water,w in config['waters'].items():
        ordinary={fid:f for fid,f in w['fish'].items() if 'lifetime_cap' not in f}
        weight=sum(f['weight'] for f in ordinary.values())
        capture=sum(f['weight']*f['coins'] for f in ordinary.values())/float(weight)
        sale=sum(f['weight']*prices[content['fish'][fid]['rarity']] for fid,f in ordinary.items())/float(weight)
        for rod,period in enumerate(config['periods_ms']):
            daily=86400000/float(period)
            for cost in [12000,20000,25000]:
                income.append({'water':water,'internal_rod':rod,'cost':cost,
                  'steady_capture_per_24h':capture*daily,'steady_sale_extra_per_24h':sale*daily,
                  'income_equivalent_days_sale_off':cost/(capture*daily),
                  'income_equivalent_days_sale_on':cost/((capture+sale)*daily)})
    return {'study':'firefly-proposed-prices-v1','author':proposal['author'],'approved':False,
       'single_total':sum(x['coins'] for x in items),'bundle_total':rows[0]['bundle_pay'],
       'ownership_scenarios':rows,'checks':checks,'income_equivalents':income,
       'config_sha256':sha,'shop_sha256':shop_sha,
       'model':'mature full book, ordinary reserve filled, limited caps exhausted; fixed water/rod, each 24h collected; no other spending; not new-player progression',
       'limits':['sale defaults off in release','old real inventory not read','no 18-species config','income-equivalent days are not guaranteed unlock dates'],
       'credit_note':b['credit_basis']}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--proposal',required=True,type=Path);p.add_argument('--out',required=True,type=Path)
    args=p.parse_args()
    if not args.out.is_absolute() or not args.out.parent.is_dir():raise ValueError('explicit absolute output in existing directory required')
    result=study(json.loads(args.proposal.read_text(encoding='utf-8')))
    args.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','ownership_cases':len(result['ownership_scenarios']),'checks':result['checks'],
       'single_total':result['single_total'],'bundle_total':result['bundle_total']}))

if __name__=='__main__':main()
