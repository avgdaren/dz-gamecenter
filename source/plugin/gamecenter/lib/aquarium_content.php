<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。C1/C2内容候选；不由HTTP入口加载，不替换foundation档。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_rules.php';
final class gamecenter_aquarium_content {
    const FILE_HASH='754fa33008f6dd95406bd7b5710c04e0a58702a679dea63909d86c11fe9a4a09';
    private static ?array $data=null;
    private static function load(): array {
        if(self::$data!==null) { return self::$data; }
        $raw=file_get_contents(__DIR__.'/../games/aquarium/data/content-v1-candidate.json');
        if(!is_string($raw) || strlen($raw)>131072 || !hash_equals(self::FILE_HASH,hash('sha256',$raw))) { throw new DomainException('content'); }
        $d=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
        if(($d['status']??null)!=='candidate-not-active') { throw new DomainException('content'); }
        $c=gamecenter_aquarium_rules::prepare($d['config']);
        if($c['version']!=='aquarium-content-candidate-v1' || $c['cap_ms']!==86400000 || count($d['fish'])!==12 || count($d['decor'])!==24
            || $c['fish_capacities']!==[4,8,12] || $c['fish_capacity_costs']!==[0,800,3000] || $c['initial_fish_capacity']!==4) { throw new DomainException('content'); }
        $all=[];
        foreach($c['waters'] as $wid=>$w) {
            if(count($w['fish'])!==6 || array_sum(array_column($w['fish'],'weight'))!==100 || !isset($d['waters'][$wid])) { throw new DomainException('content'); }
            foreach($w['fish'] as $fid=>$f) { $all[$fid]=$wid; }
        }
        if(array_diff_key($all,$d['fish']) || array_diff_key($d['fish'],$all) || array_diff_key($c['decor'],$d['decor']) || array_diff_key($d['decor'],$c['decor'])) { throw new DomainException('content'); }
        foreach(['fish','decor'] as $kind) {
            $indices=[];$categories=[];
            foreach($d[$kind] as $id=>$m) {
                if(!gamecenter_aquarium_rules::id($id) || !is_string($m['name']??null) || strlen($m['name'])>100 || $m['name']===''
                    || !is_string($m['description']??null) || strlen($m['description'])>500 || !gamecenter_aquarium_rules::number($m['index']??null,1,count($d[$kind]))) { throw new DomainException('content'); }
                $indices[]=$m['index'];
                if($kind==='fish') {
                    if($m['water']!==$all[$id] || !in_array($m['rarity'],['常见','少见','稀有','珍奇'],true)) { throw new DomainException('content'); }
                } else {
                    $e=$c['decor'][$id];$g=$e['requires'];
                    if(!in_array($m['category'],['plant','scape','building','trinket'],true) || !is_array($m['themes']) || !$m['themes']
                        || array_diff($m['themes'],['nature','coral','moon','ruin']) || !gamecenter_aquarium_rules::number($e['cost'],1,1000000)
                        || !gamecenter_aquarium_rules::number($g['pond_count'],0,6) || !gamecenter_aquarium_rules::number($g['total_fish'],0,12)
                        || !in_array($g['water_unlocked'],['','bay'],true) || !is_array($e['layers']) || !$e['layers']
                        || array_diff($e['layers'],['front','back']) || count($e['layers'])!==count(array_unique($e['layers']))) { throw new DomainException('content'); }
                    $categories[$m['category']]=($categories[$m['category']]??0)+1;
                }
            }
            sort($indices,SORT_NUMERIC);
            if($indices!==range(1,count($d[$kind])) || ($kind==='decor' && (count($categories)!==4 || array_unique(array_values($categories))!==[6]))) { throw new DomainException('content'); }
        }
        $d['config']=$c;self::$data=$d;return $d;
    }
    public static function rules_config(): array { return self::load()['config']; }

    /* ---------------- v2：16 种（含 4 种终身上限 3 条） ---------------- */
    const V2_FILE='content-v2-candidate.json';
    const V2_HASH='c9423868b665127d6bc63da2373d442bd79d4f4e9dbe9b96157718725035040b';
    const V2_VERSION='aquarium-content-v2-candidate-v1';
    const V2_LIMITED=['pond_curl_seahorse','pond_bell_jelly','bay_moon_mermaid','bay_gummy_octopus'];
    private static ?array $v2=null;

    private static function loadV2(): array {
        if(self::$v2!==null) { return self::$v2; }
        $raw=file_get_contents(__DIR__.'/../games/aquarium/data/'.self::V2_FILE);
        if(!is_string($raw) || strlen($raw)>262144 || !hash_equals(self::V2_HASH,hash('sha256',$raw))) { throw new DomainException('content-v2'); }
        $d=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
        if(($d['status']??null)!=='candidate-not-active') { throw new DomainException('content-v2'); }
        $c=gamecenter_aquarium_rules::prepare($d['config']);
        if($c['version']!==self::V2_VERSION || $c['cap_ms']!==86400000 || count($d['fish'])!==16 || count($d['decor'])!==24
            || $c['fish_capacities']!==[4,8,12] || $c['fish_capacity_costs']!==[0,800,3000] || $c['initial_fish_capacity']!==4) { throw new DomainException('content-v2'); }

        $all=[];
        foreach($c['waters'] as $wid=>$w) {
            if(count($w['fish'])!==8 || !isset($d['waters'][$wid])) { throw new DomainException('content-v2'); }
            foreach($w['fish'] as $fid=>$f) { $all[$fid]=$wid; }
        }
        if(count($all)!==16 || array_diff_key($all,$d['fish']) || array_diff_key($d['fish'],$all)) { throw new DomainException('content-v2'); }

        // 终身上限 + 鱼竿门槛：都必须在 waters[water].fish[fid] 上，且只允许 4 种新鱼
        $limited=[];
        foreach($c['waters'] as $wid=>$w) {
            foreach($w['fish'] as $fid=>$f) {
                if(isset($f['lifetime_cap'])) { $limited[]=$fid; if(!in_array($fid,self::V2_LIMITED,true)) { throw new DomainException('content-v2-cap'); } }
                if(isset($f['min_rod_level']) && !in_array($fid,self::V2_LIMITED,true)) { throw new DomainException('content-v2-rod'); }
            }
        }
        sort($limited);
        $expect=self::V2_LIMITED; sort($expect);
        if($limited!==$expect) { throw new DomainException('content-v2-cap'); }

        // 旧 12 种 ID / index / 品级 不得变动
        $v1=self::load();
        foreach($v1['fish'] as $id=>$m) {
            if(!isset($d['fish'][$id])) { throw new DomainException('content-v2-legacy'); }
            if((int)$d['fish'][$id]['index']!==(int)$m['index']) { throw new DomainException('content-v2-index'); }
            if($d['fish'][$id]['water']!==$m['water'] || $d['fish'][$id]['rarity']!==$m['rarity']) { throw new DomainException('content-v2-meta'); }
        }
        // 索引 1..16 连续
        $idx=[]; foreach($d['fish'] as $m) { $idx[]=(int)($m['index']??0); }
        sort($idx,SORT_NUMERIC);
        if($idx!==range(1,16)) { throw new DomainException('content-v2-index'); }

        $d['config']=$c; self::$v2=$d; return $d;
    }

    public static function rules_config_v2(): array { return self::loadV2()['config']; }

    public static function catalog_v2(): array {
        $d=self::loadV2(); $c=$d['config']; $fish=[]; $decor=[];
        foreach($d['fish'] as $id=>$m) { $fish[]=array_merge(['id'=>$id],$m,$c['waters'][$m['water']]['fish'][$id]); }
        foreach($d['decor'] as $id=>$m) { $decor[]=array_merge(['id'=>$id],$m,$c['decor'][$id]); }
        usort($fish,static fn($a,$b)=>$a['index']<=>$b['index']); usort($decor,static fn($a,$b)=>$a['index']<=>$b['index']);
        return ['version'=>$c['version'],'status'=>'candidate-not-active','fish'=>$fish,'decor'=>$decor,'water_names'=>$d['waters'],
            'cap_ms'=>$c['cap_ms'],'fish_capacities'=>$c['fish_capacities'],'fish_capacity_costs'=>$c['fish_capacity_costs']];
    }
    /** 无私有随机信息；价格/权重只从同一规则配置投影，图鉴按显式index排序。 */
    public static function catalog(): array {
        $d=self::load();$c=$d['config'];$fish=[];$decor=[];
        foreach($d['fish'] as $id=>$m) { $fish[]=array_merge(['id'=>$id],$m,$c['waters'][$m['water']]['fish'][$id]); }
        foreach($d['decor'] as $id=>$m) { $decor[]=array_merge(['id'=>$id],$m,$c['decor'][$id]); }
        usort($fish,static fn($a,$b)=>$a['index']<=>$b['index']);usort($decor,static fn($a,$b)=>$a['index']<=>$b['index']);
        return ['version'=>$c['version'],'status'=>'candidate-not-active','fish'=>$fish,'decor'=>$decor,'water_names'=>$d['waters'],
            'cap_ms'=>$c['cap_ms'],'fish_capacities'=>$c['fish_capacities'],'fish_capacity_costs'=>$c['fish_capacity_costs']];
    }
    /** C2只读图鉴；不进行结算，不从客户端鱼列表构建状态。调用方须先完成鉴权和读档。 */
    public static function book(array $s): array {
        gamecenter_aquarium_rules::validate($s,self::rules_config());$out=[];
        foreach(self::catalog()['fish'] as $f) { $owned=$s['fish'][$f['id']]??null;$f['discovered']=$owned!==null;$f['discovered_at']=$owned['discovered_at']??null;$f['catch_count']=$owned['catch_count']??0;if($owned===null)$f['description']=null;$out[]=$f; }
        return $out;
    }
    /** 购买条件提示，不是购买/拥有权实现；C3必须另加事务、version与已拥有校验。 */
    public static function decor_conditions(array $s,string $id): array {
        $c=self::rules_config();gamecenter_aquarium_rules::validate($s,$c);
        if(!isset($c['decor'][$id])) { throw new DomainException('decor'); }
        $e=$c['decor'][$id];$g=$e['requires'];$missing=[
            'coins'=>max(0,$e['cost']-$s['coins']),
            'pond_fish'=>max(0,$g['pond_count']-count(array_intersect_key($s['fish'],$c['waters']['pond']['fish']))),
            'total_fish'=>max(0,$g['total_fish']-count($s['fish'])),
            'water_id'=>$g['water_unlocked']!=='' && !in_array($g['water_unlocked'],$s['unlocked_waters'],true) ? $g['water_unlocked'] : ''];
        return ['eligible'=>$missing['coins']===0 && $missing['pond_fish']===0 && $missing['total_fish']===0 && $missing['water_id']==='','missing'=>$missing];
    }
}
