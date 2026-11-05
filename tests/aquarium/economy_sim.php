<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。CLI路线模拟，使用实际纯结算；消费为模拟策略，非生产购买接口。 */
if(PHP_SAPI!=='cli') {http_response_code(404);exit;}
define('IN_DISCUZ',true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_content.php';
$opt=getopt('',['seeds:','lamp:']);$seeds=(int)($opt['seeds']??64);$lamp=(int)($opt['lamp']??1500);
if($seeds<1||$seeds>256||!in_array($lamp,[1200,1500],true)){fwrite(STDERR,"--seeds 1..256 --lamp 1200|1500\n");exit(2);}
$c=gamecenter_aquarium_content::rules_config();
if($lamp!==1500) {
    // 仅模拟敏感性：新版本+重新生成两指纹；不修改候选文件或HTTP配置。
    $c['version']='aquarium-content-sim-lamp-'.$lamp.'-v1';$c['decor']['trinket_star_lamp']['cost']=$lamp;unset($c['config_hash']);
    $c['config_hash']=hash('sha256',json_encode($c,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
}
$c=gamecenter_aquarium_rules::prepare($c);$cat=gamecenter_aquarium_content::catalog();$categories=array_column($cat['decor'],'category','id');
function gate(array $s,array $e,array $c):bool {
    $g=$e['requires'];return $s['coins']>=$e['cost']&&count(array_intersect_key($s['fish'],$c['waters']['pond']['fish']))>=$g['pond_count']
        &&count($s['fish'])>=$g['total_fish']&&($g['water_unlocked']===''||in_array($g['water_unlocked'],$s['unlocked_waters'],true));
}
function decisions(array &$s,array &$owned,int &$cap,string $route,array $c,array &$purchases):void {
    $op=function(array $d)use(&$s,$c,&$purchases){$r=gamecenter_aquarium_rules::operate($s,$d,$c);if($r['code']!=='')throw new RuntimeException('policy '.$r['code']);$purchases[]=['id'=>$d['action']==='upgrade'?'rod_'.$d['target_level']:'unlock_bay','cost'=>$s['coins']-$r['save']['coins']];$s=$r['save'];};
    $buy=function(string $id)use(&$s,&$owned,$c,&$purchases){if(isset($owned[$id])||!gate($s,$c['decor'][$id],$c))return false;$s['coins']-=$c['decor'][$id]['cost'];$owned[$id]=true;$purchases[]=['id'=>$id,'cost'=>$c['decor'][$id]['cost']];gamecenter_aquarium_rules::validate($s,$c);return true;};
    if($route==='decor_first') {
        $starter=['plant_meadow','scape_pebbles','plant_lily','trinket_shell','plant_ribbon','scape_layers'];
        foreach($starter as $id)if(!isset($owned[$id]))$buy($id);
        foreach($starter as $id)if(!isset($owned[$id]))return;
    }
    if($s['rod_level']===0){if($s['coins']<$c['rod_costs'][1])return;$op(['action'=>'upgrade','target_level'=>1]);}
    if($route==='rod_first')while($s['rod_level']<4){$next=$s['rod_level']+1;if($s['coins']<$c['rod_costs'][$next])return;$op(['action'=>'upgrade','target_level'=>$next]);}
    if(!in_array('bay',$s['unlocked_waters'],true)) {
        if($s['coins']<$c['waters']['bay']['cost']||count(array_intersect_key($s['fish'],$c['waters']['pond']['fish']))<$c['waters']['bay']['requires_count'])return;
        $op(['action'=>'unlock','water_id'=>'bay']);
    }
    while($s['rod_level']<4){$next=$s['rod_level']+1;if($s['coins']<$c['rod_costs'][$next])return;$op(['action'=>'upgrade','target_level'=>$next]);}
    while($cap<2){$cost=$c['fish_capacity_costs'][$cap+1];if($s['coins']<$cost)return;$cap++;$s['coins']-=$cost;$purchases[]=['id'=>'fish_capacity_'.$c['fish_capacities'][$cap],'cost'=>$cost];}
    $ids=array_keys($c['decor']);usort($ids,fn($a,$b)=>($c['decor'][$a]['cost']<=>$c['decor'][$b]['cost'])?:strcmp($a,$b));
    foreach($ids as $id)if(!isset($owned[$id]))$buy($id);
}
function simulate(int $i,int $interval,string $route,array $c,array $categories):array {
    $s=gamecenter_aquarium_rules::initial(100000+$i,substr(hash('sha256','aquarium-content-sim:'.$i),0,32),0,$c);
    $initial=$s['coins'];$owned=[];$cap=0;$earned=0;$spent=0;$discarded=0;$marks=[];$trace=[];$finished=false;
    for($day=0;$day<=180;$day+=$interval) {
        $r=gamecenter_aquarium_rules::settle($s,$day*86400000,$c);$s=$r['save'];$earned+=array_sum(array_column($r['catches'],'coins'));$discarded+=$r['discarded_ms'];
        if(count($s['fish'])===12&&!isset($marks['fish_12_day'])){$marks['fish_12_day']=$day;$marks['fish_12_caught_day']=max(array_column($s['fish'],'discovered_at'))/86400000;}
        $p=[];decisions($s,$owned,$cap,$route,$c,$p);foreach($p as $x){$spent+=$x['cost'];
            if(isset($c['decor'][$x['id']])){
                if(!isset($marks['first_decor_day']))$marks['first_decor_day']=$day;
                if(($categories[$x['id']]==='building'||$x['id']==='trinket_star_lamp')&&!isset($marks['first_expensive_decor_day']))$marks['first_expensive_decor_day']=$day;
                if($x['id']==='building_moon_gate')$marks['moon_gate_day']=$day;
                if($x['id']==='trinket_star_lamp')$marks['star_lamp_day']=$day;
            }
        }
        if(in_array('bay',$s['unlocked_waters'],true)&&!isset($marks['bay_day']))$marks['bay_day']=$day;
        if($s['rod_level']===4&&!isset($marks['rod4_day']))$marks['rod4_day']=$day;
        if($cap===2&&!isset($marks['fish_capacity12_day']))$marks['fish_capacity12_day']=$day;
        if(in_array('bay',$s['unlocked_waters'],true)){
            $target=count(array_intersect_key($s['fish'],$c['waters']['bay']['fish']))<6?'bay':(count(array_intersect_key($s['fish'],$c['waters']['pond']['fish']))<6?'pond':'bay');
            $s=gamecenter_aquarium_rules::operate($s,['action'=>'switch','water_id'=>$target],$c)['save'];
        }
        gamecenter_aquarium_rules::validate($s,$c);
        if($s['coins']+$spent!==$initial+$earned)throw new RuntimeException('budget identity');
        if($i===1)$trace[]=['day'=>$day,'coins'=>$s['coins'],'rod'=>$s['rod_level'],'next_water'=>$s['current_water'],'fish'=>count($s['fish']),'decor'=>count($owned),'fish_capacity'=>$c['fish_capacities'][$cap],'purchases'=>$p];
        if(count($owned)===24&&$cap===2&&$s['rod_level']===4){$marks['all_spend_day']=$day;$finished=true;break;}
    }
    if($finished&&$spent!==array_sum($c['rod_costs'])+2000+3800+array_sum(array_column($c['decor'],'cost')))throw new RuntimeException('total spending');
    return ['milestones'=>$marks,'finished'=>$finished,'discarded_hours'=>$discarded/3600000,'catches'=>$s['catch_seq'],'coins'=>$s['coins'],'spent'=>$spent,'trace'=>$trace];
}
function distribution(array $v):?array {if(!$v)return null;sort($v,SORT_NUMERIC);$n=count($v);$q=fn($p)=>$v[max(0,(int)ceil($n*$p)-1)];return ['n'=>$n,'min'=>$v[0],'p10'=>$q(0.1),'p50'=>$q(0.5),'p90'=>$q(0.9),'max'=>$v[$n-1]];}
$out=['author'=>'GPT / Codex; original plugin (C) 2026 Carinoasd','scope'=>'deterministic simulation using actual PHP settle/operate; spending policy model, not player/DB/HTTP evidence',
    'config_version'=>$c['version'],'config_hash'=>$c['config_hash'],'pool_hash'=>$c['pool_hash'],'seeds'=>$seeds,'seed_recipe'=>'uid=100000+i; seed=first16bytes(sha256(aquarium-content-sim:i)), i=1..N',
    'lamp_price'=>$lamp,'decor_total'=>array_sum(array_column($c['decor'],'cost')),'all_spend_total'=>array_sum($c['rod_costs'])+2000+3800+array_sum(array_column($c['decor'],'cost')),
    'quantiles'=>'nearest-rank, calendar days; fish_12_day=first observed visit, fish_12_caught_day=actual last discovery timestamp','scenarios'=>[]];
foreach([1,3] as $interval)foreach(['water_first','rod_first','decor_first'] as $route){
    $runs=[];for($i=1;$i<=$seeds;$i++)$runs[]=simulate($i,$interval,$route,$c,$categories);
    $metrics=[];foreach(['bay_day','fish_12_day','fish_12_caught_day','rod4_day','fish_capacity12_day','first_decor_day','first_expensive_decor_day','moon_gate_day','star_lamp_day','all_spend_day'] as $key){$v=[];foreach($runs as $r)if(isset($r['milestones'][$key]))$v[]=$r['milestones'][$key];$metrics[$key]=distribution($v);}
    $out['scenarios'][]=['visit_interval_days'=>$interval,'route'=>$route,'completed'=>count(array_filter($runs,fn($r)=>$r['finished'])),'censored_at_day'=>180,'metrics'=>$metrics,'discarded_hours'=>distribution(array_column($runs,'discarded_hours')),'representative_seed_1'=>$runs[0]['trace']];
}
echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";
