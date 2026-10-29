<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。CLI正式内容候选边界，不连接站点/数据库。 */
if(PHP_SAPI!=='cli') {http_response_code(404);exit;}
define('IN_DISCUZ',true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_content.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_config.php';
$n=0;function ck($ok,$label){global $n;$n++;if(!$ok)throw new RuntimeException($label);}
function rejects(callable $fn,$label){try{$fn();}catch(DomainException $e){ck(true,$label);return;}ck(false,$label);}
$c=gamecenter_aquarium_content::rules_config();$cat=gamecenter_aquarium_content::catalog();
ck(gamecenter_aquarium_config::load()['version']==='aquarium-foundation-v1','active foundation config unchanged');
ck($c['version']==='aquarium-content-candidate-v1'&&$c['cap_ms']===86400000,'separate version and 24h');
ck(count($cat['fish'])===12&&count($cat['decor'])===24,'catalog counts');
ck(array_column($cat['fish'],'index')===range(1,12),'explicit book order');
ck(array_sum(array_column($cat['decor'],'cost'))===29000,'candidate lamp1500 decor cost');
ck(array_sum($c['rod_costs'])+2000+3800+29000===36680,'all candidate spending');
$registry=json_decode(file_get_contents(__DIR__.'/../../docs/aquarium/art/asset-map-v0.1.json'),true);
ck(array_column($cat['fish'],'id')===array_column($registry['fish'],'id'),'fish stable IDs');
ck(array_column($cat['decor'],'id')===array_column($registry['decor'],'id'),'decor stable IDs');
foreach(['pond','bay'] as $wid) {
 ck(count($c['waters'][$wid]['fish'])===6,'six fish '.$wid);ck(array_sum(array_column($c['waters'][$wid]['fish'],'weight'))===100,'sum weight '.$wid);
 $ids=array_keys($c['waters'][$wid]['fish']);$sorted=$ids;sort($sorted,SORT_STRING);ck($ids===$sorted,'ASCII '.$wid);
 $s=gamecenter_aquarium_rules::initial(7,'000102030405060708090a0b0c0d0e0f',1000000,$c);
 if($wid==='bay'){$s['unlocked_waters']=['bay','pond'];$s['current_water']='bay';}
 $rare=$wid==='pond'?'pond_feather':'bay_aurora';
 foreach($c['waters'][$wid]['fish'] as $id=>$f)if($id!==$rare)$s['fish'][$id]=['discovered_at'=>1000000,'catch_count'=>1];
 $s['no_new_count'][$wid]=80;$r=gamecenter_aquarium_rules::settle($s,1120000,$c);
 ck($r['catches'][0]['fish_id']===$rare,'81st forces missing rare at rod0 '.$wid);
 ck($r['save']['no_new_count'][$wid]===0,'pity reset '.$wid);
 // 找到第80次仍重复的序号，再确认第81次补新；不依赖旧test_鱼排序。
 $s['no_new_count'][$wid]=79;
 for($q=0;$q<1000;$q++) {
  $s['catch_seq']=$q;$r=gamecenter_aquarium_rules::settle($s,1240000,$c);
  if(!$r['catches'][0]['is_new']){ck($r['catches'][1]['fish_id']===$rare,'80 normal /81 missing '.$wid);break;}
 }
 ck($q<1000,'80th test vector found');
}
$s=gamecenter_aquarium_rules::initial(1,'000102030405060708090a0b0c0d0e0f',1000000,$c);
ck($s['coins']===122&&count($s['fish'])===1,'initial guide');
$book=gamecenter_aquarium_content::book($s);ck(count(array_filter($book,fn($x)=>$x['discovered']))===1,'one discovered card');
ck(!str_contains(json_encode($book),'seed_hex'),'book no secret');
ck($book[0]['id']==='pond_blue'&&$book[0]['discovered_at']===1000000,'book first discovery');
ck($book[5]['discovered_at']===null&&$book[5]['catch_count']===0,'unknown fish no fake discovery');
ck($book[5]['description']===null&&is_string($book[0]['description']),'only discovered cards reveal flavor text');
$hint=gamecenter_aquarium_content::decor_conditions($s,'plant_meadow');ck($hint['eligible'],'normal cheap decoration eligible');
$hint=gamecenter_aquarium_content::decor_conditions($s,'building_moon_gate');ck(!$hint['eligible']&&$hint['missing']['coins']===2678&&$hint['missing']['total_fish']===7,'exact money/collection deficit');
ck(gamecenter_aquarium_content::decor_conditions($s,'scape_coral')['missing']['water_id']==='bay','locked bay gate');
$s['coins']=10000;$s['unlocked_waters']=['bay','pond'];foreach($c['waters'] as $w)foreach($w['fish'] as $id=>$f)$s['fish'][$id]=['discovered_at'=>1000000,'catch_count'=>1];
foreach($cat['decor'] as $d)ck(gamecenter_aquarium_content::decor_conditions($s,$d['id'])['eligible'],'normal complete book gate '.$d['id']);
rejects(fn()=>gamecenter_aquarium_content::decor_conditions($s,'fake_decor'),'unknown decor rejected');
$bad=$s;$bad['coins']=-1;rejects(fn()=>gamecenter_aquarium_content::book($bad),'corrupt state rejected');
$old=gamecenter_aquarium_rules::initial(1,'000102030405060708090a0b0c0d0e0f',1000000,gamecenter_aquarium_config::load());rejects(fn()=>gamecenter_aquarium_content::book($old),'old config not silently converted');
$drift=$c;$drift['decor']['trinket_star_lamp']['cost']++;rejects(fn()=>gamecenter_aquarium_rules::prepare($drift),'decor price hash frozen');
$drift=$c;$drift['fish_capacity_costs'][1]++;rejects(fn()=>gamecenter_aquarium_rules::prepare($drift),'capacity price hash frozen');
$base=gamecenter_aquarium_rules::initial(1,'000102030405060708090a0b0c0d0e0f',1000000,$c);
$a=gamecenter_aquarium_rules::settle($base,1000000+86400000,$c);$b=gamecenter_aquarium_rules::settle($base,1000000+259200000,$c);
ck($a['catches']===$b['catches']&&$b['discarded_ms']===172800000,'three-day visit earns one day');
ck(gamecenter_aquarium_rules::settle($b['save'],1000000+259200000,$c)['catches']===[],'discarded not reclaimable');
echo json_encode(['status'=>'PASS','checks'=>$n,'scope'=>'candidate catalog + actual pure rules; no HTTP/DB'])."\n";
