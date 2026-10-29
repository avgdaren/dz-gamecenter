<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。CLI规则与固定边界，无数据库。 */
if(PHP_SAPI!=='cli') { http_response_code(404); exit; }
define('IN_DISCUZ',true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_config.php';
$c=gamecenter_aquarium_config::load(); $n=0;
function check($x,string $label): void { global $n; $n++; if(!$x) { throw new RuntimeException($label); } }
function fails(callable $fn,string $label): void { try { $fn(); } catch(DomainException $e) { check(true,$label); return; } check(false,$label); }
function fresh(int $uid=12345): array { global $c; return gamecenter_aquarium_rules::initial($uid,'000102030405060708090a0b0c0d0e0f',1000000,$c); }
function allFish(array $s,string $wid): array { global $c; foreach($c['waters'][$wid]['fish'] as $id=>$f) $s['fish'][$id]=['discovered_at'=>1000000,'catch_count'=>1]; return $s; }
$vectors=[
 ['eeda8e559ee6f75186defca0b8fa7d906602a251e88b2eddca5fb645f8905c17',4007300693,93],
 ['264abd3eda3a86ff90be121f40815cd1eb021c41ac73d1d4a70049a726c4a83a',642432318,18],
 ['b96ad9a41bdcf34cf45914342c9c29a438ea0f72525f054a12ffca339538d115',3110787492,92],
 ['c52c36f740a91267796df33e252c5d178e4297fa752d3da99b7f76d783767ac3',3308009207,7]];
foreach($vectors as $i=>[$hex,$x,$t]) {
 $h=hash_hmac('sha256','12345:'.($i+1).':0',hex2bin(fresh()['seed_hex']),true);
 check(bin2hex($h)===$hex,'digest '.($i+1)); check(unpack('N',substr($h,0,4))[1]===$x,'big endian');
 check(gamecenter_aquarium_rules::ticket(fresh()['seed_hex'],12345,$i+1,100)===$t,'ticket');
}
$calls=[];$t=gamecenter_aquarium_rules::ticket(fresh()['seed_hex'],12345,1,100,function($m)use(&$calls){$calls[]=$m;return pack('N',count($calls)===1?4294967200:4294967199).str_repeat("\0",28);});
check($t===99&&$calls===['12345:1:0','12345:1:1'],'rejection boundary increments draw');
check(gamecenter_aquarium_rules::pick(['a'=>['weight'=>34],'b'=>['weight'=>66]],33)==='a','weight left boundary');
check(gamecenter_aquarium_rules::pick(['a'=>['weight'=>34],'b'=>['weight'=>66]],34)==='b','weight right boundary');
$s=fresh();$r=gamecenter_aquarium_rules::settle($s,87400000,$c);
check($r===gamecenter_aquarium_rules::settle($s,87400000,$c),'same input deterministic');
$one=$s;$catches=[];for($i=1;$i<=24;$i++){ $v=gamecenter_aquarium_rules::settle($one,1000000+$i*3600000,$c);$one=$v['save'];$catches=array_merge($catches,$v['catches']); }
check($one===$r['save'],'24*1h final state / first discovery times');check($catches===$r['catches'],'concatenated catches');
foreach([0,1,119999,120000,120001,9999999] as $delta) {
 $z=gamecenter_aquarium_rules::settle($s,1000000+$delta,$c);check($z['save']['catch_seq']===intdiv($delta,120000),'cycle boundary');
 check($z['save']['progress_ms']===$delta%120000,'remainder');
}
foreach([0,1,119999,120000,240001,86400001] as $delta) {
 $z=gamecenter_aquarium_rules::settle($s,1000000+$delta,$c);$before=$z['save'];$before['coins']=10000;
 $u=gamecenter_aquarium_rules::operate($before,['action'=>'upgrade','target_level'=>1],$c);
 check($u['code']===''&&$u['save']['progress_ms']===intdiv($before['progress_ms']*108000,120000),'upgrade floor');
 check($u['save']['coins']===9880&&$u['save']['catch_seq']===$before['catch_seq'],'upgrade no past reprice');
}
$max=$s;$max['rod_level']=4;check(gamecenter_aquarium_rules::operate($max,['action'=>'upgrade','target_level'=>5],$c)['code']==='target','max level');
$poor=$s;$poor['coins']=0;check(gamecenter_aquarium_rules::operate($poor,['action'=>'upgrade','target_level'=>1],$c)['save']===$poor,'no partial charge');
foreach([0,1,119999,120000,240001,86400001] as $delta) {
 $z=gamecenter_aquarium_rules::settle($s,1000000+$delta,$c)['save'];$z['unlocked_waters']=['test_bay','test_pond'];
 $sw=gamecenter_aquarium_rules::operate($z,['action'=>'switch','water_id'=>'test_bay'],$c)['save'];
 check($sw['progress_ms']===$z['progress_ms']&&$sw['no_new_count']===$z['no_new_count'],'switch preserves progress / counters');
 $back=gamecenter_aquarium_rules::operate($sw,['action'=>'switch','water_id'=>'test_pond'],$c)['save'];check($back===$z,'switch roundtrip');
}
check(gamecenter_aquarium_rules::operate($s,['action'=>'switch','water_id'=>'test_bay'],$c)['code']==='condition','locked water');
$boundary=gamecenter_aquarium_rules::settle($s,1120000,$c);check($boundary['catches'][0]['caught_ms']===1120000&&str_starts_with($boundary['catches'][0]['fish_id'],'test_pond'),'catch before switch');
foreach([86399999,86400000,86400001,172800000,259200000,86459999] as $delta) {
 $z=gamecenter_aquarium_rules::settle($s,1000000+$delta,$c);check($z['effective_ms']===min($delta,86400000),'global cap');
 check($z['save']['last_settled_ms']===1000000+$delta,'anchor advances through discarded time');
 check(!gamecenter_aquarium_rules::settle($z['save'],1000000+$delta,$c)['catches'],'discarded cannot reclaim');
}
$with=$s;$with['progress_ms']=117001;$z=gamecenter_aquarium_rules::settle($with,1000000+172800000,$c);check($z['save']['progress_ms']===117001,'cap retains remainder');
foreach([1000000,999999,0,900000,1000000,1000001] as $now) {
 $z=gamecenter_aquarium_rules::settle($s,$now,$c);check($z['save']['last_settled_ms']===max(1000000,$now),'clock never rewinds');check(!$z['catches'],'clock no duplicates');
}
$pity=allFish($s,'test_pond');unset($pity['fish']['test_pond_f']);$pity['no_new_count']['test_pond']=80;
$z=gamecenter_aquarium_rules::settle($pity,1120000,$c);check($z['catches'][0]['fish_id']==='test_pond_f'&&$z['save']['no_new_count']['test_pond']===0,'81st catch forced missing');
for($q=0;$q<100;$q++)if(gamecenter_aquarium_rules::ticket($s['seed_hex'],12345,$q+1,100)<98)break;
$pity['catch_seq']=$q;$pity['no_new_count']['test_pond']=79;$z=gamecenter_aquarium_rules::settle($pity,1240000,$c);
check(!$z['catches'][0]['is_new']&&$z['catches'][1]['fish_id']==='test_pond_f','80th normal then 81st forced');
$done=allFish($s,'test_pond');$z=gamecenter_aquarium_rules::settle($done,1240000,$c);check($z['save']['no_new_count']['test_pond']===0,'complete stops pity');
$shuffled=$c;$shuffled['waters']=array_reverse($c['waters'],true);foreach($shuffled['waters'] as &$w)$w['fish']=array_reverse($w['fish'],true);unset($w);
check(gamecenter_aquarium_rules::prepare($shuffled)===$c,'canonical order');
check(gamecenter_aquarium_rules::settle($s,87400000,$shuffled)===$r,'sorting used for picks');
foreach(['weight','coins'] as $field){$bad=$c;$bad['waters']['test_pond']['fish']['test_pond_a'][$field]++;fails(fn()=>gamecenter_aquarium_rules::settle($s,1120000,$bad),'mutated config rejected '.$field);}
$bad=$c;$bad['rod_costs'][1]++;fails(fn()=>gamecenter_aquarium_rules::prepare($bad),'price drift detected');
foreach(['coins','progress_ms','uid','seed_hex','config_version','fish'] as $field){$bad=$s;unset($bad[$field]);fails(fn()=>gamecenter_aquarium_rules::settle($bad,1120000,$c),'corrupt state '.$field);}
// 多种不整周期切分，逐条序列/首次发现时刻与整批一致。
for($i=1;$i<=120;$i++) {
 $base=fresh($i);$base['progress_ms']=($i*997)%120000;$end=1000000+$i*139007;
 $whole=gamecenter_aquarium_rules::settle($base,$end,$c);$part=$base;$joined=[];
 for($at=1000000+432199;$at<$end;$at+=432199){$z=gamecenter_aquarium_rules::settle($part,$at,$c);$part=$z['save'];$joined=array_merge($joined,$z['catches']);}
 $z=gamecenter_aquarium_rules::settle($part,$end,$c);$joined=array_merge($joined,$z['catches']);
 check($z['save']===$whole['save'],'random partitions state');check($joined===$whole['catches'],'random partitions catches');
}
echo json_encode(['status'=>'PASS','checks'=>$n,'scope'=>'pure PHP rules; no database'])."\n";
